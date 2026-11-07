import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { type Document, type Node, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { VertexCountMethod, dedup, getPrimitiveVertexCount, meshopt, prune, simplifyPrimitive, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { Matrix4, Vector3 } from 'three';
import type { Sex } from '@/engine/types';
import { type Anchors, LAYERS, type Layer, type OrganId, type Vec3 } from '@/models/types';
import { applyFit, applySigns, assertProperRotation, axisSigns, boxCenter, boxOfPositions, bp3dToYUp, combineFits, fitBoxes, horizontalFront, isPlausibleFit, unionBox } from './models/align';
import { applyArmPose, centroid, farthestPoint, humeralHead, isPlausibleArmScale, lateralPoint, poseArm, regionCentroid, rightSideSign, sideByCentroid } from './models/arms';
import { assertBudget, boxGap, boxInside, missingOrgans, pointBoxGap } from './models/checks';
import {
  BP3D_DIR,
  BP3D_FREE_UPPER_LIMB_MUSCLE,
  BP3D_FREE_UPPER_LIMBS,
  BP3D_HIP_BONES,
  BP3D_HUMERI,
  BP3D_LIVER,
  BP3D_PANCREAS,
  BP3D_PARTS,
  BP3D_SPINE,
  FIT_ANCHORS,
  HUBMAP_PARTS,
  hubmapNodeName,
  hubmapPath,
} from './models/manifest';
import { mergeObjMeshes, parseObj } from './models/obj';
import type { ArmPose, AxisFit, Box, FitName, Landmarks, ObjMesh, Region, Side } from './models/types';

const OUT_DIR = 'public/models';
const TARGET_VERTICES = 40_000;
const SIMPLIFY_ERROR = 0.01;
const BODY_TOLERANCE_M = 0.02;
const ORGAN_GAP_M = 0.03;
const MOUTH_REACH_M = 0.15;
const HAND_REGION_M = 0.08;
const HAND_REACH_M = 0.05;
const SIDES: readonly Side[] = ['right', 'left'];

const toBox = (b: { min: number[]; max: number[] }): Box => ({ min: b.min as Vec3, max: b.max as Vec3 });

function readElementParts(tree: 'partof' | 'isa'): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of readFileSync(`${BP3D_DIR}/${tree}_element_parts.txt`, 'utf8').split('\n').slice(1)) {
    const [concept, , element] = line.trim().split('\t');
    if (!concept || !element) continue;
    map.set(concept, [...(map.get(concept) ?? []), element]);
  }
  return map;
}

function indexObjFiles(dir: string, index = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) indexObjFiles(path, index);
    else if (entry.name.endsWith('.obj')) index.set(entry.name.replace(/\.obj$/, ''), path);
  }
  return index;
}

const elements = { partof: readElementParts('partof'), isa: readElementParts('isa') };
const objFiles = indexObjFiles(BP3D_DIR);
const conceptCache = new Map<string, ObjMesh>();

function conceptElements(tree: 'partof' | 'isa', concept: string, exclude: string[] = []): string[] {
  const ids = elements[tree].get(concept);
  if (!ids || ids.length === 0) throw new Error(`BodyParts3D concept has no elements: ${concept}`);
  const skip = new Set(exclude.flatMap((c) => elements.partof.get(c) ?? elements.isa.get(c) ?? []));
  return ids.filter((id) => !skip.has(id));
}

function loadElements(ids: string[]): ObjMesh {
  return mergeObjMeshes(
    ids.map((id) => {
      const path = objFiles.get(id);
      if (!path) throw new Error(`Missing OBJ for element ${id}`);
      return parseObj(readFileSync(path, 'utf8'));
    }),
  );
}

function loadConcept(tree: 'partof' | 'isa', concept: string, exclude: string[] = []): ObjMesh {
  const key = `${tree}:${concept}:${exclude.join(',')}`;
  const cached = conceptCache.get(key);
  if (cached) return cached;
  const mesh = loadElements(conceptElements(tree, concept, exclude));
  conceptCache.set(key, mesh);
  return mesh;
}

function transformPositions(positions: number[], map: (p: Vec3) => Vec3): number[] {
  const out: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = map([positions[i], positions[i + 1], positions[i + 2]]);
    out.push(x, y, z);
  }
  return out;
}

function worldPositions(node: Node): number[] {
  const matrix = new Matrix4().fromArray(node.getWorldMatrix());
  const v = new Vector3();
  const out: number[] = [];
  for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const position = primitive.getAttribute('POSITION');
    if (!position) continue;
    for (let i = 0; i < position.getCount(); i++) {
      const [x, y, z] = position.getElement(i, [0, 0, 0]);
      v.set(x, y, z).applyMatrix4(matrix);
      out.push(v.x, v.y, v.z);
    }
  }
  return out;
}

const placed = (mesh: ObjMesh, map: (p: Vec3) => Vec3): ObjMesh => ({ positions: transformPositions(mesh.positions, map), indices: mesh.indices });

function addMesh(doc: Document, name: string, mesh: ObjMesh, extras: Record<string, unknown>): Node {
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const position = doc.createAccessor().setType('VEC3').setArray(new Float32Array(mesh.positions)).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(mesh.indices)).setBuffer(buffer);
  const primitive = doc.createPrimitive().setAttribute('POSITION', position).setIndices(indices);
  return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)).setExtras(extras);
}

const DROPPED_ATTRIBUTE = /^(NORMAL|TANGENT|TEXCOORD_\d+|COLOR_\d+)$/;

function dropVertexAttributes(doc: Document): void {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      for (const semantic of primitive.listSemantics()) {
        if (DROPPED_ATTRIBUTE.test(semantic)) primitive.setAttribute(semantic, null);
      }
    }
  }
}

function check(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

async function buildSex(sex: Sex, io: NodeIO): Promise<void> {
  const doc = await io.read(hubmapPath(sex));
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
  const hubNode = (node: string): Node => {
    const found = byName.get(hubmapNodeName(sex, node));
    if (!found) throw new Error(`HuBMAP ${sex} node missing: ${hubmapNodeName(sex, node)}`);
    return found;
  };
  const hubBox = (nodes: string[]): Box => unionBox(nodes.map((n) => toBox(getBounds(hubNode(n)))));

  const skinBox = hubBox(['skin']);
  const skinPositions = worldPositions(hubNode('skin'));
  const duodenumBox = hubBox(['duodenum']);
  const hubAnchors = {
    mouth: boxCenter(hubBox(['mouth'])),
    duodenum: boxCenter(duodenumBox),
    smallIntestine: boxCenter(hubBox(['small_intestine'])),
    liver: boxCenter(hubBox(['liver'])),
    heart: boxCenter(hubBox(['heart'])),
    colon: boxCenter(hubBox(['colon'])),
    brain: boxCenter(hubBox(['Allen_brain'])),
  };

  const front = horizontalFront(boxCenter(hubBox(['liver', 'small_intestine', 'colon'])), boxCenter(hubBox(['vertebral_column'])));
  const bpYUpBox = (concepts: string[]): Box =>
    unionBox(concepts.map((c) => boxOfPositions(transformPositions(loadConcept('partof', c).positions, bp3dToYUp))));
  const fromLandmarks: Landmarks = {
    liver: boxCenter(bpYUpBox([BP3D_LIVER])),
    pancreas: boxCenter(bpYUpBox([BP3D_PANCREAS])),
    pelvis: boxCenter(bpYUpBox(BP3D_HIP_BONES)),
    spine: boxCenter(bpYUpBox([BP3D_SPINE])),
  };
  const toLandmarks: Landmarks = {
    liver: hubAnchors.liver,
    pancreas: boxCenter(hubBox(['pancreas'])),
    pelvis: boxCenter(hubBox(['pelvis'])),
    spine: boxCenter(hubBox(['vertebral_column'])),
  };
  const signs = axisSigns(fromLandmarks, toLandmarks);
  assertProperRotation(signs);
  const toHubFrame = (p: Vec3): Vec3 => applySigns(signs, bp3dToYUp(p));

  const anchorFit = (name: 'body' | 'skin'): AxisFit => {
    const anchor = FIT_ANCHORS[name];
    const from = unionBox(anchor.bp3d.map((c) => boxOfPositions(transformPositions(loadConcept('partof', c).positions, toHubFrame))));
    return fitBoxes(from, hubBox(anchor.hubmap));
  };
  const bodyFit = anchorFit('body');
  const fits: Record<FitName, AxisFit> = { body: bodyFit, trunk: combineFits(bodyFit, anchorFit('skin')) };
  for (const name of Object.keys(fits) as FitName[]) {
    const scales = fits[name].scale.map((s) => s.toFixed(3)).join(' ');
    check(isPlausibleFit(fits[name]), `Implausible ${name} fit for ${sex}: scale ${scales}`);
    process.stdout.write(`${sex} ${name} fit scale ${scales} signs ${signs.join(' ')}\n`);
  }
  const toTrunk = (p: Vec3): Vec3 => applyFit(fits.trunk, toHubFrame(p));

  const trunkParts = BP3D_PARTS.filter((part) => part.fit === 'trunk');
  const rendered = new Set(trunkParts.flatMap((part) => conceptElements(part.tree, part.concept, part.exclude)));
  const inTrunkFrame = (yUp: Vec3): Vec3 => applyFit(fits.trunk, applySigns(signs, yUp));
  const midlineX = inTrunkFrame(fromLandmarks.spine)[0];
  const bodyRight = rightSideSign(inTrunkFrame(fromLandmarks.liver)[0], midlineX);
  const centroidX = (id: string): number => centroid(transformPositions(loadElements([id]).positions, toTrunk))[0];
  const arms: Record<Side, Set<string>> = {
    right: new Set(conceptElements('partof', BP3D_FREE_UPPER_LIMBS.right).filter((id) => rendered.has(id))),
    left: new Set(conceptElements('partof', BP3D_FREE_UPPER_LIMBS.left).filter((id) => rendered.has(id))),
  };
  for (const id of conceptElements('isa', BP3D_FREE_UPPER_LIMB_MUSCLE)) {
    if (rendered.has(id)) arms[sideByCentroid(centroidX(id), midlineX, bodyRight)].add(id);
  }
  const misplaced = SIDES.flatMap((side) => [...arms[side]].filter((id) => sideByCentroid(centroidX(id), midlineX, bodyRight) !== side).map((id) => `${id} (${side})`));
  check(misplaced.length === 0, `${sex}: arm elements on the wrong side of the midline: ${misplaced.join(', ')}`);
  const regionOf = (id: string): Region => (arms.right.has(id) ? 'right' : arms.left.has(id) ? 'left' : 'trunk');

  const regions = new Map(
    trunkParts.map((part) => {
      const ids = conceptElements(part.tree, part.concept, part.exclude);
      const pick = (region: Region): ObjMesh => loadElements(ids.filter((id) => regionOf(id) === region));
      return [part.name, { trunk: pick('trunk'), right: pick('right'), left: pick('left') } as Record<Region, ObjMesh>];
    }),
  );
  for (const [name, split] of regions) {
    for (const side of SIDES) check(split[side].indices.length > 0, `${sex}: no ${side} arm elements in ${name}`);
  }
  const skinCenterX = boxCenter(skinBox)[0];
  const rightSign = rightSideSign(hubAnchors.liver[0], skinCenterX);
  const poses = {} as Record<Side, ArmPose>;
  for (const side of SIDES) {
    const pivot = humeralHead(transformPositions(loadConcept('partof', BP3D_HUMERI[side]).positions, toTrunk));
    const armPositions = transformPositions(mergeObjMeshes([...regions.values()].map((r) => r[side])).positions, toTrunk);
    const armHand = regionCentroid(armPositions, farthestPoint(armPositions, pivot), HAND_REGION_M);
    const skinTip = lateralPoint(skinPositions, (side === 'right' ? rightSign : -rightSign) as 1 | -1);
    const target = regionCentroid(skinPositions, skinTip, HAND_REGION_M);
    const pose = poseArm(pivot, armHand, target);
    const posedTip = farthestPoint(transformPositions(armPositions, (p) => applyArmPose(pose, p)), pivot);
    const tipGap = Math.hypot(...posedTip.map((v, i) => v - skinTip[i]));
    const fixed = (v: number): string => v.toFixed(3);
    process.stdout.write(
      `${sex} ${side} arm pivot ${pivot.map(fixed).join(' ')} length ratio ${fixed(pose.scale)} rotation ${pose.angleDegrees.toFixed(1)} deg tip to skin tip ${fixed(tipGap)} m\n`,
    );
    check(Math.sign(pivot[0] - skinCenterX) === Math.sign(target[0] - skinCenterX), `${sex}: ${side} arm pivot and skin target are on opposite sides`);
    check(isPlausibleArmScale(pose.scale), `${sex}: ${side} arm length ratio ${fixed(pose.scale)} is outside 0.8 to 1.25`);
    check(tipGap <= HAND_REACH_M, `${sex}: ${side} posed fingertip is ${fixed(tipGap)} m from the skin's outermost point`);
    poses[side] = pose;
  }

  const groups = Object.fromEntries(LAYERS.map((l) => [l, doc.createNode(l).setExtras({ layer: l })])) as Record<Layer, Node>;
  const picked = HUBMAP_PARTS.map((part) => ({ part, node: hubNode(part.node) }));
  const worlds = picked.map(({ node }) => node.getWorldMatrix());
  picked.forEach(({ part, node }, i) => {
    node.getParentNode()?.removeChild(node);
    node.setMatrix(worlds[i]).setExtras({ layer: part.layer, organ: part.organ });
    groups[part.layer].addChild(node);
  });
  const leftovers = scene.listChildren();
  const doomed: Node[] = [];
  for (const child of leftovers) {
    scene.removeChild(child);
    child.traverse((n) => doomed.push(n));
  }
  for (const n of doomed) n.dispose();
  for (const layer of LAYERS) scene.addChild(groups[layer]);

  const partBoxes = new Map<string, Box>();
  for (const part of BP3D_PARTS) {
    const split = regions.get(part.name);
    const mesh = split
      ? mergeObjMeshes([placed(split.trunk, toTrunk), ...SIDES.map((side) => placed(split[side], (p) => applyArmPose(poses[side], toTrunk(p))))])
      : placed(loadConcept(part.tree, part.concept, part.exclude), (p) => applyFit(fits[part.fit], toHubFrame(p)));
    partBoxes.set(part.name, boxOfPositions(mesh.positions));
    groups[part.layer].addChild(addMesh(doc, part.name, mesh, { layer: part.layer, organ: part.organ }));
  }

  const box = (name: string): Box => {
    const found = partBoxes.get(name);
    if (!found) throw new Error(`${name} was not built`);
    return found;
  };
  const skeleton = box('skeleton');
  process.stdout.write(`${sex} skeleton Y ${skeleton.min[1].toFixed(3)} to ${skeleton.max[1].toFixed(3)} (skin ${skinBox.min[1].toFixed(3)} to ${skinBox.max[1].toFixed(3)})\n`);
  const feetGap = skeleton.min[1] - skinBox.min[1];
  check(feetGap <= BODY_TOLERANCE_M, `${sex}: skeleton stops ${feetGap.toFixed(3)} m above the soles of the skin`);
  const oesophagus = box('oesophagus');
  const stomach = box('stomach');
  const oc = boxCenter(oesophagus);
  const anchors: Anchors = {
    ...hubAnchors,
    oesophagusTop: [oc[0], oesophagus.max[1], oc[2]],
    oesophagusBottom: [oc[0], oesophagus.min[1], oc[2]],
    stomach: boxCenter(stomach),
  };

  check(boxInside(box('skeleton'), skinBox, BODY_TOLERANCE_M), `${sex}: skeleton pokes outside the skin`);
  check(boxInside(box('muscles'), skinBox, BODY_TOLERANCE_M), `${sex}: muscles poke outside the skin`);
  check(boxGap(stomach, duodenumBox) <= ORGAN_GAP_M, `${sex}: stomach is ${boxGap(stomach, duodenumBox).toFixed(3)} m from the duodenum`);
  check(pointBoxGap(anchors.oesophagusBottom, stomach) <= ORGAN_GAP_M, `${sex}: oesophagus does not reach the stomach`);
  const mouthReach = Math.hypot(...anchors.oesophagusTop.map((v, i) => v - anchors.mouth[i]));
  check(anchors.oesophagusTop[1] < anchors.mouth[1] && mouthReach <= MOUTH_REACH_M, `${sex}: oesophagus top is not just below the mouth`);

  const tagged = new Set(root.listNodes().map((n) => n.getExtras().organ as OrganId | null | undefined).filter((o): o is OrganId => !!o));
  const missing = missingOrgans(tagged);
  check(missing.length === 0, `${sex}: organs missing from the model: ${missing.join(', ')}`);

  scene.setExtras({ sex, anchors, front });

  dropVertexAttributes(doc);
  await doc.transform(prune(), weld());
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const count = getPrimitiveVertexCount(primitive, VertexCountMethod.UPLOAD);
      if (count > TARGET_VERTICES) {
        simplifyPrimitive(primitive, { simplifier: MeshoptSimplifier, ratio: TARGET_VERTICES / count, error: SIMPLIFY_ERROR });
      }
    }
  }
  await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));

  const out = `${OUT_DIR}/${sex}.glb`;
  await io.write(out, doc);
  assertBudget(statSync(out).size, out);
  process.stdout.write(`Wrote ${out} (${(statSync(out).size / 1048576).toFixed(1)} MB)\n`);
}

async function main(): Promise<void> {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const sex of ['female', 'male'] as const) await buildSex(sex, io);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
