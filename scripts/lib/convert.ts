import type { DetailId, Food, MeasuredPer100g } from '@/engine/types';

const num = (value: string | undefined): number => {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : 0;
};

const round4 = (value: number): number => Number(value.toPrecision(4));

const present = (value: string | undefined): number | undefined => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const ANIMAL_GROUPS = new Set([
  'Milk and Milk Products',
  'Egg and Egg Products',
  'Poultry',
  'Animal Meat',
  'Marine Fish',
  'Marine Shellfish',
  'Marine Mollusks',
  'Fresh Water Fish and Shellfish',
]);
const ANIMAL_FAT_NAME = /\b(ghee|butter|lard|tallow)\b/i;

const isAnimalDerived = (row: Record<string, string>): boolean =>
  ANIMAL_GROUPS.has(row['Food Group; grup']) ||
  row['Food Code; code'] === 'T013' ||
  ANIMAL_FAT_NAME.test(row['Food Name; name'] ?? '');

const IFCT_SCALED: readonly (readonly [DetailId, string, number])[] = [
  ['carbs', 'Carbohydrate; choavldf', 1],
  ['sugar', 'Free Sugars; fsugar', 1],
  ['fibre', 'Dietary Fiber; fibtg', 1],
  ['protein', 'Protein; protcnt', 1],
  ['fat', 'Total Fat; fatce', 1],
  ['satFat', 'Saturated Fatty acids; fasat', 1],
  ['cholesterol', 'Cholesterol; cholc', 1000],
  ['calcium', 'Calcium (Ca); ca', 1000],
  ['iron', 'Iron (Fe); fe', 1000],
  ['magnesium', 'Magnesium (Mg); mg', 1000],
  ['phosphorus', 'Phosphorus (P); p', 1000],
  ['potassium', 'Potassium (K); k', 1000],
  ['sodium', 'Sodium (Na); na', 1000],
  ['zinc', 'Zinc (Zn); zn', 1000],
  ['vitaminC', 'Ascorbic acids (C); vitc', 1000],
  ['vitaminD', 'Vitamin D; vitd', 1e6],
  ['vitaminE', 'α-Tocopherol equivalent (E); vite', 1000],
  ['vitaminK', 'Vitamin K; vitk', 1e6],
  ['thiamin', 'Thiamine (B1); thia', 1000],
  ['riboflavin', 'Riboflavin (B2); ribf', 1000],
  ['niacin', 'Niacin (B3); nia', 1000],
  ['folate', 'Folates (B9); folsum', 1e6],
];

const ZERO_MEANS_UNMEASURED: ReadonlySet<DetailId> = new Set(['cholesterol', 'vitaminD']);

const UNANALYSED_ZERO: Readonly<Record<string, readonly DetailId[]>> = {
  'Edible Oils and Fats': ['vitaminE', 'vitaminK'],
  'Animal Meat': ['folate', 'vitaminC'],
  Poultry: ['vitaminC'],
  'Marine Fish': ['folate'],
  'Marine Shellfish': ['folate'],
  'Marine Mollusks': ['folate'],
  'Fresh Water Fish and Shellfish': ['folate'],
};

function ifctMeasured(row: Record<string, string>): MeasuredPer100g {
  const animal = isAnimalDerived(row);
  const out: MeasuredPer100g = {};
  for (const [id, column, scale] of IFCT_SCALED) {
    const value = present(row[column]);
    if (value === undefined) continue;
    if (animal && value === 0 && ZERO_MEANS_UNMEASURED.has(id)) continue;
    if (value === 0 && UNANALYSED_ZERO[row['Food Group; grup']]?.includes(id)) continue;
    out[id] = round4(value * scale);
  }
  const retinol = present(row['Retinol; retol']);
  const carotene = present(row['β-Carotene equivalents; cartbeq']);
  const retinolUnmeasured = animal && (retinol === undefined || retinol === 0);
  if (!retinolUnmeasured && (retinol !== undefined || carotene !== undefined)) {
    out.vitaminA = round4(((retinol ?? 0) + (carotene ?? 0) / 12) * 1e6);
  }
  return out;
}

const KJ_PER_KCAL = 4.184;
const ATWATER_KJ_PER_G = { protein: 17, carbs: 17, fat: 37, fibre: 8 } as const;

export function foodFromIfct(row: Record<string, string>): Food {
  const sugar = num(row['Free Sugars; fsugar']);
  const starch = num(row['Starch; starch']);
  const protein = num(row['Protein; protcnt']);
  const fat = num(row['Total Fat; fatce']);
  const fibre = num(row['Dietary Fiber; fibtg']);
  const carbs = num(row['Carbohydrate; choavldf']);
  const measuredKj = num(row['Energy; enerc']);
  const energyKj =
    measuredKj > 0
      ? measuredKj
      : protein * ATWATER_KJ_PER_G.protein + carbs * ATWATER_KJ_PER_G.carbs + fat * ATWATER_KJ_PER_G.fat + fibre * ATWATER_KJ_PER_G.fibre;
  return {
    id: `ifct:${row['Food Code; code']}`,
    name: row['Food Name; name'],
    source: 'ifct',
    kcalPer100g: Math.round(energyKj / KJ_PER_KCAL),
    per100g: {
      sugar,
      starch: starch > 0 ? starch : Math.max(0, carbs - sugar),
      protein,
      fat,
      fibre,
      alcohol: 0,
      caffeine: 0,
      iron: num(row['Iron (Fe); fe']) * 1000,
    },
    measured: ifctMeasured(row),
  };
}

export const USDA_NUTRIENT_IDS = {
  protein: '1003',
  fat: '1004',
  carbs: '1005',
  kcal: '1008',
  starch: '1009',
  alcohol: '1018',
  caffeine: '1057',
  fibre: '1079',
  iron: '1089',
  sugar: '2000',
} as const;

export const USDA_MEASURED_IDS: Readonly<Record<Exclude<DetailId, 'carbs'>, string>> = {
  sugar: '2000',
  fibre: '1079',
  protein: '1003',
  fat: '1004',
  satFat: '1258',
  cholesterol: '1253',
  calcium: '1087',
  iron: '1089',
  magnesium: '1090',
  phosphorus: '1091',
  potassium: '1092',
  sodium: '1093',
  zinc: '1095',
  vitaminA: '1106',
  vitaminC: '1162',
  vitaminD: '1114',
  vitaminE: '1109',
  vitaminK: '1185',
  thiamin: '1165',
  riboflavin: '1166',
  niacin: '1167',
  folate: '1177',
  vitaminB12: '1178',
};

const MIN_DERIVED_STARCH_G = 5;

function usdaMeasured(values: Map<string, number>): MeasuredPer100g {
  const out: MeasuredPer100g = {};
  for (const [id, nutrientId] of Object.entries(USDA_MEASURED_IDS) as [Exclude<DetailId, 'carbs'>, string][]) {
    const value = values.get(nutrientId);
    if (value !== undefined && Number.isFinite(value)) out[id] = round4(value);
  }
  const byDifference = values.get(USDA_NUTRIENT_IDS.carbs);
  const fibre = values.get(USDA_NUTRIENT_IDS.fibre);
  if (byDifference !== undefined && fibre !== undefined) out.carbs = round4(Math.max(0, byDifference - fibre));
  return out;
}

const DRINK_LEADING_SEGMENT = /^(alcoholic beverage|beverages?\b)|\b(juice|drink|liqueur|wine|beer|sake|shake|smoothie)\b/i;

const NON_STARCHY_SWEET = /\b(syrups?|sweeteners?|sugars?)\b|^cocoa mix\b/i;

const BABYFOOD_SNACK = /\btreats?\b/i;

function isDrink(description: string): boolean {
  const [first, second = ''] = description.split(',').map((part) => part.trim());
  if (DRINK_LEADING_SEGMENT.test(first) || NON_STARCHY_SWEET.test(first)) return true;
  if (/^milk$/i.test(first) && /\bchocolate\b/i.test(second)) return true;
  return /^babyfood$/i.test(first) && !BABYFOOD_SNACK.test(second) && DRINK_LEADING_SEGMENT.test(second);
}

function usdaStarch(description: string, values: Map<string, number>): number {
  const measured = values.get(USDA_NUTRIENT_IDS.starch);
  if (measured !== undefined) return measured;
  if (isDrink(description)) return 0;
  const sugar = values.get(USDA_NUTRIENT_IDS.sugar);
  const carbs = values.get(USDA_NUTRIENT_IDS.carbs);
  if (sugar === undefined || carbs === undefined) return 0;
  const remainder = Math.max(0, carbs - sugar - (values.get(USDA_NUTRIENT_IDS.fibre) ?? 0));
  return remainder >= MIN_DERIVED_STARCH_G ? remainder : 0;
}

export function foodFromUsda(fdcId: string, description: string, values: Map<string, number>): Food {
  const get = (key: keyof typeof USDA_NUTRIENT_IDS): number => values.get(USDA_NUTRIENT_IDS[key]) ?? 0;
  const sugar = get('sugar');
  const fibre = get('fibre');
  return {
    id: `usda:${fdcId}`,
    name: description,
    source: 'usda',
    kcalPer100g: Math.round(get('kcal')),
    per100g: {
      sugar,
      starch: usdaStarch(description, values),
      protein: get('protein'),
      fat: get('fat'),
      fibre,
      alcohol: get('alcohol'),
      caffeine: get('caffeine'),
      iron: get('iron'),
    },
    measured: usdaMeasured(values),
  };
}
