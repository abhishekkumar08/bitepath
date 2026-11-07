import type * as THREE from 'three';
import type { Vec3 } from '@/models/types';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface PlacementInput {
  anchorScreen: Point;
  viewport: Viewport;
  obstacles: Rect[];
  keepOut?: Rect[];
  phone: boolean;
  size: number;
  clearance?: number;
}

export interface Placement {
  center: Point;
  size: number;
}

export interface LensScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update: (dt: number) => void;
  dispose: () => void;
}

export interface LensOptions {
  sped?: boolean;
  clearance?: number;
}

export interface Lens {
  show: (factory: () => LensScene, anchorWorld: Vec3, opts?: LensOptions) => void;
  hide: () => void;
  setAnchor: (anchorWorld: Vec3) => void;
  update: (dt: number) => void;
  endStation: () => void;
  dispose: () => void;
}

export interface LensHost {
  obstacles: HTMLElement[];
  keepOut: HTMLElement[];
  onActiveChange: (active: boolean) => void;
}

export interface MotionPoint {
  x: number;
  y: number;
  z: number;
}

export interface BeadSlot {
  start: number;
  crosses: boolean;
}

export type BeadKind = 'glucose' | 'amino' | 'fattyAcid' | 'caffeine' | 'iron';

export interface BeadGroup {
  kind: BeadKind;
  color: number;
  count: number;
  fraction: number;
}

export interface VilliOptions {
  beads: BeadGroup[];
  flagship: boolean;
}

export interface VilliScene extends LensScene {
  setProgress: (p: number) => void;
}

export interface BeadTrack {
  start: number;
  crosses: boolean;
  lane: number;
  villus: number;
  lacteal: boolean;
  size: number;
  cross: number;
  exit: number;
  color: number;
}

export type SeepOutcome = 'cross' | 'broken' | 'stay';

export interface SeepSlot {
  start: number;
  outcome: SeepOutcome;
}

export interface LiningOptions {
  beads: number;
  female: boolean;
}

export interface LiningScene extends LensScene {
  setProgress: (p: number) => void;
}

export type ChainShape = 'chain' | 'folded';

export type ChainCutMode = 'some' | 'all';

export interface ChainCut {
  bond: number;
  time: number;
  enzyme: number;
}

export interface ChainPlan {
  beads: MotionPoint[];
  cuts: ChainCut[];
  enzymes: number;
  bondCut: number[];
  piece: number[];
  release: number[];
  drift: MotionPoint[];
}

export interface ChainOptions {
  kind: 'starch' | 'protein';
  enzyme: 'amylase' | 'pepsin' | 'pancreatic';
  fluid: 'saliva' | 'acid' | 'plain';
  endBeads: 'pieces' | 'glucose' | 'amino';
}

export interface ChainScene extends LensScene {
  setProgress: (p: number) => void;
}

export type GradientStop = readonly [number, string];

export interface RimOptions {
  color: number;
  opacity: number;
  rimColor: number;
  glow: number;
  roughness: number;
  rimAlpha: number;
}

export interface HaloOptions {
  halo: number;
  vertexGlow?: number;
  color?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
}

export interface EmulsifyOptions {
  fat: number;
}

export interface EmulsifyScene extends LensScene {
  setProgress: (p: number) => void;
}

export interface BacteriaOptions {
  fibre: boolean;
}

export interface BacteriaScene extends LensScene {
  setProgress: (p: number) => void;
}
