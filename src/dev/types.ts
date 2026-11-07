import type { Catalogue, Portion, Sex } from '@/engine/types';
import type { Anchors } from '@/models/types';
import type { Lens } from '@/scene/lens/types';
import type { Director } from '@/scene/types';
import type { Narration } from '@/ui/narration';

export type PreviewLens = 'cube' | 'emulsify';

export interface PreviewQuery {
  beat: string | null;
  sex: Sex;
  plate: string[];
  at: number;
  lens: PreviewLens | null;
  foods: boolean;
  model: string | null;
  angle: number;
}

export interface PreviewHandle {
  catalogue: Catalogue;
  start: (sex: Sex, portions: Portion[], autoplay: boolean) => Promise<void>;
  getDirector: () => Director | null;
  getNarration: () => Narration | null;
  getLens: () => Lens | null;
  getAnchors: () => Anchors | null;
}
