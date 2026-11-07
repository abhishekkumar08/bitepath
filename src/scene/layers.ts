import type { Layer } from '@/models/types';

const DEPTH: Record<Layer, number> = { skin: 0, muscle: 1, skeleton: 2, organs: 3 };
const XRAY_GHOST: Record<Layer, number> = { skin: 0.08, muscle: 0, skeleton: 0.15, organs: 1 };
const VESSELS_XRAY = 0.35;

export const vesselOpacity = (xray: boolean): number => (xray ? VESSELS_XRAY : 1);

export function layerOpacity(peel: number, layer: Layer, xray: boolean): number {
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  if (layer === 'organs') return xray ? 1 : clamp(peel);
  const visible = Math.min(clamp(DEPTH[layer] + 1 - peel), clamp(peel - DEPTH[layer] + 1));
  return xray ? Math.max(visible, XRAY_GHOST[layer]) : visible;
}
