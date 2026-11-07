import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { HEAP_RISE, blobDisplace, heapPositions, lathePoints, noise3, random, shellProfile } from '@/scene/food/modelParts';
import type { FoodModelBuilder, FoodModelId, HeapPoint, ProfilePoint } from '@/scene/food/types';

const { smoothstep } = THREE.MathUtils;
const TAU = Math.PI * 2;
const LATHE_SEGMENTS = 40;
const GLASS_TINT = 0xe6f2f6;
const CERAMIC_WHITE = 0xf1ede6;

type Painter = (x: number, y: number, z: number, out: THREE.Color) => void;

const tone = (hex: number | undefined, fallback: number): THREE.Color => new THREE.Color(hex ?? fallback);
const shade = (color: THREE.Color, factor: number): THREE.Color => color.clone().multiplyScalar(factor);
const lighten = (color: THREE.Color, amount: number): THREE.Color => color.clone().lerp(new THREE.Color(0xffffff), amount);

const matte = (color: THREE.ColorRepresentation, roughness = 0.75): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const painted = (roughness = 0.75): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0, vertexColors: true });

const liquid = (color: THREE.ColorRepresentation, roughness = 0.2): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.1 });

const glass = (): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({ color: GLASS_TINT, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05 });

function soften(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  const merged = mergeVertices(geometry, 1e-6);
  geometry.dispose();
  merged.computeVertexNormals();
  return merged;
}

function lumpy(geometry: THREE.BufferGeometry, seed: number, amount: number, frequency: number): THREE.BufferGeometry {
  const merged = soften(geometry);
  blobDisplace(merged.getAttribute('position').array as Float32Array, seed, amount, frequency);
  merged.computeVertexNormals();
  return merged;
}

function paint(geometry: THREE.BufferGeometry, painter: Painter): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    painter(position.getX(i), position.getY(i), position.getZ(i), color);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const lathe = (profile: ProfilePoint[], segments = LATHE_SEGMENTS): THREE.LatheGeometry =>
  new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p.r, p.y)), segments);

function radiusAt(profile: ProfilePoint[], y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1] as ProfilePoint;
    const b = profile[i] as ProfilePoint;
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.r + ((y - a.y) / (b.y - a.y)) * (b.r - a.r);
  }
  return (profile[profile.length - 1] as ProfilePoint).r;
}

function fillProfile(innerWall: ProfilePoint[], top: number): ProfilePoint[] {
  const below = innerWall.filter((p) => p.y < top);
  return [{ r: 0, y: (below[0] as ProfilePoint).y }, ...below, { r: radiusAt(innerWall, top), y: top }, { r: 0, y: top }];
}

function mesh(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  group.add(m);
  return m;
}

function seat(group: THREE.Group): THREE.Group {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const shift = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  for (const child of group.children) child.position.add(shift);
  return group;
}

function instances(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  place: (i: number, matrix: THREE.Matrix4, color: THREE.Color) => void,
): THREE.InstancedMesh {
  const inst = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    place(i, matrix, color);
    inst.setMatrixAt(i, matrix);
    inst.setColorAt(i, color);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  group.add(inst);
  return inst;
}

const compose = (matrix: THREE.Matrix4, x: number, y: number, z: number, euler: THREE.Euler, sx: number, sy: number, sz: number): THREE.Matrix4 =>
  matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(euler), new THREE.Vector3(sx, sy, sz));

function sweep(curve: THREE.Curve<THREE.Vector3>, along: number, around: number, radius: (u: number, theta: number) => number): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(along, false);
  const positions: number[] = [];
  const indices: number[] = [];
  const point = new THREE.Vector3();
  for (let i = 0; i <= along; i++) {
    const u = i / along;
    curve.getPointAt(u, point);
    const normal = frames.normals[i] as THREE.Vector3;
    const binormal = frames.binormals[i] as THREE.Vector3;
    for (let j = 0; j <= around; j++) {
      const theta = (j / around) * TAU;
      const r = radius(u, theta);
      positions.push(
        point.x + (normal.x * Math.cos(theta) + binormal.x * Math.sin(theta)) * r,
        point.y + (normal.y * Math.cos(theta) + binormal.y * Math.sin(theta)) * r,
        point.z + (normal.z * Math.cos(theta) + binormal.z * Math.sin(theta)) * r,
      );
    }
  }
  const row = around + 1;
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return soften(geometry);
}

function leafGeometry(length: number, width: number, seed: number, curl: number): THREE.BufferGeometry {
  const along = 12;
  const across = 6;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= along; i++) {
    const u = i / along;
    const half = width * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.75) * (1 - 0.25 * u);
    for (let j = 0; j <= across; j++) {
      const v = (j / across) * 2 - 1;
      const x = u * length;
      const z = v * half;
      const y = curl * (v * v) * half + 0.15 * length * u * u + 0.0012 * noise3(x * 300, z * 300, 0, seed);
      positions.push(x, y, z);
    }
  }
  const row = across + 1;
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * row + j;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const vein = new THREE.Color(0xffffff);
  const blade = new THREE.Color(0xcfd8c8);
  return paint(geometry, (x, _y, z, out) => {
    const rib = 1 - smoothstep(Math.abs(z), 0.0003, 0.0011);
    const side = Math.abs(Math.sin((x / length) * 22 + Math.abs(z) * 900));
    out.copy(blade).lerp(vein, Math.max(rib * 0.9, (1 - smoothstep(side, 0.05, 0.2)) * 0.35 * smoothstep(Math.abs(z), 0.001, 0.002)));
  });
}

const leafMaterial = (color: THREE.ColorRepresentation): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, vertexColors: true, side: THREE.DoubleSide });

const PUFF = 0.3;
const PUFF_RADIUS = 1.6;

const samosa: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const crust = tone(colors[0], 0xd9a441);
  const blister = tone(colors[1], 0x8a5a1f);
  const sides = [0, 1, 2].map((k) => new THREE.Vector3(Math.sqrt(8 / 9) * Math.cos((k * TAU) / 3), 1 / 3, Math.sqrt(8 / 9) * Math.sin((k * TAU) / 3)));
  const faces = [new THREE.Vector3(0, -1, 0), ...sides];
  const sharpness = 5;
  const size = 0.0135;
  const polytope = (dir: THREE.Vector3): number => {
    let sum = 0;
    for (const face of faces) sum += Math.pow(Math.max(0, face.dot(dir)), sharpness);
    return 1 / Math.pow(sum, 1 / sharpness);
  };
  const surface = (dir: THREE.Vector3, out: THREE.Vector3, lift: number): THREE.Vector3 => {
    const r = polytope(dir) * (1 - PUFF) + PUFF_RADIUS * PUFF + lift;
    return out.set(dir.x * r * size, Math.max(dir.y * r, -0.94) * size * 1.3, dir.z * r * size);
  };
  let geometry = soften(new THREE.IcosahedronGeometry(1, 11));
  const position = geometry.getAttribute('position');
  const dir = new THREE.Vector3();
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    surface(dir.fromBufferAttribute(position, i).normalize(), point, 0);
    position.setXYZ(i, point.x, point.y, point.z);
  }
  geometry = lumpy(geometry, seed, 0.0005, 300);
  const deep = shade(crust, 0.7);
  const bubble = lighten(crust, 0.22);
  const probe = new THREE.Vector3();
  const paintCrust: Painter = (x, y, z, out) => {
    const edge = smoothstep(polytope(probe.set(x, y / 1.3, z).normalize()), 1.25, 2);
    const warm = smoothstep(noise3(x * 90, y * 90, z * 90, seed + 2), -0.4, 0.6);
    const spots = smoothstep(noise3(x * 650, y * 650, z * 650, seed + 1), 0.4, 0.68);
    const bubbles = smoothstep(noise3(x * 900, y * 900, z * 900, seed + 3), 0.35, 0.6);
    out.copy(crust).lerp(deep, Math.max(warm * 0.45, edge * 0.7)).lerp(bubble, bubbles * 0.5).lerp(blister, spots * 0.45);
  };
  paint(geometry, paintCrust);
  mesh(group, geometry, painted(0.65));
  const apex = new THREE.Vector3(0, 1, 0);
  const corner = (sides[0] as THREE.Vector3).clone().negate().normalize();
  const seam = Array.from({ length: 24 }, (_, i) => surface(apex.clone().lerp(corner, 0.04 + (i / 23) * 0.9).normalize(), new THREE.Vector3(), -0.04));
  const ridge = sweep(new THREE.CatmullRomCurve3(seam), 40, 6, (u) => 0.0011 * (1 + 0.45 * Math.abs(Math.sin(u * 46))) * Math.min(1, u * 12, (1 - u) * 12));
  paint(ridge, paintCrust);
  mesh(group, ridge, painted(0.65));
  return group;
};

const flatbread: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const base = tone(colors[0], 0xd2a566);
  const char = tone(colors[1], 0x9c6b33);
  const burnt = shade(char, 0.45);
  const pale = lighten(base, 0.18);
  [0, 1].forEach((layer) => {
    const radius = 0.031;
    const geometry = soften(new THREE.IcosahedronGeometry(1, 8));
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) * radius;
      const z = position.getZ(i) * radius;
      const puff = 0.0016 * noise3(x * 70, layer, z * 70, seed) + 0.0008 * noise3(x * 200, layer + 3, z * 200, seed);
      position.setXYZ(i, x * (1 + 0.04 * noise3(x * 40, 9, z * 40, seed + layer)), position.getY(i) * 0.0018 + puff, z);
    }
    geometry.computeVertexNormals();
    paint(geometry, (x, y, z, out) => {
      const top = y > 0 ? 1 : 0.4;
      const blotch = smoothstep(noise3(x * 140, z * 140, layer * 7, seed + 5), 0.2, 0.55);
      const speck = smoothstep(noise3(x * 520, z * 520, layer * 7, seed + 6), 0.45, 0.7);
      out.copy(base).lerp(pale, smoothstep(noise3(x * 60, z * 60, layer, seed + 4), 0, 0.8) * 0.6).lerp(char, blotch * 0.85 * top).lerp(burnt, speck * top);
    });
    const m = mesh(group, geometry, painted(0.85));
    m.position.set(layer * 0.006, layer * 0.0042, layer * -0.004);
    m.rotation.set(layer * 0.06, layer * 1.3, layer * 0.04);
  });
  return group;
};

const rice: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const radius = 0.026;
  const count = 280;
  const main = tone(colors[0], 0xf4efe2);
  const second = colors[1] === undefined ? main : tone(colors[1], 0xf4efe2);
  const core = new THREE.SphereGeometry(1, 28, 10, 0, TAU, 0, Math.PI / 2);
  core.scale(radius * 0.84, radius * HEAP_RISE * 0.8, radius * 0.84);
  mesh(group, lumpy(core, seed, radius * 0.04, 90), matte(shade(main, 0.85), 0.9));
  const rand = random(seed + 17);
  const spots = heapPositions(count, radius, seed);
  const geometry = new THREE.SphereGeometry(1, 6, 4);
  geometry.scale(0.0013, 0.0012, 0.004);
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0 });
  instances(group, geometry, material, count, (i, matrix, color) => {
    const p = spots[i] as HeapPoint;
    normal.set(p.x / radius, p.y / (radius * HEAP_RISE * HEAP_RISE), p.z / radius).normalize();
    normal.x += (rand() - 0.5) * 0.5;
    normal.z += (rand() - 0.5) * 0.5;
    turn.setFromUnitVectors(up, normal.normalize()).multiply(spin.setFromAxisAngle(up, rand() * TAU));
    matrix.compose(new THREE.Vector3(p.x, p.y, p.z), turn, new THREE.Vector3(1, 1, 1));
    color.copy(rand() < 0.9 ? main : second).multiplyScalar(0.9 + rand() * 0.14);
  });
  return group;
};

function bowl(group: THREE.Group, glaze: number, fillColor: THREE.Color, seed: number, roughness: number, bumps: number): THREE.Mesh {
  const outer = lathePoints([
    { r: 0, y: 0 }, { r: 0.015, y: 0 }, { r: 0.016, y: 0.003 }, { r: 0.024, y: 0.011 }, { r: 0.0295, y: 0.022 }, { r: 0.031, y: 0.028 },
  ], 2);
  const shell = shellProfile(outer, 0.0024);
  mesh(group, lathe(shell), matte(glaze, 0.45));
  const inner = shell.slice(outer.length).reverse();
  const level = 0.022;
  const disc = soften(new THREE.RingGeometry(0, radiusAt(inner, level) + 0.0004, 40, 10));
  disc.rotateX(-Math.PI / 2);
  const position = disc.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const centre = 1 - Math.hypot(x, z) / 0.03;
    position.setY(i, level + bumps * (noise3(x * 160, 0, z * 160, seed) * 0.6 + 0.4) * centre + 0.0015 * centre);
  }
  disc.computeVertexNormals();
  const fill = mesh(group, disc, roughness < 0.4 ? liquid(fillColor, roughness) : matte(fillColor, roughness));
  return fill;
}

const bowlCurry: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const dal = tone(colors[0], 0xe0a928);
  const spice = tone(colors[1], 0xb8741f);
  const fill = bowl(group, 0x7a3b24, new THREE.Color(0xffffff), seed, 0.3, 0.0012);
  fill.geometry = paint(fill.geometry, (x, _y, z, out) => {
    const swirl = smoothstep(noise3(x * 110, z * 110, 1, seed + 3), 0.1, 0.6);
    out.copy(dal).lerp(spice, swirl * 0.7);
  });
  (fill.material as THREE.MeshStandardMaterial).vertexColors = true;
  const rand = random(seed + 9);
  const flake = new THREE.CircleGeometry(0.0016, 5);
  flake.rotateX(-Math.PI / 2);
  const euler = new THREE.Euler();
  const herb = new THREE.Color(0x3f7a2a);
  const chilli = new THREE.Color(0xa8321c);
  instances(group, flake, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }), 14, (i, matrix, color) => {
    const angle = rand() * TAU;
    const distance = Math.sqrt(rand()) * 0.019;
    euler.set((rand() - 0.5) * 0.3, rand() * TAU, 0);
    compose(matrix, Math.cos(angle) * distance, 0.0242, Math.sin(angle) * distance, euler, 0.6 + rand() * 0.8, 1, 0.6 + rand() * 0.8);
    color.copy(i % 4 === 3 ? chilli : herb);
  });
  return group;
};

const bowlWhite: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const main = tone(colors[0], 0xfbf9f2);
  const fill = bowl(group, 0x2d5582, main, seed, 0.55, 0.0035);
  fill.geometry = paint(fill.geometry, (x, _y, z, out) => {
    out.copy(main).multiplyScalar(0.9 + 0.1 * smoothstep(noise3(x * 300, z * 300, 2, seed + 4), -0.5, 0.6));
  });
  (fill.material as THREE.MeshStandardMaterial).vertexColors = true;
  (fill.material as THREE.MeshStandardMaterial).color.set(0xffffff);
  const spoonMaterial = new THREE.MeshStandardMaterial({ color: 0xd5d9df, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide });
  const scoop = new THREE.SphereGeometry(1, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2);
  scoop.scale(0.0065, 0.003, 0.009);
  const handle = new THREE.BoxGeometry(0.0034, 0.0012, 0.045);
  handle.translate(0, 0, 0.026);
  const spoon = new THREE.Group();
  spoon.add(new THREE.Mesh(scoop, spoonMaterial), new THREE.Mesh(handle, spoonMaterial));
  spoon.position.set(0.004, 0.0285, 0.002);
  spoon.rotation.set(-0.55, 0.5, 0);
  group.add(spoon);
  return group;
};

const cupHot: FoodModelBuilder = (colors) => {
  const group = new THREE.Group();
  const drink = tone(colors[0], 0x3b2417);
  const ceramic = matte(CERAMIC_WHITE, 0.4);
  const saucer = shellProfile(lathePoints([{ r: 0, y: 0 }, { r: 0.022, y: 0 }, { r: 0.031, y: 0.003 }, { r: 0.036, y: 0.0055 }], 2), 0.0016);
  mesh(group, lathe(saucer), ceramic);
  const outer = lathePoints([{ r: 0, y: 0 }, { r: 0.013, y: 0 }, { r: 0.0165, y: 0.006 }, { r: 0.0195, y: 0.025 }, { r: 0.0215, y: 0.039 }], 2);
  const shell = shellProfile(outer, 0.0018);
  const cup = mesh(group, lathe(shell), ceramic);
  cup.position.y = 0.0028;
  const inner = shell.slice(outer.length).reverse();
  const top = 0.034;
  const surface = new THREE.RingGeometry(0, radiusAt(inner, top), 40, 6);
  surface.rotateX(-Math.PI / 2);
  const crema = lighten(drink, 0.25);
  paint(surface, (x, _y, z, out) => {
    out.copy(drink).lerp(crema, smoothstep(Math.hypot(x, z), 0.013, 0.019) * 0.7);
  });
  const coffee = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 0.9, clearcoatRoughness: 0.1, vertexColors: true });
  const liquidTop = mesh(group, surface, coffee);
  liquidTop.position.y = 0.0028 + top;
  const handle = new THREE.TorusGeometry(0.0085, 0.0024, 8, 20, Math.PI * 1.2);
  const loop = mesh(group, handle, ceramic);
  loop.rotation.z = -Math.PI * 0.6;
  loop.position.set(0.0215, 0.0028 + 0.021, 0);
  return group;
};

function tumbler(group: THREE.Group, outerProfile: ProfilePoint[], thickness: number, fillTop: number, fill: THREE.Material): ProfilePoint[] {
  const outer = lathePoints(outerProfile, 2);
  const shell = shellProfile(outer, thickness);
  const inner = shell.slice(outer.length).reverse();
  const contents = fillProfile(inner.map((p) => ({ r: Math.max(0, p.r - 0.0003), y: p.y })), fillTop);
  mesh(group, lathe(contents), fill);
  const glassMesh = mesh(group, lathe(shell), glass());
  glassMesh.renderOrder = 2;
  return inner;
}

const glassDrink: FoodModelBuilder = (colors) => {
  const group = new THREE.Group();
  const drink = tone(colors[0], 0x2a1710);
  tumbler(group, [{ r: 0, y: 0 }, { r: 0.0185, y: 0 }, { r: 0.019, y: 0.005 }, { r: 0.0225, y: 0.064 }], 0.0016, 0.05, liquid(drink, 0.15));
  const straw = new THREE.CylinderGeometry(0.0021, 0.0021, 0.082, 12);
  straw.translate(0, 0.041, 0);
  const strawMesh = mesh(group, straw, matte(0xd93a3a, 0.45));
  strawMesh.position.set(0.006, 0.006, -0.002);
  strawMesh.rotation.set(0.12, 0, -0.22);
  const ice = new RoundedBoxGeometry(0.011, 0.011, 0.011, 2, 0.002);
  const iceMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf2fbff, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false, clearcoat: 1 });
  [[-0.007, 0.047, 0.004, 0.3], [0.005, 0.0475, -0.007, 1.1]].forEach(([x, y, z, spin]) => {
    const cube = mesh(group, ice, iceMaterial);
    cube.position.set(x as number, y as number, z as number);
    cube.rotation.set(0.25, spin as number, 0.15);
    cube.renderOrder = 1;
  });
  return group;
};

const glassBeer: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const beer = tone(colors[0], 0xe0a82e);
  const foam = tone(colors[1], 0xf3e3b0);
  const rim = 0.0235;
  const inner = tumbler(group, [{ r: 0, y: 0 }, { r: 0.0165, y: 0 }, { r: 0.017, y: 0.006 }, { r: 0.0215, y: 0.05 }, { r: rim, y: 0.068 }], 0.0016, 0.054, liquid(beer, 0.1));
  const level = 0.054;
  const head = lathePoints([
    { r: 0, y: level }, { r: radiusAt(inner, level) - 0.0002, y: level }, { r: radiusAt(inner, 0.066), y: 0.066 }, { r: rim + 0.0006, y: 0.0695 }, { r: rim * 0.75, y: 0.0718 }, { r: 0, y: 0.0724 },
  ], 3);
  const cap = lumpy(lathe(head), seed, 0.0006, 380);
  const froth = lighten(foam, 0.6);
  paint(cap, (x, y, z, out) => {
    out.copy(foam).lerp(froth, smoothstep(y, 0.062, 0.071)).multiplyScalar(0.94 + 0.06 * noise3(x * 600, y * 600, z * 600, seed));
  });
  mesh(group, cap, painted(0.9));
  return group;
};

const glassWine: FoodModelBuilder = (colors) => {
  const group = new THREE.Group();
  const wine = tone(colors[0], 0x6d1224);
  const stem = lathePoints([
    { r: 0, y: 0 }, { r: 0.021, y: 0 }, { r: 0.0212, y: 0.0012 }, { r: 0.009, y: 0.0025 }, { r: 0.0026, y: 0.007 }, { r: 0.0022, y: 0.03 }, { r: 0.0055, y: 0.0345 }, { r: 0, y: 0.0355 },
  ], 2);
  const stemMesh = mesh(group, lathe(stem, 32), glass());
  stemMesh.renderOrder = 2;
  const outer = lathePoints([
    { r: 0, y: 0.034 }, { r: 0.008, y: 0.035 }, { r: 0.0175, y: 0.042 }, { r: 0.0225, y: 0.055 }, { r: 0.0215, y: 0.068 }, { r: 0.0185, y: 0.078 },
  ], 2);
  const shell = shellProfile(outer, 0.0011);
  const inner = shell.slice(outer.length).reverse();
  mesh(group, lathe(fillProfile(inner.map((p) => ({ r: Math.max(0, p.r - 0.0003), y: p.y })), 0.053), 36), liquid(wine, 0.1));
  const bowlMesh = mesh(group, lathe(shell, 36), glass());
  bowlMesh.renderOrder = 2;
  return group;
};

const egg: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const white = tone(colors[0], 0xf8f4ea);
  const yolk = tone(colors[1], 0xf0b92a);
  const length = 0.023;
  const girth = 0.0165;
  [0, 1].forEach((k) => {
    const half = new THREE.Group();
    const shellGeometry = new THREE.SphereGeometry(1, 36, 14, 0, TAU, Math.PI / 2, Math.PI / 2);
    const position = shellGeometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      position.setX(i, x * length * (x > 0 ? 1.18 : 1));
      position.setY(i, position.getY(i) * girth);
      position.setZ(i, position.getZ(i) * girth);
    }
    shellGeometry.computeVertexNormals();
    const eggMaterial = matte(white, 0.4);
    half.add(new THREE.Mesh(shellGeometry, eggMaterial));
    const face = new THREE.CircleGeometry(1, 48);
    face.rotateX(-Math.PI / 2);
    const facePos = face.getAttribute('position');
    for (let i = 0; i < facePos.count; i++) {
      const x = facePos.getX(i);
      facePos.setX(i, x * length * (x > 0 ? 1.18 : 1));
      facePos.setZ(i, facePos.getZ(i) * girth);
    }
    half.add(new THREE.Mesh(face, eggMaterial));
    const yolkGeometry = lumpy(new THREE.SphereGeometry(1, 28, 10, 0, TAU, 0, Math.PI / 2), seed + k, 0.04, 6);
    yolkGeometry.scale(0.0105, 0.0035, 0.0095);
    const deep = shade(yolk, 0.85);
    paint(yolkGeometry, (x, _y, z, out) => out.copy(yolk).lerp(deep, 1 - smoothstep(Math.hypot(x, z), 0.002, 0.009)));
    const yolkMesh = new THREE.Mesh(yolkGeometry, painted(0.85));
    yolkMesh.position.x = -0.002;
    half.add(yolkMesh);
    half.position.set(k === 0 ? -0.013 : 0.014, girth, k === 0 ? -0.006 : 0.008);
    half.rotation.set(k === 0 ? 0.08 : -0.12, k === 0 ? 0.35 : -0.5, 0);
    group.add(half);
  });
  return group;
};

const banana: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const peel = tone(colors[0], 0xf2d04a);
  const tip = new THREE.Color(0x3d2a16);
  const green = new THREE.Color(0x8fa13a);
  const freckle = new THREE.Color(0x6b4a1f);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.036, 0.014, 0), new THREE.Vector3(0, -0.012, 0), new THREE.Vector3(0.036, 0.018, 0));
  const thickness = 0.0118;
  const geometry = sweep(curve, 56, 20, (u, theta) => {
    if (u <= 0 || u >= 1) return 0;
    if (u < 0.025) return 0.0024;
    if (u > 0.87) return 0.0036 - 0.001 * smoothstep(u, 0.87, 0.99);
    const body = Math.max(0.3, Math.pow(Math.sin((Math.PI * (u - 0.01)) / 0.87), 0.4));
    return thickness * body * (1 + 0.08 * (Math.pow(Math.abs(Math.cos((5 * theta) / 2)), 3) - 0.5));
  });
  const start = curve.getPointAt(0);
  const span = curve.getPointAt(1).sub(start);
  paint(geometry, (x, y, z, out) => {
    const u = THREE.MathUtils.clamp(((x - start.x) * span.x + (y - start.y) * span.y) / span.lengthSq(), 0, 1);
    out.copy(peel).lerp(green, smoothstep(u, 0.75, 0.92) * 0.6);
    out.lerp(freckle, smoothstep(noise3(x * 500, y * 500, z * 500, seed), 0.55, 0.75) * 0.8);
    out.lerp(tip, Math.max(smoothstep(u, 0.955, 0.985) * 0.85, 1 - smoothstep(u, 0.02, 0.04)));
  });
  const m = mesh(group, geometry, painted(0.55));
  m.rotation.set(0.15, 0.4, 0);
  return group;
};

const apple: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const skin = tone(colors[0], 0xc8312b);
  const streak = tone(colors[1], 0xe8d98a);
  const profile = lathePoints([
    { r: 0, y: 0.0045 }, { r: 0.007, y: 0.0012 }, { r: 0.017, y: 0.004 }, { r: 0.0265, y: 0.015 }, { r: 0.029, y: 0.027 }, { r: 0.0255, y: 0.041 }, { r: 0.016, y: 0.0495 }, { r: 0.0065, y: 0.048 }, { r: 0, y: 0.0425 },
  ], 4);
  const raw = lathe(profile, 44);
  raw.translate(0, -0.025, 0);
  const geometry = lumpy(raw, seed, 0.0012, 45);
  geometry.translate(0, 0.025, 0);
  const bright = lighten(skin, 0.15);
  paint(geometry, (x, y, z, out) => {
    const angle = Math.atan2(z, x);
    const streaks = smoothstep(noise3(Math.cos(angle) * 3, y * 25, Math.sin(angle) * 3 + angle * 2.2, seed), 0.05, 0.7);
    const blush = smoothstep(noise3(x * 40, y * 40, z * 40, seed + 1), -0.3, 0.5);
    const dot = smoothstep(noise3(x * 900, y * 900, z * 900, seed + 2), 0.6, 0.8);
    out.copy(skin).lerp(bright, blush * 0.4).lerp(streak, streaks * 0.38).lerp(streak, dot * 0.5);
    out.lerp(streak, (1 - smoothstep(Math.hypot(x, z), 0.004, 0.012)) * smoothstep(y, 0.035, 0.046) * 0.6);
  });
  mesh(group, geometry, painted(0.45));
  const stem = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.043, 0), new THREE.Vector3(0.0005, 0.052, 0), new THREE.Vector3(0.003, 0.0575, 0.001)), 8, 0.0011, 6, false);
  mesh(group, stem, matte(0x4a3018, 0.8));
  const leaf = mesh(group, leafGeometry(0.02, 0.0065, seed, 0.35), leafMaterial(0x4f8a2e));
  leaf.position.set(0.0015, 0.0535, 0.0005);
  leaf.rotation.set(0.2, -0.5, 0.35);
  return group;
};

const idli: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const base = shade(tone(colors[0], 0xf6f1e4), 0.88);
  const pore = shade(base, 0.8);
  const rim = shade(base, 0.86).lerp(new THREE.Color(0xe8d9a8), 0.25);
  const placements: [number, number, number, number, number][] = [
    [-0.0205, 0, -0.009, 0, 0],
    [0.0205, 0, -0.009, 0, 0.6],
    [0, 0.0105, 0.012, 0.5, 1.7],
  ];
  const profile = lathePoints([
    { r: 0, y: 0 }, { r: 0.012, y: 0.0005 }, { r: 0.018, y: 0.0022 }, { r: 0.0212, y: 0.0048 }, { r: 0.0214, y: 0.0062 }, { r: 0.0185, y: 0.0098 }, { r: 0.0115, y: 0.0148 }, { r: 0, y: 0.0168 },
  ], 2);
  placements.forEach(([x, y, z, tilt, spin], k) => {
    const raw = lathe(profile, 36);
    raw.translate(0, -0.008, 0);
    const geometry = lumpy(raw, seed + k, 0.00025, 420);
    geometry.translate(0, 0.008, 0);
    paint(geometry, (px, py, pz, out) => {
      const holes = smoothstep(noise3(px * 450, py * 450, pz * 450, seed + k), 0.3, 0.75) * 0.35;
      const lip = 1 - smoothstep(Math.abs(py - 0.0055), 0.0004, 0.0018);
      out.copy(base).lerp(rim, lip * 0.8).lerp(pore, holes * 0.8);
    });
    const m = mesh(group, geometry, painted(0.9));
    m.position.set(x, y, z);
    m.rotation.set(tilt, spin, 0);
  });
  return group;
};

const poha: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const yellow = tone(colors[0], 0xe8c547);
  const leaf = tone(colors[1], 0x5c8a3a);
  const radius = 0.026;
  const core = new THREE.SphereGeometry(1, 28, 10, 0, TAU, 0, Math.PI / 2);
  core.scale(radius * 0.88, radius * 0.5, radius * 0.88);
  mesh(group, lumpy(core, seed, radius * 0.05, 90), matte(shade(yellow, 0.82), 0.85));
  const rand = random(seed + 3);
  const count = 190;
  const spots = heapPositions(count, radius, seed);
  const flake = lumpy(new THREE.SphereGeometry(1, 7, 4), seed, 0.18, 1.6);
  flake.scale(0.0032, 0.0007, 0.0021);
  const euler = new THREE.Euler();
  instances(group, flake, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), count, (i, matrix, color) => {
    const p = spots[i] as HeapPoint;
    euler.set((rand() - 0.5) * 1.6, rand() * TAU, (rand() - 0.5) * 1.6);
    compose(matrix, p.x, p.y, p.z, euler, 0.8 + rand() * 0.5, 1, 0.8 + rand() * 0.5);
    color.copy(yellow).multiplyScalar(0.88 + rand() * 0.2);
  });
  const leafGeo = leafGeometry(0.009, 0.0028, seed, 0.2);
  const tops = spots.filter((p) => p.y > radius * 0.25).slice(0, 26);
  instances(group, leafGeo, leafMaterial(0xffffff), tops.length, (i, matrix, color) => {
    const p = tops[i] as HeapPoint;
    euler.set((rand() - 0.5) * 0.8, rand() * TAU, (rand() - 0.5) * 0.8);
    compose(matrix, p.x * 1.03, p.y * 1.05 + 0.0008, p.z * 1.03, euler, 0.7 + rand() * 0.5, 1, 0.7 + rand() * 0.5);
    color.copy(leaf).multiplyScalar(0.8 + rand() * 0.3);
  });
  const nut = new THREE.SphereGeometry(1, 10, 8);
  nut.scale(0.0032, 0.0022, 0.0024);
  const peanut = new THREE.Color(0xa86a3a);
  const nutSpots = spots.filter((p) => p.y > radius * 0.2).slice(26, 36);
  instances(group, nut, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), nutSpots.length, (i, matrix, color) => {
    const p = nutSpots[i] as HeapPoint;
    euler.set(rand(), rand() * TAU, rand());
    compose(matrix, p.x * 1.04, p.y * 1.06, p.z * 1.04, euler, 1, 1, 1);
    color.copy(peanut).multiplyScalar(0.85 + rand() * 0.25);
  });
  return group;
};

const cubes: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const rand = random(seed);
  const tones = (colors.length > 0 ? colors : [0xf7f3e6]).map((c) => new THREE.Color(c));
  const placements: [number, number, number][] = [[-0.011, 0, -0.01], [0.011, 0, -0.011], [-0.012, 0, 0.011], [0.012, 0, 0.01], [0.0005, 0.0185, 0.0005]];
  placements.forEach(([x, y, z], k) => {
    const size = 0.0175 + rand() * 0.002;
    const geometry = lumpy(new RoundedBoxGeometry(size, size, size, 3, size * 0.12), seed + k, 0.00035, 300);
    const color = (tones[k % tones.length] as THREE.Color).clone();
    const crust = shade(color, 0.86);
    paint(geometry, (px, py, pz, out) => {
      const edge = smoothstep(Math.max(Math.abs(px), Math.abs(py), Math.abs(pz)) / (size / 2), 0.86, 1);
      out.copy(color).lerp(crust, edge * 0.6).multiplyScalar(0.95 + 0.06 * noise3(px * 400, py * 400, pz * 400, seed + k));
    });
    const m = mesh(group, geometry, painted(0.7));
    m.position.set(x, y + size / 2, z);
    m.rotation.set((rand() - 0.5) * 0.08, rand() * 1.2, (rand() - 0.5) * 0.08);
  });
  return group;
};

const greens: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const dark = tone(colors[0], 0x2f6b2c);
  const deeper = tone(colors[1], 0x1f4d22);
  const rand = random(seed + 1);
  const count = 22;
  const spots = heapPositions(count, 0.024, seed);
  const core = new THREE.SphereGeometry(1, 24, 8, 0, TAU, 0, Math.PI / 2);
  core.scale(0.019, 0.016, 0.019);
  mesh(group, lumpy(core, seed, 0.002, 120), matte(shade(deeper, 0.9), 0.7));
  const geometry = leafGeometry(0.032, 0.012, seed, 0.3);
  geometry.translate(-0.012, 0, 0);
  const euler = new THREE.Euler();
  instances(group, geometry, leafMaterial(0xffffff), count, (i, matrix, color) => {
    const p = spots[i] as HeapPoint;
    euler.set((rand() - 0.5) * 0.9, rand() * TAU, (rand() - 0.5) * 0.9);
    euler.x *= 1.3;
    compose(matrix, p.x, p.y * 1.5, p.z, euler, 0.8 + rand() * 0.35, 1, 0.8 + rand() * 0.35);
    color.copy(rand() < 0.5 ? dark : deeper).multiplyScalar(0.85 + rand() * 0.3);
  });
  return group;
};

const fries: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const gold = tone(colors[0], 0xe5b448);
  const brown = shade(gold, 0.5);
  const rand = random(seed);
  const stick = new RoundedBoxGeometry(1, 1, 1, 2, 0.2);
  paint(stick, (_x, _y, z, out) => out.copy(gold).lerp(brown, smoothstep(Math.abs(z), 0.32, 0.5)));
  const count = 24;
  const spots = heapPositions(count, 0.022, seed);
  const euler = new THREE.Euler();
  instances(group, stick, painted(0.55), count, (i, matrix, color) => {
    const p = spots[i] as HeapPoint;
    euler.set((rand() - 0.5) * 0.7, rand() * Math.PI, (rand() - 0.5) * 0.5);
    const girth = 0.0046 + rand() * 0.0012;
    compose(matrix, p.x, 0.0025 + p.y * 0.7, p.z, euler, girth, girth * (0.85 + rand() * 0.2), 0.034 + rand() * 0.022);
    color.setRGB(1, 1, 1).multiplyScalar(0.86 + rand() * 0.16);
  });
  return group;
};

const bread: FoodModelBuilder = (colors) => {
  const group = new THREE.Group();
  const crumb = tone(colors[0], 0xf0dfb8);
  const crust = shade(tone(colors[1], 0xd9b777), 0.68);
  const outline = new THREE.Shape();
  outline.moveTo(-0.019, 0.003);
  outline.quadraticCurveTo(-0.019, 0, -0.016, 0);
  outline.lineTo(0.016, 0);
  outline.quadraticCurveTo(0.019, 0, 0.019, 0.003);
  outline.lineTo(0.0195, 0.03);
  outline.bezierCurveTo(0.027, 0.032, 0.029, 0.047, 0.0155, 0.0505);
  outline.bezierCurveTo(0.008, 0.0525, 0.003, 0.051, 0, 0.0495);
  outline.bezierCurveTo(-0.003, 0.051, -0.008, 0.0525, -0.0155, 0.0505);
  outline.bezierCurveTo(-0.029, 0.047, -0.027, 0.032, -0.0195, 0.03);
  outline.lineTo(-0.019, 0.003);
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0014, bevelSegments: 2, curveSegments: 10 });
  geometry.translate(0, 0, -0.004);
  const materials = [matte(crumb, 0.95), matte(crust, 0.8)];
  const flat = mesh(group, geometry, materials);
  flat.rotation.x = -Math.PI / 2;
  flat.position.set(-0.004, 0.0052, 0.05);
  flat.rotation.z = 0.25;
  const standing = mesh(group, geometry, materials);
  standing.rotation.set(-0.38, 0.12, 0);
  standing.position.set(0.006, 0.0012, -0.008);
  return group;
};

const fruit: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const skin = tone(colors[0], 0xf08c1a);
  const blush = colors[1] === undefined ? shade(skin, 0.85) : tone(colors[1], 0xf2b84a);
  const raw = new THREE.SphereGeometry(0.026, 48, 32);
  raw.scale(1, 0.92, 1);
  const geometry = lumpy(raw, seed, 0.0006, 70);
  const pit = shade(skin, 0.86);
  paint(geometry, (x, y, z, out) => {
    const side = smoothstep(noise3(x * 30, y * 30, z * 30, seed) + x * 25, -0.3, 0.8);
    const pore = smoothstep(noise3(x * 1200, y * 1200, z * 1200, seed + 1), 0.3, 0.7);
    out.copy(skin).lerp(blush, side * 0.6).lerp(pit, pore * 0.5);
  });
  const body = mesh(group, geometry, painted(0.55));
  body.position.y = 0.024;
  const stem = new THREE.CylinderGeometry(0.0012, 0.0016, 0.004, 8);
  const stemMesh = mesh(group, stem, matte(0x4b5a24, 0.8));
  stemMesh.position.y = 0.024 + 0.0239 + 0.0015;
  const leaf = mesh(group, leafGeometry(0.018, 0.0065, seed, 0.3), leafMaterial(0x3f7a2a));
  leaf.position.set(0.0008, 0.0485, 0);
  leaf.rotation.set(0.1, 0.6, 0.3);
  return group;
};

const meat: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const roast = tone(colors[0], 0xb4604f);
  const light = tone(colors[1], 0xd9a58f);
  const burnt = shade(roast, 0.5);
  const profile = lathePoints([
    { r: 0, y: 0 }, { r: 0.011, y: 0.003 }, { r: 0.0175, y: 0.014 }, { r: 0.0168, y: 0.027 }, { r: 0.011, y: 0.039 }, { r: 0.0055, y: 0.046 }, { r: 0.0042, y: 0.05 }, { r: 0, y: 0.051 },
  ], 4);
  const raw = lathe(profile, 40);
  raw.translate(0, -0.024, 0);
  const geometry = lumpy(raw, seed, 0.0012, 120);
  paint(geometry, (x, y, z, out) => {
    const sear = smoothstep(noise3(x * 160, y * 160, z * 160, seed + 1), 0.05, 0.6);
    const sheen = smoothstep(noise3(x * 60, y * 60, z * 60, seed + 2), 0.2, 0.8);
    out.copy(roast).lerp(light, sheen * 0.45).lerp(burnt, sear * 0.6);
  });
  const leg = new THREE.Group();
  leg.add(new THREE.Mesh(geometry, painted(0.55)));
  const boneMaterial = matte(0xf1e6cf, 0.6);
  const shaft = new THREE.CylinderGeometry(0.0026, 0.003, 0.02, 12);
  shaft.translate(0, 0.034, 0);
  leg.add(new THREE.Mesh(shaft, boneMaterial));
  [-1, 1].forEach((side) => {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 14, 10), boneMaterial);
    knob.position.set(side * 0.0026, 0.0445, 0);
    leg.add(knob);
  });
  leg.rotation.z = -1.3;
  leg.rotation.y = 0.5;
  group.add(leg);
  return group;
};

const fish: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const back = tone(colors[0], 0xe8a58c);
  const belly = tone(colors[1], 0xf2d6c4);
  const dark = shade(back, 0.6);
  const body = new THREE.SphereGeometry(1, 40, 20);
  const position = body.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const taper = x < 0 ? 1 - 0.78 * Math.pow(-x, 1.6) : 1 - 0.2 * x * x;
    position.setXYZ(i, x * 0.032, position.getY(i) * 0.0135 * taper, position.getZ(i) * 0.006 * taper);
  }
  body.computeVertexNormals();
  const geometry = lumpy(body, seed, 0.0002, 400);
  paint(geometry, (x, y, _z, out) => {
    const scales = 0.5 + 0.5 * Math.sin(x * 900 + Math.sin(y * 700) * 2) * Math.sin(y * 900);
    out.copy(belly).lerp(back, smoothstep(y, -0.004, 0.006)).lerp(dark, smoothstep(y, 0.007, 0.012) * 0.6).multiplyScalar(0.93 + 0.07 * scales);
  });
  const fishGroup = new THREE.Group();
  fishGroup.add(new THREE.Mesh(geometry, painted(0.45)));
  const finMaterial = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const tail = new THREE.Shape();
  tail.moveTo(0, 0);
  tail.lineTo(-0.016, 0.012);
  tail.quadraticCurveTo(-0.012, 0, -0.016, -0.012);
  tail.lineTo(0, 0);
  const tailMesh = new THREE.Mesh(new THREE.ShapeGeometry(tail, 6), finMaterial);
  tailMesh.position.x = -0.029;
  const dorsal = new THREE.Shape();
  dorsal.moveTo(-0.012, 0);
  dorsal.quadraticCurveTo(-0.004, 0.009, 0.008, 0.002);
  dorsal.lineTo(0.008, 0);
  dorsal.lineTo(-0.012, 0);
  const dorsalMesh = new THREE.Mesh(new THREE.ShapeGeometry(dorsal, 6), finMaterial);
  dorsalMesh.position.y = 0.0118;
  const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 12, 8), matte(0xf4f1e8, 0.3));
  eyeWhite.position.set(0.021, 0.003, 0.0038);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0015, 10, 8), matte(0x101010, 0.2));
  pupil.position.set(0.0212, 0.003, 0.0058);
  const gill = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0005, 6, 16, Math.PI * 0.7), matte(dark, 0.6));
  gill.position.set(0.019, 0, 0.0046);
  gill.rotation.z = -Math.PI * 0.35;
  fishGroup.add(tailMesh, dorsalMesh, eyeWhite, pupil, gill);
  fishGroup.rotation.x = -1.15;
  group.add(fishGroup);
  return group;
};

const chunk: FoodModelBuilder = (colors, seed) => {
  const group = new THREE.Group();
  const rand = random(seed);
  const tones = (colors.length > 0 ? colors : [0xdcc9a1]).map((c) => new THREE.Color(c));
  const placements: [number, number, number, number][] = [[-0.012, 0, -0.004, 1], [0.011, 0, -0.006, 0.9], [-0.001, 0, 0.012, 0.85], [0, 0.012, -0.002, 0.8]];
  placements.forEach(([x, y, z, s], k) => {
    const geometry = lumpy(new THREE.IcosahedronGeometry(1, 4), seed + k, 0.22, 1.4);
    geometry.scale(0.012 * s, 0.009 * s, 0.0105 * s);
    const color = (tones[k % tones.length] as THREE.Color).clone();
    const dark = shade(color, 0.7);
    paint(geometry, (px, py, pz, out) => {
      out.copy(color).lerp(dark, smoothstep(noise3(px * 300, py * 300, pz * 300, seed + k), 0, 0.7) * 0.6);
    });
    const m = mesh(group, geometry, painted(0.75));
    m.position.set(x, y + 0.008 * s, z);
    m.rotation.set(rand() * TAU, rand() * TAU, rand() * TAU);
  });
  return group;
};

const BUILDERS: Record<FoodModelId, FoodModelBuilder> = {
  samosa,
  flatbread,
  rice,
  'bowl-curry': bowlCurry,
  'bowl-white': bowlWhite,
  'cup-hot': cupHot,
  'glass-drink': glassDrink,
  'glass-beer': glassBeer,
  'glass-wine': glassWine,
  egg,
  banana,
  apple,
  idli,
  poha,
  cubes,
  greens,
  fries,
  bread,
  fruit,
  meat,
  fish,
  chunk,
};

export const FOOD_MODEL_IDS = Object.keys(BUILDERS) as FoodModelId[];

export function createFoodModel(id: FoodModelId, colors: number[], seed: number): THREE.Group {
  const group = seat(BUILDERS[id](colors, seed));
  group.name = id;
  return group;
}

export function disposeFoodModel(group: THREE.Object3D): void {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
}
