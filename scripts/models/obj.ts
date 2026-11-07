import type { ObjMesh } from './types';

export function parseObj(text: string): ObjMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') {
      positions.push(Number(parts[1]), Number(parts[2]), Number(parts[3]));
    } else if (parts[0] === 'f') {
      const vertexCount = positions.length / 3;
      const corners = parts.slice(1).map((token) => {
        const index = Number(token.split('/')[0]);
        return index < 0 ? vertexCount + index : index - 1;
      });
      for (let k = 1; k + 1 < corners.length; k++) indices.push(corners[0], corners[k], corners[k + 1]);
    }
  }
  return { positions, indices };
}

export function mergeObjMeshes(meshes: ObjMesh[]): ObjMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const mesh of meshes) {
    const offset = positions.length / 3;
    for (const p of mesh.positions) positions.push(p);
    for (const i of mesh.indices) indices.push(i + offset);
  }
  return { positions, indices };
}
