import { describe, expect, it } from 'vitest';
import { viewOffsetFor } from '@/scene/viewOffset';

describe('viewOffsetFor', () => {
  it('returns null when nothing covers the canvas', () => {
    expect(viewOffsetFor({ left: 0, bottom: 0, top: 0 })).toBeNull();
  });

  it('moves the scene right by half the left inset (negative x offset)', () => {
    expect(viewOffsetFor({ left: 412, bottom: 0, top: 0 })).toEqual({ x: -206, y: 0 });
  });

  it('moves the scene up by half the bottom inset (positive y offset)', () => {
    expect(viewOffsetFor({ left: 0, bottom: 300, top: 0 })).toEqual({ x: 0, y: 150 });
  });

  it('moves the scene down by half the top inset (negative y offset)', () => {
    expect(viewOffsetFor({ left: 0, bottom: 0, top: 232 })).toEqual({ x: 0, y: -116 });
  });

  it('balances the top and bottom insets', () => {
    expect(viewOffsetFor({ left: 0, bottom: 300, top: 200 })).toEqual({ x: 0, y: 50 });
  });
});
