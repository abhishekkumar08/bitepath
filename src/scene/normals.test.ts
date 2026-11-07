import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computeNormals } from '@/scene/normals';

function mesh(indexed: boolean, quantized: boolean): THREE.BufferGeometry {
  let seed = 7;
  const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const count = 300;
  const geometry = new THREE.BufferGeometry();
  const values = Array.from({ length: count * 3 }, () => random() * 2 - 1);
  geometry.setAttribute(
    'position',
    quantized
      ? new THREE.BufferAttribute(Int16Array.from(values, (v) => Math.round(v * 32767)), 3, true)
      : new THREE.BufferAttribute(Float32Array.from(values), 3),
  );
  if (indexed) {
    const tri = Array.from({ length: 900 }, () => Math.floor(random() * count));
    tri.splice(3, 3, 5, 5, 9);
    geometry.setIndex(tri);
  }
  return geometry;
}

describe('computeNormals', () => {
  for (const indexed of [true, false]) {
    for (const quantized of [true, false]) {
      it(`matches three.js bit for bit (indexed ${indexed}, quantized ${quantized})`, () => {
        const expected = mesh(indexed, quantized);
        expected.computeVertexNormals();
        const actual = mesh(indexed, quantized);
        computeNormals(actual);
        expect(Array.from(actual.getAttribute('normal').array)).toEqual(Array.from(expected.getAttribute('normal').array));
      });
    }
  }
});
