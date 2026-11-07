import type * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Catalogue, EffectId, Journey, Portion, StarId, Station, StationId } from '@/engine/types';
import type { AnchorId, Anchors, Layer, OrganId, Vec3 } from '@/models/types';
import type { BeatFailure } from '@/scene/beats/types';

export type FrameCallback = (dt: number) => void;

export interface Insets {
  left: number;
  bottom: number;
  top: number;
}

export interface ViewOffset {
  x: number;
  y: number;
}

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  onFrame: (cb: FrameCallback) => () => void;
  setInsets: (insets: Insets) => void;
}

export interface LoadedBody {
  root: THREE.Group;
  layers: Record<Layer, THREE.Mesh[]>;
  vessels: THREE.Mesh[];
  organs: Partial<Record<OrganId, THREE.Object3D>>;
  anchors: Anchors;
  front: Vec3;
}

export interface StreamModifier {
  swell: number;
  visible: number;
  advance: number | null;
  swirl: number;
}

export interface Streams {
  group: THREE.Group;
  mod: StreamModifier;
  holdModifiers: boolean;
  update: (index: number, moment: Moment) => void;
  easeModifiers: (dt: number) => void;
  resetModifiers: () => void;
  dispose: () => void;
}

export interface CameraGoal {
  position: Vec3;
  target: Vec3;
}

export interface Segment {
  station: Station;
  start: number;
  travelEnd: number;
  starsEnd: number;
  end: number;
  beatStarts: number[];
}

export type Phase = 'travel' | 'star' | 'dwell';

export interface Moment {
  index: number;
  phase: Phase;
  progress: number;
  stationProgress: number;
  star: StarId | null;
  done: boolean;
  beatIndex: number | null;
  beatProgress: number;
  beatEffect: EffectId | null;
}

export interface RouteArgs {
  routeAnchors: AnchorId[];
  journeyStations: StationId[];
  index: number;
  phase: Phase;
  progress: number;
  stationProgress: number;
}

export interface Plate {
  catalogue: Catalogue;
  portions: Portion[];
}

export interface DirectorHandlers {
  onStation: (index: number, station: Station) => void;
  onBeat: (index: number | null) => void;
  onFinish: () => void;
  onBeatError?: (failure: BeatFailure) => void;
}

export interface Director {
  journey: Journey;
  playing: boolean;
  play: () => void;
  pause: () => void;
  jump: (index: number) => void;
  seekBeat: (ruleId: string, progress: number) => void;
  dispose: () => void;
}

export type StarGoalFn = (star: StarId, anchors: Anchors, front: Vec3, progress: number) => CameraGoal;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}
