import type * as THREE from 'three';
import type { Beat, EffectId, Journey, Station } from '@/engine/types';
import type { FoodLook } from '@/scene/food/types';
import type { AnchorId, OrganId } from '@/models/types';
import type { Lens, LensOptions, LensScene } from '@/scene/lens/types';
import type { CameraGoal, LoadedBody, Moment, Stage, Streams } from '@/scene/types';

export interface BeatContext {
  stage: Stage;
  body: LoadedBody;
  journey: Journey;
  station: Station;
  beat: Beat;
  beatIndex: number;
  streams: Streams;
  lens: Lens | null;
  looks: FoodLook[];
}

export type BeatContextBase = Omit<BeatContext, 'beat' | 'beatIndex'>;

export interface BeatEffect {
  enter: () => void;
  update: (progress: number, dt: number) => void;
  exit: () => void;
  dispose: () => void;
  camera?: (progress: number) => CameraGoal | null;
}

export type BeatFactory = (ctx: BeatContext) => BeatEffect;

export type BeatFailurePhase = 'create' | 'enter' | 'update' | 'camera' | 'exit' | 'dispose';

export interface BeatFailure {
  beatIndex: number;
  phase: BeatFailurePhase;
  error: unknown;
}

export interface BeatPlayer {
  update: (moment: Moment, dt: number) => CameraGoal | null;
  dispose: () => void;
  readonly firstError: BeatFailure | null;
  readonly lastError: BeatFailure | null;
  readonly failures: readonly BeatFailure[];
  readonly failed: ReadonlySet<number>;
}

export type BeatFactories = Partial<Record<EffectId, BeatFactory>>;

export interface LensBeatSpec<S extends LensScene & { setProgress: (p: number) => void }> {
  organ: OrganId & AnchorId;
  build: () => S;
  options?: LensOptions;
  frame?: boolean;
}

export interface IntakePose {
  travel: number;
  scale: number;
  tilt: number;
}

export interface SquirtOptions {
  curve: THREE.Curve<THREE.Vector3>;
  events: number;
  perEvent: number;
  color: number;
  radius: number;
  spread: number;
  flare: number;
  seed: number;
}

export interface Squirt {
  mesh: THREE.InstancedMesh;
  update: (times: number[]) => void;
  dispose: () => void;
}

export type CirculationTarget = 'brain' | 'liver' | 'smallIntestine' | 'lower';

export interface FlowTubeOptions {
  color: number;
  radius: number;
  opacity: number;
  halo: number;
}

export interface FlowTube {
  group: THREE.Group;
  dispose: () => void;
}

export interface FlowDots {
  mesh: THREE.InstancedMesh;
  place: (slot: number, point: THREE.Vector3, size: number) => void;
  hide: (slot: number) => void;
  commit: () => void;
  dispose: () => void;
}

export interface OrganGlow {
  set: (hex: number, intensity: number) => void;
  restore: () => void;
}

export interface RimGlow {
  mesh: THREE.Mesh;
  setStrength: (strength: number) => void;
  dispose: () => void;
}
