import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { blobDisplace, random } from '@/scene/food/modelParts';
import { FALLBACK_LOOK, allLiquid, baseColor, blend, shareOrder } from '@/scene/food/share';
import { chymeColor, foodStage } from '@/scene/food/stage';
import type { FoodLook, FoodMass, FoodPiece, FoodStage, PieceSpec } from '@/scene/food/types';

const FOOD_RENDER_ORDER = 10;
const PASTE_RENDER_ORDER = 9;
const PASTE_BLOBS = 6;
const PASTE_RADIUS = 0.012;
const PASTE_OPACITY = 0.9;
const PASTE_PULL = 0.6;
const PASTE_STRETCH = 0.25;
const PASTE_THIN = 0.3;
const PASTE_FADE = 0.15;
const WET_PASTE = 1.6;
const MIN_SCALE = 1e-4;
const GRAIN_TINT = 0xe4ddcb;

function lumpy(geometry: THREE.BufferGeometry, seed: number, amount: number, frequency: number): THREE.BufferGeometry {
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  const merged = mergeVertices(geometry, 1e-6);
  geometry.dispose();
  blobDisplace(merged.getAttribute('position').array as Float32Array, seed, amount, frequency);
  merged.computeVertexNormals();
  return merged;
}

function leaf(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 14, 8);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setXYZ(i, x, position.getY(i) * 0.1 + 0.35 * x * x - 0.12 * z * z, z * 0.6);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const PIECES: Record<FoodPiece, PieceSpec> = {
  morsel: { size: 0.0068, stretch: [[0.8, 1.25], [0.6, 0.95], [0.8, 1.2]], roughness: 0.6, build: (seed) => lumpy(new THREE.IcosahedronGeometry(1, 2), seed, 0.28, 1.8) },
  crumb: { size: 0.0062, stretch: [[0.7, 1.3], [0.55, 1], [0.7, 1.25]], roughness: 0.75, build: (seed) => lumpy(new THREE.IcosahedronGeometry(1, 2), seed, 0.34, 2.8) },
  grain: { size: 0.0042, stretch: [[0.85, 1.1], [0.9, 1.15], [0.85, 1.1]], roughness: 0.6, build: () => new THREE.CapsuleGeometry(0.42, 1.1, 3, 8) },
  droplet: { size: 0.0045, stretch: [[0.8, 1.2], [0.8, 1.2], [0.8, 1.2]], roughness: 0.12, build: () => new THREE.SphereGeometry(1, 10, 8) },
  leaf: { size: 0.0095, stretch: [[0.75, 1.25], [0.9, 1.1], [0.7, 1.2]], roughness: 0.65, build: leaf },
};

function material(piece: FoodPiece): THREE.MeshStandardMaterial {
  const shared = { color: piece === 'grain' ? GRAIN_TINT : 0xffffff, metalness: 0, transparent: true, depthTest: true, depthWrite: true };
  if (piece === 'droplet') return new THREE.MeshPhysicalMaterial({ ...shared, roughness: PIECES.droplet.roughness, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  return new THREE.MeshStandardMaterial({ ...shared, roughness: PIECES[piece].roughness, side: piece === 'leaf' ? THREE.DoubleSide : THREE.FrontSide });
}

export function createFoodMass(looks: FoodLook[], count: number, seed: number): FoodMass {
  const rand = random(seed);
  const used = looks.length > 0 ? looks : [FALLBACK_LOOK];
  const order = shareOrder(used, count, rand);
  const kinds = [...new Set(order.map((l) => l.piece))];
  const kindOf = order.map((l) => kinds.indexOf(l.piece));
  const base = order.map((l) => baseColor(l, rand));
  const chyme = order.map((l) => l.chyme);
  const liquid = order.map((l) => l.liquid);
  const drinkOnly = allLiquid(used);
  const turn = order.map(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2)));
  const size = order.map((l) => {
    const spec = PIECES[l.piece];
    const [x, y, z] = spec.stretch.map(([lo, hi]) => spec.size * (lo + (hi - lo) * rand())) as [number, number, number];
    return new THREE.Vector3(x, y, z);
  });

  const geometries = kinds.map((kind, i) => PIECES[kind].build(seed + i));
  const materials = kinds.map(material);
  const meshes = kinds.map((kind, i) => {
    const mesh = new THREE.InstancedMesh(geometries[i] as THREE.BufferGeometry, materials[i] as THREE.Material, kindOf.filter((x) => x === i).length);
    mesh.name = `food:${kind}`;
    mesh.frustumCulled = false;
    mesh.renderOrder = FOOD_RENDER_ORDER;
    return mesh;
  });
  const cursors = kinds.map(() => 0);

  const pasteHex = blend(used);
  const pasteGeometry = lumpy(new THREE.IcosahedronGeometry(1, 4), seed + 11, 0.16, 1.4);
  const pasteMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35, transparent: true, opacity: PASTE_OPACITY, depthTest: false, depthWrite: false });
  const paste = new THREE.InstancedMesh(pasteGeometry, pasteMaterial, PASTE_BLOBS);
  paste.name = 'paste';
  paste.frustumCulled = false;
  paste.renderOrder = PASTE_RENDER_ORDER;
  paste.onAfterRender = (renderer) => renderer.clearDepth();
  const pasteSlot = new Int8Array(count).fill(-1);
  const blobs = Math.min(PASTE_BLOBS, count);
  for (let j = 0; j < blobs; j++) pasteSlot[Math.floor(((j + 0.5) * count) / blobs)] = j;
  const blobShape = Array.from({ length: PASTE_BLOBS }, () => new THREE.Vector3(0.85 + 0.4 * rand(), 0.7 + 0.3 * rand(), 0.85 + 0.4 * rand()));
  const blobAt = Array.from({ length: PASTE_BLOBS }, () => new THREE.Vector3());
  const blobRadius = new Float32Array(PASTE_BLOBS);
  const blobColor = new Float64Array(PASTE_BLOBS);
  const blobTurn = new Int32Array(PASTE_BLOBS);
  const centre = new THREE.Vector3();
  let weight = 0;
  let cream = 0;
  let blobCount = 0;

  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const stage: FoodStage = { morsel: 1, paste: 0, cream: 0 };

  for (const mesh of [...meshes, paste]) {
    for (let i = 0; i < mesh.count; i++) {
      mesh.setMatrixAt(i, matrix.identity());
      mesh.setColorAt(i, color.set(0xffffff));
    }
    mesh.count = 0;
  }

  return {
    meshes,
    paste,
    begin() {
      for (let i = 0; i < cursors.length; i++) cursors[i] = 0;
      centre.set(0, 0, 0);
      weight = 0;
      cream = 0;
      blobCount = 0;
    },
    piece(k, position, at, show, spread) {
      foodStage(at, stage);
      const kind = kindOf[k] as number;
      const s = drinkOnly ? 0 : show * stage.morsel;
      if (s > MIN_SCALE) {
        const mesh = meshes[kind] as THREE.InstancedMesh;
        const slot = cursors[kind] as number;
        cursors[kind] = slot + 1;
        mesh.setMatrixAt(slot, matrix.compose(position, turn[k] as THREE.Quaternion, scale.copy(size[k] as THREE.Vector3).multiplyScalar(s)));
        mesh.setColorAt(slot, color.setHex(chymeColor(base[k] as number, chyme[k] as number, stage)));
      }
      centre.addScaledVector(position, show);
      weight += show;
      cream += stage.cream * show;
      const blob = pasteSlot[k] as number;
      const wet = liquid[k] === true;
      const r = PASTE_RADIUS * spread * (wet ? WET_PASTE + (1 - WET_PASTE) * stage.paste : stage.paste) * show * (1 - PASTE_THIN * stage.cream);
      if (blob >= 0 && r > MIN_SCALE) {
        blobAt[blobCount]?.copy(position);
        blobRadius[blobCount] = r;
        blobColor[blobCount] = chymeColor(wet ? (base[k] as number) : pasteHex, pasteHex, stage);
        blobTurn[blobCount] = k;
        blobCount += 1;
      }
    },
    end() {
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i] as THREE.InstancedMesh;
        mesh.count = cursors[i] as number;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      if (weight > 0) centre.divideScalar(weight);
      const creamy = weight > 0 ? cream / weight : 0;
      const pull = PASTE_PULL + PASTE_STRETCH * creamy;
      for (let j = 0; j < blobCount; j++) {
        const at = (blobAt[j] as THREE.Vector3).sub(centre).multiplyScalar(pull).add(centre);
        const k = blobTurn[j] as number;
        paste.setMatrixAt(j, matrix.compose(at, turn[k] as THREE.Quaternion, scale.copy(blobShape[j] as THREE.Vector3).multiplyScalar(blobRadius[j] as number)));
        paste.setColorAt(j, color.setHex(blobColor[j] as number));
      }
      pasteMaterial.opacity = PASTE_OPACITY * (1 - PASTE_FADE * creamy);
      paste.count = blobCount;
      paste.instanceMatrix.needsUpdate = true;
      if (paste.instanceColor) paste.instanceColor.needsUpdate = true;
    },
    dispose() {
      for (const g of [...geometries, pasteGeometry]) g.dispose();
      for (const m of [...materials, pasteMaterial]) m.dispose();
      for (const mesh of [...meshes, paste]) mesh.dispose();
    },
  };
}
