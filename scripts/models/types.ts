import type { Quaternion } from 'three';
import type { Layer, OrganId, Vec3 } from '@/models/types';

export interface Box {
  min: Vec3;
  max: Vec3;
}

export interface AxisFit {
  scale: Vec3;
  offset: Vec3;
}

export interface ObjMesh {
  positions: number[];
  indices: number[];
}

export type FitName = 'body' | 'trunk';

export type Side = 'right' | 'left';

export type Region = Side | 'trunk';

export interface HubmapPart {
  node: string;
  layer: Layer;
  organ: OrganId | null;
}

export interface Bp3dPart {
  name: string;
  concept: string;
  tree: 'partof' | 'isa';
  layer: Layer;
  organ: OrganId | null;
  fit: FitName;
  exclude: string[];
}

export interface Landmarks {
  liver: Vec3;
  pancreas: Vec3;
  pelvis: Vec3;
  spine: Vec3;
}

export interface ArmPose {
  pivot: Vec3;
  rotation: Quaternion;
  scale: number;
  angleDegrees: number;
}
