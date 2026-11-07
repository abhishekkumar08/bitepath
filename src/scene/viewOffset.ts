import type { Insets, ViewOffset } from '@/scene/types';

export function viewOffsetFor({ left, bottom, top }: Insets): ViewOffset | null {
  if (left === 0 && bottom === 0 && top === 0) return null;
  return { x: 0 - left / 2, y: (bottom - top) / 2 };
}
