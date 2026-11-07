import type { SearchHit } from '@/catalogue/types';
import type { Portion } from '@/engine/types';

export type Mode = 'single' | 'meal';

export interface MealItem {
  hit: SearchHit;
  portion: Portion;
}

export interface RowText {
  text: string;
  partial: boolean;
  missing: boolean;
}

export interface CaptionSlot {
  beatIndex: number | null;
}
