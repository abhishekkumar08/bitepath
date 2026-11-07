import { describe, expect, it } from 'vitest';
import { layerOpacity, vesselOpacity } from '@/scene/layers';

describe('layerOpacity', () => {
  it('shows only the skin at peel 0, so nothing pokes through it', () => {
    expect(layerOpacity(0, 'skin', false)).toBe(1);
    expect(layerOpacity(0, 'muscle', false)).toBe(0);
    expect(layerOpacity(0, 'skeleton', false)).toBe(0);
  });

  it('fades each layer in as the one above fades out', () => {
    expect(layerOpacity(0.5, 'skin', false)).toBe(0.5);
    expect(layerOpacity(0.5, 'muscle', false)).toBe(0.5);
    expect(layerOpacity(1, 'skin', false)).toBe(0);
    expect(layerOpacity(1, 'muscle', false)).toBe(1);
    expect(layerOpacity(1, 'skeleton', false)).toBe(0);
    expect(layerOpacity(1.5, 'muscle', false)).toBe(0.5);
    expect(layerOpacity(1.5, 'skeleton', false)).toBe(0.5);
    expect(layerOpacity(2, 'muscle', false)).toBe(0);
    expect(layerOpacity(2, 'skeleton', false)).toBe(1);
    expect(layerOpacity(3, 'skeleton', false)).toBe(0);
  });

  it('reveals organs as the skin peels, so they never show through opaque skin', () => {
    expect(layerOpacity(0, 'organs', false)).toBe(0);
    expect(layerOpacity(0.5, 'organs', false)).toBe(0.5);
    expect(layerOpacity(1, 'organs', false)).toBe(1);
    expect(layerOpacity(3, 'organs', false)).toBe(1);
  });

  it('keeps organs fully visible in x-ray mode', () => {
    expect(layerOpacity(0, 'organs', true)).toBe(1);
  });

  it('keeps a faint ghost of skin and bone in x-ray mode', () => {
    expect(layerOpacity(3, 'skin', true)).toBeCloseTo(0.08);
    expect(layerOpacity(3, 'skeleton', true)).toBeCloseTo(0.15);
    expect(layerOpacity(3, 'muscle', true)).toBe(0);
  });

  it('fades blood vessels only in x-ray mode', () => {
    expect(vesselOpacity(false)).toBe(1);
    expect(vesselOpacity(true)).toBeCloseTo(0.35);
  });
});
