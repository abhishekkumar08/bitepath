import * as THREE from 'three';

export interface LensPool {
  keep<G extends THREE.BufferGeometry>(geometry: G): G;
  use<M extends THREE.Material>(material: M): M;
  instanced(geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh;
  dispose(): void;
}

export function createPool(scene: THREE.Scene): LensPool {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  let disposed = false;

  const keep = <G extends THREE.BufferGeometry>(geometry: G): G => {
    geometries.push(geometry);
    return geometry;
  };
  const use = <M extends THREE.Material>(material: M): M => {
    materials.push(material);
    return material;
  };
  const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(keep(geometry), use(material), Math.max(count, 1));
    mesh.count = count;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    meshes.push(mesh);
    scene.add(mesh);
    return mesh;
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const mesh of meshes) mesh.dispose();
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  };

  return { keep, use, instanced, dispose };
}
