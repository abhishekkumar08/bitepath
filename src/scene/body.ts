import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Sex } from '@/engine/types';
import { type Anchors, LAYERS, type Layer, type OrganId, type Vec3 } from '@/models/types';
import { layerOpacity, vesselOpacity } from '@/scene/layers';
import { materialFor } from '@/scene/materials';
import { computeNormals } from '@/scene/normals';
import type { LoadedBody } from '@/scene/types';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

function tagsOf(object: THREE.Object3D): { layer: Layer | null; organ: OrganId | null } {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    const layer = o.userData.layer as Layer | undefined;
    if (layer) return { layer, organ: (o.userData.organ as OrganId | null | undefined) ?? null };
  }
  return { layer: null, organ: null };
}

export async function loadBody(sex: Sex, onProgress: (fraction: number) => void): Promise<LoadedBody> {
  const gltf = await loader.loadAsync(`/models/${sex}.glb`, (e) => {
    if (e.total > 0) onProgress(e.loaded / e.total);
  });
  const anchors = gltf.scene.userData.anchors as Anchors | undefined;
  if (!anchors) throw new Error(`${sex}.glb has no anchors`);
  const front = gltf.scene.userData.front as Vec3 | undefined;
  if (!front) throw new Error(`${sex}.glb has no front`);
  const layers = Object.fromEntries(LAYERS.map((l) => [l, [] as THREE.Mesh[]])) as Record<Layer, THREE.Mesh[]>;
  const vessels: THREE.Mesh[] = [];
  const materials = new Map<string, THREE.MeshPhysicalMaterial>();
  const organs: Partial<Record<OrganId, THREE.Object3D>> = {};
  gltf.scene.traverse((object) => {
    const organ = object.userData.organ as OrganId | null | undefined;
    if (organ && !organs[organ]) organs[organ] = object;
    if (!(object instanceof THREE.Mesh)) return;
    const tags = tagsOf(object);
    if (!tags.layer) return;
    if (!object.geometry.getAttribute('normal')) computeNormals(object.geometry);
    const key = `${tags.layer}/${tags.organ}`;
    let material = materials.get(key);
    if (!material) {
      material = materialFor(tags.layer, tags.organ);
      materials.set(key, material);
    }
    object.material = material;
    if (tags.organ === 'vessels') vessels.push(object);
    else layers[tags.layer].push(object);
  });
  return { root: gltf.scene, layers, vessels, organs, anchors, front };
}

function setOpacity(meshes: THREE.Mesh[], opacity: number): void {
  for (const mesh of meshes) {
    const material = mesh.material as THREE.MeshPhysicalMaterial;
    material.opacity = opacity;
    material.visible = opacity > 0.001;
    material.depthWrite = opacity >= 0.999;
  }
}

export function applyLayers(body: LoadedBody, peel: number, xray: boolean): void {
  for (const layer of LAYERS) setOpacity(body.layers[layer], layerOpacity(peel, layer, xray));
  setOpacity(body.vessels, vesselOpacity(xray));
}
