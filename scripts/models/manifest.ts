import type { Sex } from '@/engine/types';
import type { Bp3dPart, HubmapPart, Side } from './types';

export const ASSETS_DIR = 'assets-src';

export const HUBMAP_URLS: Record<Sex, string> = {
  female: 'https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb',
  male: 'https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.10/assets/3d-vh-m-united.glb',
};

export const hubmapPath = (sex: Sex): string => `${ASSETS_DIR}/hubmap/united-${sex}.glb`;

export const hubmapNodeName = (sex: Sex, node: string): string =>
  node === 'Allen_brain' ? node : `${sex === 'female' ? 'VH_F' : 'VH_M'}_${node}`;

export const HUBMAP_PARTS: HubmapPart[] = [
  { node: 'skin', layer: 'skin', organ: null },
  { node: 'mouth', layer: 'organs', organ: 'mouth' },
  { node: 'liver', layer: 'organs', organ: 'liver' },
  { node: 'pancreas', layer: 'organs', organ: 'pancreas' },
  { node: 'gallbladder_', layer: 'organs', organ: 'gallbladder' },
  { node: 'biliary_tree', layer: 'organs', organ: 'gallbladder' },
  { node: 'small_intestine', layer: 'organs', organ: 'smallIntestine' },
  { node: 'colon', layer: 'organs', organ: 'colon' },
  { node: 'heart', layer: 'organs', organ: 'heart' },
  { node: 'blood_vasculature', layer: 'organs', organ: 'vessels' },
  { node: 'Allen_brain', layer: 'organs', organ: 'brain' },
  { node: 'pelvis', layer: 'skeleton', organ: null },
  { node: 'vertebral_column', layer: 'skeleton', organ: null },
];

export const BP3D_BASE = 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST';
export const BP3D_DIR = `${ASSETS_DIR}/bp3d`;
export const BP3D_DOWNLOADS = [
  'partof_BP3D_4.0_obj_99.zip',
  'isa_BP3D_4.0_obj_99.zip',
  'partof_element_parts.txt',
  'isa_element_parts.txt',
];

const REPLACED_BY_HUBMAP = ['FMA16586', 'FMA16587', 'FMA16202', 'FMA13478'];

export const BP3D_PARTS: Bp3dPart[] = [
  { name: 'oesophagus', concept: 'FMA7131', tree: 'partof', layer: 'organs', organ: 'oesophagus', fit: 'body', exclude: [] },
  { name: 'stomach', concept: 'FMA7148', tree: 'partof', layer: 'organs', organ: 'stomach', fit: 'body', exclude: [] },
  { name: 'skeleton', concept: 'FMA5018', tree: 'isa', layer: 'skeleton', organ: null, fit: 'trunk', exclude: REPLACED_BY_HUBMAP },
  { name: 'muscles', concept: 'FMA5022', tree: 'isa', layer: 'muscle', organ: null, fit: 'trunk', exclude: [] },
];

export const BP3D_LIVER = 'FMA7197';
export const BP3D_PANCREAS = 'FMA7198';
export const BP3D_HIP_BONES = ['FMA16586', 'FMA16587'];
export const BP3D_SPINE = 'FMA13478';

export const FIT_ANCHORS: Record<'body' | 'skin', { bp3d: string[]; hubmap: string[] }> = {
  body: { bp3d: REPLACED_BY_HUBMAP, hubmap: ['pelvis', 'vertebral_column'] },
  skin: { bp3d: ['FMA7163'], hubmap: ['skin'] },
};

export const BP3D_FREE_UPPER_LIMBS: Record<Side, string> = { right: 'FMA24880', left: 'FMA24881' };
export const BP3D_FREE_UPPER_LIMB_MUSCLE = 'FMA37348';
export const BP3D_HUMERI: Record<Side, string> = { right: 'FMA23130', left: 'FMA23131' };
