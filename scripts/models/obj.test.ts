import { describe, expect, it } from 'vitest';
import { mergeObjMeshes, parseObj } from './obj';

describe('parseObj', () => {
  it('reads vertices and triangulates quads with slash indices', () => {
    const mesh = parseObj('# c\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nvn 0 0 1\nf 1//1 2//1 3//1 4//1\n');
    expect(mesh.positions).toEqual([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    expect(mesh.indices).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('supports negative indices', () => {
    expect(parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1\n').indices).toEqual([0, 1, 2]);
  });
});

describe('mergeObjMeshes', () => {
  it('offsets the indices of later meshes', () => {
    const tri = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] };
    expect(mergeObjMeshes([tri, tri]).indices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('merges meshes far larger than the call-stack argument limit', () => {
    const big = { positions: new Array<number>(600_000).fill(1), indices: new Array<number>(600_000).fill(0) };
    expect(mergeObjMeshes([big, big]).positions.length).toBe(1_200_000);
  });
});
