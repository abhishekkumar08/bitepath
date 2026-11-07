import type * as THREE from 'three';

export type FoodModelId =
  | 'samosa' | 'flatbread' | 'rice' | 'bowl-curry' | 'bowl-white' | 'cup-hot' | 'glass-drink'
  | 'glass-beer' | 'glass-wine' | 'egg' | 'banana' | 'apple' | 'idli' | 'poha' | 'cubes'
  | 'greens' | 'fries' | 'bread' | 'fruit' | 'meat' | 'fish' | 'chunk';

export type FoodPiece = 'morsel' | 'grain' | 'droplet' | 'leaf' | 'crumb';

export interface FoodLook {
  id: string;
  name: string;
  model: FoodModelId;
  piece: FoodPiece;
  colors: number[];
  chyme: number;
  liquid: boolean;
  share: number;
}

export type FoodLookBase = Omit<FoodLook, 'id' | 'name' | 'share'>;

export interface ProfilePoint {
  r: number;
  y: number;
}

export interface HeapPoint {
  x: number;
  y: number;
  z: number;
}

export interface PieceSpec {
  size: number;
  stretch: [number, number][];
  roughness: number;
  build: (seed: number) => THREE.BufferGeometry;
}

export interface FoodStage {
  morsel: number;
  paste: number;
  cream: number;
}

export interface FoodMass {
  meshes: THREE.InstancedMesh[];
  paste: THREE.InstancedMesh;
  begin: () => void;
  piece: (k: number, position: THREE.Vector3, at: number, show: number, spread: number) => void;
  end: () => void;
  dispose: () => void;
}

export type FoodModelBuilder = (colors: number[], seed: number) => THREE.Group;
