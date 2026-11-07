import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import dishList from '@/data/dishes.json';
import { emptyNutrients } from '@/engine/totals';
import type { Catalogue, Dish, Food, Nutrients, Portion } from '@/engine/types';
import { DISH_LOOKS, lookForFood, looksFor } from '@/scene/food/look';
import type { FoodLookBase, FoodModelId } from '@/scene/food/types';

const MODELS: Record<FoodModelId, true> = {
  samosa: true, flatbread: true, rice: true, 'bowl-curry': true, 'bowl-white': true, 'cup-hot': true,
  'glass-drink': true, 'glass-beer': true, 'glass-wine': true, egg: true, banana: true, apple: true,
  idli: true, poha: true, cubes: true, greens: true, fries: true, bread: true, fruit: true, meat: true,
  fish: true, chunk: true,
};

const dishes = dishList as Dish[];
const realFoods = JSON.parse(readFileSync('public/data/foods.json', 'utf8')) as Food[];
const real: Catalogue = {
  foods: Object.fromEntries(realFoods.map((f) => [f.id, f])),
  dishes: Object.fromEntries(dishes.map((d) => [d.id, d])),
};

const per = (values: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...values });
const food = (id: string, name: string, values: Partial<Nutrients> = {}): Food => ({
  id,
  name,
  source: 'usda',
  kcalPer100g: 100,
  per100g: per(values),
});
const dish = (dishId: string, servings = 1): Portion => ({ kind: 'dish', dishId, servings });
const gram = (foodId: string, grams: number): Portion => ({ kind: 'food', foodId, grams });
const sum = (shares: { share: number }[]) => shares.reduce((a, l) => a + l.share, 0);
const validColour = (c: number) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
const expectValid = (look: FoodLookBase) => {
  expect(MODELS[look.model]).toBe(true);
  expect(look.colors.length).toBeGreaterThanOrEqual(1);
  expect(look.colors.length).toBeLessThanOrEqual(3);
  for (const c of [...look.colors, look.chyme]) expect(validColour(c)).toBe(true);
};

describe('DISH_LOOKS', () => {
  it('has a valid look for every dish', () => {
    for (const d of dishes) {
      const look = DISH_LOOKS[d.id];
      expect(look, d.id).toBeDefined();
      if (look) expectValid(look);
    }
  });

  it('flags drinks and the soupy dal as liquid, solids as not', () => {
    for (const id of ['chai', 'black-coffee', 'cola', 'beer', 'red-wine', 'orange-juice', 'toor-dal']) {
      expect(DISH_LOOKS[id]?.liquid, id).toBe(true);
    }
    for (const id of ['samosa', 'roti', 'white-rice', 'paneer', 'apple', 'oats']) {
      expect(DISH_LOOKS[id]?.liquid, id).toBe(false);
    }
  });

  it('maps the signature dishes to their models', () => {
    expect(DISH_LOOKS['samosa']?.model).toBe('samosa');
    expect(DISH_LOOKS['black-coffee']?.model).toBe('cup-hot');
    expect(DISH_LOOKS['beer']?.model).toBe('glass-beer');
    expect(DISH_LOOKS['red-wine']?.model).toBe('glass-wine');
    expect(DISH_LOOKS['roti']?.model).toBe('flatbread');
    expect(DISH_LOOKS['brown-rice']?.model).toBe('rice');
  });
});

describe('lookForFood keywords', () => {
  const cases: [string, FoodModelId][] = [
    ['Rice, raw, milled', 'rice'],
    ['Beef, ground, 85% lean meat / 15% fat, raw', 'meat'],
    ['Chicken, broilers or fryers, breast, cooked, fried in vegetable oil', 'meat'],
    ['Fish, tuna, light, canned in oil, drained solids', 'fish'],
    ['Crustaceans, shrimp, cooked', 'fish'],
    ['Egg, poultry, whole, boiled', 'egg'],
    ['Apples, raw, with skin', 'apple'],
    ['Banana, ripe, robusta', 'banana'],
    ['Oranges, raw, all commercial varieties', 'fruit'],
    ['Pineapple, raw', 'fruit'],
    ['Spinach, raw', 'greens'],
    ['Lettuce, cos or romaine, raw', 'greens'],
    ['Potatoes, french fried, all types, frozen, unprepared', 'fries'],
    ['Bread, white, commercially prepared', 'bread'],
    ['Bread, pita, white', 'flatbread'],
    ['Cereals, oats, regular and quick, not fortified, dry', 'bowl-white'],
    ['Red gram, dal', 'bowl-curry'],
    ['Beans, kidney, mature seeds, raw', 'bowl-curry'],
    ['Paneer', 'cubes'],
    ['Cheese, cheddar', 'cubes'],
    ['Yogurt, plain, whole milk', 'bowl-white'],
    ['Cookies, chocolate chip, commercially prepared', 'bread'],
    ['Sunflower oil', 'glass-drink'],
    ['Oil, olive, salad or cooking', 'glass-drink'],
    ['Ghee', 'chunk'],
  ];
  it.each(cases)('%s -> %s', (name, model) => {
    const look = lookForFood(food('x', name));
    expect(look.model).toBe(model);
    expectValid(look);
  });

  it('flags liquid foods', () => {
    for (const name of [
      'Milk, whole, Cow',
      'Beverages, coffee, brewed, prepared with tap water',
      'Beverages, tea, black, brewed, prepared with tap water',
      'Beverages, carbonated, cola, regular',
      'Alcoholic beverage, beer, regular, all',
      'Alcoholic beverage, wine, table, red',
      'Orange juice, raw',
      'Sunflower oil',
    ]) {
      expect(lookForFood(food('x', name)).liquid, name).toBe(true);
    }
    for (const name of ['Rice, raw, milled', 'Apples, raw', 'Paneer', 'Red gram, dal']) {
      expect(lookForFood(food('x', name)).liquid, name).toBe(false);
    }
  });

  it('picks drink models and lets juice beat the fruit', () => {
    expect(lookForFood(food('x', 'Alcoholic beverage, beer, regular, all')).model).toBe('glass-beer');
    expect(lookForFood(food('x', 'Alcoholic beverage, wine, table, red')).model).toBe('glass-wine');
    expect(lookForFood(food('x', 'Orange juice, raw')).liquid).toBe(true);
    expect(lookForFood(food('x', 'Orange juice, raw')).model).toBe('glass-drink');
    expect(lookForFood(food('x', 'Apple juice, canned')).model).toBe('glass-drink');
  });

  it('respects word boundaries, case and plurals', () => {
    expect(lookForFood(food('x', 'rIcE, RAW')).model).toBe('rice');
    expect(lookForFood(food('x', 'Eggplant, raw', { fibre: 3 })).model).not.toBe('egg');
    expect(lookForFood(food('x', 'Buttermilk, cultured')).liquid).toBe(true);
    expect(lookForFood(food('x', 'Peppers, hot chili')).model).not.toBe('rice');
  });
});

describe('lookForFood leading segment', () => {
  const cases: [string, FoodModelId, boolean][] = [
    ['Alcoholic beverage, rice (sake)', 'glass-wine', true],
    ['Alcoholic beverage, liqueur, coffee with cream, 53 proof', 'glass-wine', true],
    ['Beverages, rice milk, unsweetened', 'glass-drink', true],
    ['Beverages, OCEAN SPRAY, Diet Cran Cherry', 'glass-drink', true],
    ['Beverages, tea, black, brewed, prepared with distilled water', 'cup-hot', true],
    ['Cranberry juice cocktail, frozen concentrate', 'glass-drink', true],
    ['Fruit cocktail, (peach and pear), canned', 'fruit', false],
    ['Milk, chocolate, lowfat, reduced sugar', 'glass-drink', true],
    ['Infant formula, MEAD JOHNSON, ENFAMIL, with iron', 'glass-drink', true],
    ['Babyfood, juice, apple', 'glass-drink', true],
    ['Babyfood, fruit, pears, strained', 'fruit', false],
    ['Soup, tomato, canned, condensed', 'bowl-curry', true],
    ['Oil, sunflower, linoleic, (approx. 65%)', 'glass-drink', true],
    ['Fish oil, menhaden', 'glass-drink', true],
    ['Nuts, coconut cream, canned, sweetened', 'chunk', false],
    ['Cookies, peanut butter, commercially prepared', 'bread', false],
    ['Cheese puffs and twists, corn based, baked', 'bread', false],
    ['Snacks, tortilla chips, plain', 'bread', false],
    ['Mushrooms, shiitake, stir-fried', 'chunk', false],
    ['Spices, thyme, dried', 'chunk', false],
    ['Pasta, fresh-refrigerated, plain, cooked', 'chunk', false],
    ['Mustard greens, cooked, boiled', 'greens', false],
    ['Sweet potato, canned, mashed', 'chunk', false],
    ['Potatoes, mashed, dehydrated, granules without milk', 'bowl-white', false],
    ['Potatoes, french fried, all types, frozen', 'fries', false],
    ['Cream, sour, reduced fat, cultured', 'bowl-white', false],
    ['Groundcherries (cape-gooseberries or poha)', 'fruit', false],
    ["Andrea's, Gluten Free Soft Dinner Roll", 'bread', false],
    ['Squash, summer, zucchini, includes skin, raw', 'cubes', false],
    ['Cheese, cheddar, sharp, sliced', 'cubes', false],
  ];
  it.each(cases)('%s -> %s', (name, model, liquid) => {
    const found = lookForFood(food('x', name));
    expect(found.model).toBe(model);
    expect(found.liquid).toBe(liquid);
  });

  it('does not let a brand lead decide the look', () => {
    expect(lookForFood(food('x', 'OLIVE GARDEN, spaghetti with meat sauce')).model).not.toBe('fruit');
    expect(lookForFood(food('x', "McDONALD'S, McCHICKEN Sandwich")).model).toBe('bread');
  });

  it('keeps rice milk and sake out of the rice grains', () => {
    for (const name of ['Beverages, rice milk, unsweetened', 'Alcoholic beverage, rice (sake)']) {
      expect(lookForFood(food('x', name)).model).not.toBe('rice');
    }
  });
});

describe('lookForFood fallback', () => {
  const name = 'Zzyzx mystery matter';
  const looks = {
    fat: lookForFood(food('f', name, { fat: 60, protein: 2, starch: 5 })),
    protein: lookForFood(food('p', name, { protein: 30, fat: 5, starch: 2 })),
    carbs: lookForFood(food('c', name, { starch: 60, sugar: 5, protein: 5, fat: 1 })),
    fibre: lookForFood(food('v', name, { fibre: 25, starch: 5, protein: 5, fat: 1 })),
    empty: lookForFood(food('e', name)),
  };

  it('always returns a valid look', () => {
    for (const look of Object.values(looks)) expectValid(look);
  });

  it('picks by dominant macro with distinct colours', () => {
    const firsts = [looks.fat, looks.protein, looks.carbs, looks.fibre].map((l) => l.colors[0]);
    expect(new Set(firsts).size).toBe(4);
    expect(looks.fibre.model).toBe('greens');
    expect(looks.fat.liquid).toBe(false);
  });
});

describe('looksFor', () => {
  it('returns [] for an empty plate and for zero grams', () => {
    expect(looksFor(real, [])).toEqual([]);
    expect(looksFor(real, [gram('ifct:A015', 0)])).toEqual([]);
  });

  it('gives each dish exactly one look with the whole share', () => {
    for (const d of dishes) {
      const looks = looksFor(real, [dish(d.id)]);
      expect(looks, d.id).toHaveLength(1);
      expect(looks[0]?.id).toBe(d.id);
      expect(looks[0]?.name).toBe(d.name);
      expect(looks[0]?.share).toBeCloseTo(1);
      expect(looks[0]?.model).toBe(DISH_LOOKS[d.id]?.model);
    }
  });

  it('gives a single food its name-based look and the whole share', () => {
    const looks = looksFor(real, [gram('ifct:A015', 100)]);
    expect(looks).toHaveLength(1);
    expect(looks[0]).toMatchObject({ id: 'ifct:A015', name: 'Rice, raw, milled', model: 'rice', share: 1 });
  });

  it('uses gram shares that match the plate and sum to 1', () => {
    const looks = looksFor(real, [dish('samosa'), dish('chai', 1), dish('banana')]);
    expect(looks.map((l) => l.id)).toEqual(['chai', 'banana', 'samosa']);
    expect(looks.find((l) => l.id === 'chai')?.share).toBeCloseTo(188 / 423);
    expect(looks.find((l) => l.id === 'samosa')?.share).toBeCloseTo(115 / 423);
    expect(looks.find((l) => l.id === 'banana')?.share).toBeCloseTo(120 / 423);
    expect(sum(looks)).toBeCloseTo(1);
  });

  it('scales dishes by servings and mixes dishes with foods', () => {
    const looks = looksFor(real, [dish('chai', 2), gram('ifct:A015', 188)]);
    expect(looks.find((l) => l.id === 'chai')?.share).toBeCloseTo(376 / 564);
    expect(sum(looks)).toBeCloseTo(1);
  });

  it('merges duplicate portions into one look', () => {
    const looks = looksFor(real, [dish('chai'), dish('banana'), dish('chai')]);
    expect(looks).toHaveLength(2);
    expect(looks.find((l) => l.id === 'chai')?.share).toBeCloseTo(376 / 496);
  });

  it('falls back to the heaviest part for a dish without a hand-made look', () => {
    const cat: Catalogue = {
      foods: {
        a: food('a', 'Beef, ground, raw', { protein: 20 }),
        b: food('b', 'Sunflower oil', { fat: 100 }),
      },
      dishes: { mystery: { id: 'mystery', name: 'Mystery', parts: [{ foodId: 'a', grams: 90 }, { foodId: 'b', grams: 10 }] } },
    };
    const looks = looksFor(cat, [dish('mystery')]);
    expect(looks).toHaveLength(1);
    expect(looks[0]).toMatchObject({ id: 'mystery', name: 'Mystery', model: 'meat', share: 1 });
  });

  it('caps a 7-item meal at 6 looks, merging the smallest into a chunk', () => {
    const grams = [100, 90, 80, 70, 60, 20, 10];
    const cat: Catalogue = {
      foods: Object.fromEntries(grams.map((_, i) => [`f${i}`, food(`f${i}`, `Thing ${i}`, { starch: 10 })])),
      dishes: {},
    };
    const looks = looksFor(cat, grams.map((g, i) => gram(`f${i}`, g)));
    expect(looks).toHaveLength(6);
    expect(looks.slice(0, 5).map((l) => l.id)).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
    expect(looks[5]).toMatchObject({ model: 'chunk', liquid: false });
    expect(looks[5]?.share).toBeCloseTo(30 / 430);
    expect(looks[5]?.name).toContain('Thing 5');
    expect(looks[5]?.name).toContain('Thing 6');
    expect(sum(looks)).toBeCloseTo(1);
    for (const l of looks) expectValid(l);
  });

  it('does not merge when there are exactly 6 items', () => {
    const cat: Catalogue = {
      foods: Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [`f${i}`, food(`f${i}`, `Thing ${i}`)])),
      dishes: {},
    };
    const looks = looksFor(cat, [0, 1, 2, 3, 4, 5].map((i) => gram(`f${i}`, 10 + i)));
    expect(looks.map((l) => l.id)).toEqual(['f5', 'f4', 'f3', 'f2', 'f1', 'f0']);
  });

  it('throws the engine errors for unknown ids', () => {
    expect(() => looksFor(real, [gram('nope', 10)])).toThrow('Unknown food: nope');
    expect(() => looksFor(real, [dish('nope')])).toThrow('Unknown dish: nope');
  });

  it('is deterministic', () => {
    const plate = [dish('samosa'), dish('chai'), gram('ifct:A015', 80), dish('banana')];
    expect(looksFor(real, plate)).toEqual(looksFor(real, plate));
  });
});
