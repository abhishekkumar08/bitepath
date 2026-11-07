import * as THREE from 'three';

export function computeNormals(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const count = position.count;
  const p = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    p[i * 3] = position.getX(i);
    p[i * 3 + 1] = position.getY(i);
    p[i * 3 + 2] = position.getZ(i);
  }
  const n = new Float32Array(count * 3);
  const corners = index ? index.count : count;
  for (let i = 0; i < corners; i += 3) {
    const a = (index ? index.getX(i) : i) * 3;
    const b = (index ? index.getX(i + 1) : i + 1) * 3;
    const c = (index ? index.getX(i + 2) : i + 2) * 3;
    const cbx = p[c] - p[b];
    const cby = p[c + 1] - p[b + 1];
    const cbz = p[c + 2] - p[b + 2];
    const abx = p[a] - p[b];
    const aby = p[a + 1] - p[b + 1];
    const abz = p[a + 2] - p[b + 2];
    const x = cby * abz - cbz * aby;
    const y = cbz * abx - cbx * abz;
    const z = cbx * aby - cby * abx;
    const ax = n[a] + x;
    const ay = n[a + 1] + y;
    const az = n[a + 2] + z;
    const bx = n[b] + x;
    const by = n[b + 1] + y;
    const bz = n[b + 2] + z;
    const cx = n[c] + x;
    const cy = n[c + 1] + y;
    const cz = n[c + 2] + z;
    n[a] = ax;
    n[a + 1] = ay;
    n[a + 2] = az;
    n[b] = bx;
    n[b + 1] = by;
    n[b + 2] = bz;
    n[c] = cx;
    n[c + 1] = cy;
    n[c + 2] = cz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const s = 1 / (Math.sqrt(n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2]) || 1);
    n[i] *= s;
    n[i + 1] *= s;
    n[i + 2] *= s;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(n, 3));
}
