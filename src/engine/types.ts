export type Sex = 'male' | 'female';

export type Nutrient = 'sugar' | 'starch' | 'protein' | 'fat' | 'fibre' | 'alcohol' | 'caffeine' | 'iron';

export type Nutrients = Record<Nutrient, number>;

export type StationId =
  | 'mouth'
  | 'oesophagus'
  | 'stomach'
  | 'smallIntestine'
  | 'liver'
  | 'bloodstream'
  | 'largeIntestine';

export type StarId = 'alcohol' | 'caffeine' | 'fibre' | 'fat' | 'iron' | 'sugar';

export type DetailId =
  | 'carbs' | 'sugar' | 'fibre' | 'protein' | 'fat' | 'satFat' | 'cholesterol'
  | 'calcium' | 'iron' | 'magnesium' | 'phosphorus' | 'potassium' | 'sodium' | 'zinc'
  | 'vitaminA' | 'vitaminC' | 'vitaminD' | 'vitaminE' | 'vitaminK'
  | 'thiamin' | 'riboflavin' | 'niacin' | 'folate' | 'vitaminB12';

export type Unit = 'g' | 'mg' | 'µg';

export type DetailGroup = 'macro' | 'mineral' | 'vitamin';

export interface DetailSpec {
  id: DetailId;
  unit: Unit;
  group: DetailGroup;
}

export type MeasuredPer100g = Partial<Record<DetailId, number>>;

export interface Measured {
  value: number;
  complete: boolean;
}

export interface PlateNutrition {
  energyKcal: number;
  details: Partial<Record<DetailId, Measured>>;
  grams: number;
}

export interface StreamShare {
  nutrient: Nutrient;
  share: number;
}

export interface Food {
  id: string;
  name: string;
  source: 'ifct' | 'usda';
  kcalPer100g: number;
  per100g: Nutrients;
  measured?: MeasuredPer100g;
}

export interface DishPart {
  foodId: string;
  grams: number;
}

export interface Dish {
  id: string;
  name: string;
  parts: DishPart[];
  note?: string;
}

export type Portion =
  | { kind: 'food'; foodId: string; grams: number }
  | { kind: 'dish'; dishId: string; servings: number };

export interface Catalogue {
  foods: Record<string, Food>;
  dishes: Record<string, Dish>;
}

export interface Source {
  id: string;
  citation: string;
  url: string;
}

export interface RuleContext {
  sex: Sex;
  totals: Nutrients;
}

export type EffectId =
  | 'chew' | 'amylase' | 'peristalsis' | 'pepsin' | 'drain' | 'drain4h' | 'seep'
  | 'chop-carbs' | 'chop-protein' | 'emulsify' | 'villi' | 'absorb-fast' | 'absorb-partial'
  | 'portal' | 'lymph' | 'circulate' | 'ferment' | 'idle-bacteria';

export interface Rule {
  id: string;
  station: StationId;
  when: (ctx: RuleContext) => boolean;
  text: (ctx: RuleContext) => string;
  sourceIds: string[];
  effect: EffectId | null;
}

export interface Caption {
  ruleId: string;
  text: string;
  sourceIds: string[];
}

export interface StarTrigger {
  star: StarId;
  station: StationId;
  when: (totals: Nutrients) => boolean;
}

export interface Stream {
  nutrient: Nutrient;
  amount: number;
}

export interface Beat {
  ruleId: string;
  effect: EffectId | null;
  seconds: number;
  star: StarId | null;
}

export interface Station {
  id: StationId;
  captions: Caption[];
  streams: Stream[];
  stars: StarId[];
  beats: Beat[];
  dwellSeconds: number;
}

export interface Journey {
  sex: Sex;
  totals: Nutrients;
  stations: Station[];
}
