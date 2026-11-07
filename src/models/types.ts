export type Vec3 = [number, number, number];

export type Layer = 'skin' | 'muscle' | 'skeleton' | 'organs';

export const LAYERS: readonly Layer[] = ['skin', 'muscle', 'skeleton', 'organs'];

export type OrganId =
  | 'mouth'
  | 'oesophagus'
  | 'stomach'
  | 'smallIntestine'
  | 'liver'
  | 'gallbladder'
  | 'pancreas'
  | 'colon'
  | 'heart'
  | 'vessels'
  | 'brain';

export const ORGANS: readonly OrganId[] = [
  'mouth',
  'oesophagus',
  'stomach',
  'smallIntestine',
  'liver',
  'gallbladder',
  'pancreas',
  'colon',
  'heart',
  'vessels',
  'brain',
];

export type AnchorId =
  | 'mouth'
  | 'oesophagusTop'
  | 'oesophagusBottom'
  | 'stomach'
  | 'duodenum'
  | 'smallIntestine'
  | 'liver'
  | 'heart'
  | 'colon'
  | 'brain';

export type Anchors = Record<AnchorId, Vec3>;
