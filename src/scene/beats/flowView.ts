import * as THREE from 'three';
import type { FlowDots, FlowTube, FlowTubeOptions, OrganGlow, RimGlow } from '@/scene/beats/types';
import type { OrganId } from '@/models/types';
import { STAR_ORGANS, meshesOf } from '@/scene/stars';
import type { LoadedBody } from '@/scene/types';

export const VEIN_COLOR = 0x6f9dff;
export const VEIN_RADIUS = 0.004;
const HALO_RENDER_ORDER = 9;
const TUBE_RENDER_ORDER = 9.5;
const DOT_RENDER_ORDER = 10;
const TUBE_SEGMENTS = 64;
const HALO_SCALE = 2.6;

const overlay = (color: number, opacity: number): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

export function createFlowTube(curve: THREE.Curve<THREE.Vector3>, options: FlowTubeOptions): FlowTube {
  const { color, radius, opacity, halo } = options;
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.MeshBasicMaterial[] = [];
  const add = (r: number, material: THREE.MeshBasicMaterial, order: number): void => {
    const geometry = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, r, 8, curve instanceof THREE.CatmullRomCurve3 && curve.closed);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    geometries.push(geometry);
    materials.push(material);
    group.add(mesh);
  };
  if (halo > 0) add(radius * HALO_SCALE, overlay(color, halo), HALO_RENDER_ORDER);
  add(radius, overlay(color, opacity), TUBE_RENDER_ORDER);
  return {
    group,
    dispose() {
      group.removeFromParent();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

export function createDots(colors: number[], radius: number): FlowDots {
  const geometry = new THREE.SphereGeometry(radius, 12, 8);
  const material = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geometry, material, colors.length);
  mesh.renderOrder = DOT_RENDER_ORDER;
  mesh.frustumCulled = false;
  mesh.count = 0;
  const color = new THREE.Color();
  colors.forEach((hex, i) => mesh.setColorAt(i, color.setHex(hex)));
  const matrix = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  return {
    mesh,
    place(slot, point, size) {
      mesh.setMatrixAt(slot, matrix.compose(point, turn, scale.setScalar(size)));
    },
    hide(slot) {
      mesh.setMatrixAt(slot, matrix.makeScale(0, 0, 0));
    },
    commit() {
      mesh.count = colors.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

export function createObjectGlow(object: THREE.Object3D | undefined, starLit: boolean): OrganGlow {
  const materials = [...new Set(meshesOf(object).map((m) => m.material as THREE.MeshPhysicalMaterial))];
  const restEmissive = materials.map((m) => (starLit ? 0 : m.emissive.getHex()));
  const restIntensity = materials.map((m) => (starLit ? 0 : m.emissiveIntensity));
  return {
    set(hex, intensity) {
      for (const m of materials) {
        m.emissive.setHex(hex);
        m.emissiveIntensity = intensity;
      }
    },
    restore() {
      for (let i = 0; i < materials.length; i++) {
        const m = materials[i] as THREE.MeshPhysicalMaterial;
        m.emissive.setHex(restEmissive[i] as number);
        m.emissiveIntensity = restIntensity[i] as number;
      }
    },
  };
}

export const createOrganGlow = (body: LoadedBody, id: OrganId): OrganGlow => createObjectGlow(body.organs[id], STAR_ORGANS.includes(id));

const RIM_VERTEX = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-view.xyz);
  gl_Position = projectionMatrix * view;
}`;

const RIM_FRAGMENT = `
uniform vec3 color;
uniform float strength;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
  gl_FragColor = vec4(color, strength * rim);
}`;

export function createRimGlow(object: THREE.Object3D | undefined, color: number, scale: number): RimGlow {
  const sphere = new THREE.Box3().setFromObject(object ?? new THREE.Object3D()).getBoundingSphere(new THREE.Sphere());
  const geometry = new THREE.SphereGeometry(1, 32, 16);
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: 0 } },
    vertexShader: RIM_VERTEX,
    fragmentShader: RIM_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = HALO_RENDER_ORDER;
  mesh.frustumCulled = false;
  mesh.position.copy(sphere.center);
  mesh.scale.setScalar(Math.max(sphere.radius, 0) * scale);
  return {
    mesh,
    setStrength(strength) {
      (material.uniforms.strength as THREE.IUniform<number>).value = strength;
      mesh.visible = strength > 0;
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

const BOUND_SAMPLES = 24;

export function boundsOf(curves: THREE.Curve<THREE.Vector3>[], out: THREE.Box3): THREE.Box3 {
  out.makeEmpty();
  for (const curve of curves) for (const point of curve.getPoints(BOUND_SAMPLES)) out.expandByPoint(point);
  return out;
}
