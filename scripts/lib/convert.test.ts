import { describe, expect, it } from 'vitest';
import { USDA_NUTRIENT_IDS, foodFromIfct, foodFromUsda } from './convert';

const riceRow: Record<string, string> = {
  'Food Code; code': 'A015',
  'Food Name; name': 'Rice, raw, milled',
  'Energy; enerc': '1491',
  'Total Fat; fatce': '0.52',
  'Dietary Fiber; fibtg': '2.81',
  'Carbohydrate; choavldf': '78.24',
  'Protein; protcnt': '7.94',
  'Starch; starch': '75.7',
  'Free Sugars; fsugar': '0.69',
  'Iron (Fe); fe': '0.00065',
  'Caffeic acid; caffac': '12',
};

describe('foodFromIfct', () => {
  it('converts units and ignores caffeic acid', () => {
    const rice = foodFromIfct(riceRow);
    expect(rice.id).toBe('ifct:A015');
    expect(rice.kcalPer100g).toBe(356);
    expect(rice.per100g.iron).toBeCloseTo(0.65);
    expect(rice.per100g.starch).toBeCloseTo(75.7);
    expect(rice.per100g.caffeine).toBe(0);
    expect(rice.per100g.alcohol).toBe(0);
  });

  it('derives energy from macros when the measured energy is zero', () => {
    const oil = foodFromIfct({ 'Food Code; code': 'T012', 'Food Name; name': 'Sunflower oil', 'Energy; enerc': '0', 'Total Fat; fatce': '100' });
    expect(oil.kcalPer100g).toBe(884);
  });

  it('derives starch from available carbs when starch is blank', () => {
    const food = foodFromIfct({ ...riceRow, 'Starch; starch': '' });
    expect(food.per100g.starch).toBeCloseTo(78.24 - 0.69);
  });
});

describe('foodFromUsda', () => {
  it('maps nutrient ids and reports unmeasured starch as 0', () => {
    const values = new Map<string, number>([
      [USDA_NUTRIENT_IDS.kcal, 43],
      [USDA_NUTRIENT_IDS.carbs, 3.55],
      [USDA_NUTRIENT_IDS.alcohol, 3.9],
      [USDA_NUTRIENT_IDS.protein, 0.46],
    ]);
    const beer = foodFromUsda('168746', 'Alcoholic beverage, beer, regular, all', values);
    expect(beer.id).toBe('usda:168746');
    expect(beer.per100g.alcohol).toBe(3.9);
    expect(beer.per100g.starch).toBe(0);
    expect(beer.per100g.fibre).toBe(0);
  });

  it('does not invent starch from carbs by difference (red wine)', () => {
    const values = new Map<string, number>([
      [USDA_NUTRIENT_IDS.carbs, 2.61],
      [USDA_NUTRIENT_IDS.sugar, 0.62],
    ]);
    const wine = foodFromUsda('2', 'Alcoholic beverage, wine, table, red', values);
    expect(wine.per100g.sugar).toBe(0.62);
    expect(wine.per100g.starch).toBe(0);
  });

  it('keeps measured starch and caffeine', () => {
    const values = new Map<string, number>([
      [USDA_NUTRIENT_IDS.carbs, 50],
      [USDA_NUTRIENT_IDS.starch, 40],
      [USDA_NUTRIENT_IDS.caffeine, 40],
    ]);
    const food = foodFromUsda('1', 'x', values);
    expect(food.per100g.starch).toBe(40);
    expect(food.per100g.caffeine).toBe(40);
  });
});

const ifct = (extra: Record<string, string>): Record<string, string> => ({
  'Food Code; code': 'X001',
  'Food Name; name': 'Test food',
  'Food Group; grup': 'Cereals and Millets',
  ...extra,
});

describe('foodFromIfct measured', () => {
  it('leaves a blank cell absent and keeps a measured zero', () => {
    expect(foodFromIfct(ifct({ 'Saturated Fatty acids; fasat': '' })).measured).not.toHaveProperty('satFat');
    expect(foodFromIfct(ifct({ 'Saturated Fatty acids; fasat': '0' })).measured?.satFat).toBe(0);
  });

  it('converts grams to mg and µg', () => {
    const m = foodFromIfct(ifct({ 'Calcium (Ca); ca': '0.00749', 'Ascorbic acids (C); vitc': '0.03028', 'Folates (B9); folsum': '0.000142' })).measured;
    expect(m?.calcium).toBeCloseTo(7.49, 6);
    expect(m?.vitaminC).toBeCloseTo(30.28, 6);
    expect(m?.folate).toBeCloseTo(142, 6);
  });

  it('computes vitamin A as RAE', () => {
    expect(foodFromIfct(ifct({ 'Retinol; retol': '0.00018', 'β-Carotene equivalents; cartbeq': '0.0000143' })).measured?.vitaminA).toBeCloseTo(181.2, 1);
    expect(foodFromIfct(ifct({ 'Retinol; retol': '', 'β-Carotene equivalents; cartbeq': '0.0026' })).measured?.vitaminA).toBeCloseTo(216.7, 1);
    expect(foodFromIfct(ifct({ 'Retinol; retol': '', 'β-Carotene equivalents; cartbeq': '' })).measured).not.toHaveProperty('vitaminA');
  });

  it('never produces vitamin B12', () => {
    expect(foodFromIfct(ifct({ 'Protein; protcnt': '5' })).measured).not.toHaveProperty('vitaminB12');
  });

  it('treats zero cholesterol, retinol and vitamin D of animal foods as not measured', () => {
    const zeros = { 'Cholesterol; cholc': '0', 'Retinol; retol': '0', 'Vitamin D; vitd': '0', 'β-Carotene equivalents; cartbeq': '0.00001' };
    const milk = foodFromIfct(ifct({ ...zeros, 'Food Group; grup': 'Milk and Milk Products', 'Food Name; name': 'Milk, whole, Cow' })).measured;
    expect(milk).not.toHaveProperty('cholesterol');
    expect(milk).not.toHaveProperty('vitaminA');
    expect(milk).not.toHaveProperty('vitaminD');
    const ghee = foodFromIfct(ifct({ ...zeros, 'Food Code; code': 'T013', 'Food Name; name': 'Ghee', 'Food Group; grup': 'Edible Oils and Fats' })).measured;
    expect(ghee).not.toHaveProperty('cholesterol');
    const plant = foodFromIfct(ifct({ ...zeros })).measured;
    expect(plant?.cholesterol).toBe(0);
    expect(plant?.vitaminD).toBe(0);
    expect(plant?.vitaminA).toBeCloseTo(0.8333, 3);
    const egg = foodFromIfct(ifct({ 'Cholesterol; cholc': '0.365', 'Retinol; retol': '0.00018', 'Food Group; grup': 'Egg and Egg Products', 'Food Name; name': 'Egg, poultry, whole, boiled' })).measured;
    expect(egg?.cholesterol).toBe(365);
    expect(egg?.vitaminA).toBe(180);
  });

  it('treats zeros in groups where the vitamin was never analysed as not measured', () => {
    const zeros = { 'α-Tocopherol equivalent (E); vite': '0', 'Vitamin K; vitk': '0', 'Folates (B9); folsum': '0', 'Ascorbic acids (C); vitc': '0' };
    const measured = (group: string) => foodFromIfct(ifct({ ...zeros, 'Food Group; grup': group, 'Food Name; name': 'x' })).measured;
    const oil = measured('Edible Oils and Fats');
    expect(oil).not.toHaveProperty('vitaminE');
    expect(oil).not.toHaveProperty('vitaminK');
    expect(oil?.folate).toBe(0);
    expect(oil?.vitaminC).toBe(0);
    const meat = measured('Animal Meat');
    expect(meat).not.toHaveProperty('folate');
    expect(meat).not.toHaveProperty('vitaminC');
    expect(meat?.vitaminE).toBe(0);
    const poultry = measured('Poultry');
    expect(poultry).not.toHaveProperty('vitaminC');
    expect(poultry?.folate).toBe(0);
    for (const group of ['Marine Fish', 'Marine Shellfish', 'Marine Mollusks', 'Fresh Water Fish and Shellfish']) {
      expect(measured(group), group).not.toHaveProperty('folate');
      expect(measured(group)?.vitaminC, group).toBe(0);
    }
    const cereal = measured('Cereals and Millets');
    expect(cereal?.vitaminE).toBe(0);
    expect(cereal?.folate).toBe(0);
  });

  it('keeps a real value in a group where zeros are unanalysed', () => {
    const liver = foodFromIfct(ifct({ 'Food Group; grup': 'Poultry', 'Folates (B9); folsum': '0.001032', 'Food Name; name': 'Poultry, chicken, liver' })).measured;
    expect(liver?.folate).toBe(1032);
  });

  it('does not mistake "collard" for lard', () => {
    const greens = foodFromIfct(ifct({ 'Food Name; name': 'Cabbage, collard greens', 'Food Group; grup': 'Green Leafy Vegetables', 'Cholesterol; cholc': '0', 'Retinol; retol': '0', 'β-Carotene equivalents; cartbeq': '0.0026' })).measured;
    expect(greens?.cholesterol).toBe(0);
    expect(greens?.vitaminA).toBeCloseTo(216.7, 1);
  });

  it('rounds to 4 significant figures', () => {
    expect(foodFromIfct(ifct({ 'Calcium (Ca); ca': '0.0074912345' })).measured?.calcium).toBe(7.491);
  });
});

describe('foodFromUsda measured', () => {
  it('copies present ids, omits absent ones, and derives carbs without fibre', () => {
    const m = foodFromUsda('1', 'x', new Map([['1177', 12.34567], ['1005', 20], ['1079', 3]])).measured;
    expect(m?.folate).toBe(12.35);
    expect(m).not.toHaveProperty('vitaminB12');
    expect(m?.carbs).toBe(17);
    expect(foodFromUsda('1', 'x', new Map([['1178', 0.5]])).measured?.vitaminB12).toBe(0.5);
  });

  it('floors carbs at 0 and omits them when carbs or fibre is missing', () => {
    expect(foodFromUsda('1', 'x', new Map([['1005', 1], ['1079', 3]])).measured?.carbs).toBe(0);
    expect(foodFromUsda('1', 'x', new Map([['1005', 10]])).measured).not.toHaveProperty('carbs');
    expect(foodFromUsda('1', 'x', new Map([['1079', 3]])).measured).not.toHaveProperty('carbs');
  });

  it('derives starch only for foods with a large carbohydrate remainder', () => {
    const starch = (carbs: number, sugar?: number, fibre?: number, measured?: number): number => {
      const values = new Map<string, number>([['1005', carbs]]);
      if (sugar !== undefined) values.set('2000', sugar);
      if (fibre !== undefined) values.set('1079', fibre);
      if (measured !== undefined) values.set('1009', measured);
      return foodFromUsda('1', 'x', values).per100g.starch;
    };
    expect(starch(49.2, 5.7, 2.7)).toBeCloseTo(40.8, 6);
    expect(starch(2.61, 0.62)).toBe(0);
    expect(starch(10.6, 10.6)).toBe(0);
    expect(starch(10.4, 8.4, 0.2)).toBe(0);
    expect(starch(27.5)).toBe(0);
    expect(starch(49.2, 5.7, 2.7, 12)).toBe(12);
    expect(starch(49.2, 5.7, 2.7, 0)).toBe(0);
  });
});

describe('USDA starch is never derived for drinks and drink mixes', () => {
  const values = (carbs: number, sugar: number, fibre: number, starch?: number): Map<string, number> => {
    const map = new Map<string, number>([['1005', carbs], ['2000', sugar], ['1079', fibre]]);
    if (starch !== undefined) map.set('1009', starch);
    return map;
  };
  const drinks: readonly [string, string, number, number, number][] = [
    ['167723', 'Alcoholic beverage, rice (sake)', 5, 0, 0],
    ['175112', 'Alcoholic beverage, wine, dessert, dry', 11.67, 1.09, 0],
    ['173176', 'Alcoholic beverage, wine, dessert, sweet', 13.69, 7.78, 0],
    ['175097', 'Alcoholic beverage, liqueur, coffee, 53 proof', 46.8, 38.3, 0],
    ['171893', 'Beverages, coffee, instant, regular, powder', 75.4, 0, 0],
    ['174133', 'Beverages, coffee, instant, decaffeinated, powder', 76, 0, 0],
    ['171873', 'Beverages, chocolate drink, milk and soy based, ready to drink, fortified', 17.3, 8.44, 1.3],
    ['174823', 'Beverages, ABBOTT, ENSURE, Nutritional Shake, Ready-to-Drink', 16.88, 9.7, 0],
    ['171882', 'Beverages, Clam and tomato juice, canned', 10.95, 3.31, 0.4],
  ];

  it.each(drinks)('usda:%s %s has starch 0', (id, name, carbs, sugar, fibre) => {
    expect(foodFromUsda(id, name, values(carbs, sugar, fibre)).per100g.starch).toBe(0);
  });

  it('derives starch for a synthetic bread-like fixture (real white bread has measured starch)', () => {
    expect(foodFromUsda('174924', 'Bread, white, commercially prepared', values(49.42, 5.67, 2.7)).per100g.starch).toBeCloseTo(41.05, 6);
  });

  it('keeps a measured starch on a drink description', () => {
    expect(foodFromUsda('1', 'Beverages, malted drink mix', values(80, 40, 0, 22)).per100g.starch).toBe(22);
  });

  it('matches drink words only as whole words in the leading segment', () => {
    expect(foodFromUsda('1', 'Beerwurst, pork and beef', values(30, 2, 1)).per100g.starch).toBeCloseTo(27, 6);
    expect(foodFromUsda('1', 'Milk shakes, thick chocolate', values(30, 2, 1)).per100g.starch).toBeCloseTo(27, 6);
    expect(foodFromUsda('1', 'Beer, regular', values(30, 2, 1)).per100g.starch).toBe(0);
  });

  it('only looks at the leading segment, so drink words later in the name do not zero a food', () => {
    const foods: readonly [string, string, number, number, number, number][] = [
      ['174959', 'Cookies, ladyfingers, with lemon juice and rind', 59.7, 25.39, 1, 33.31],
      ['170280', 'Jams, preserves, marmalades, sweetened with fruit juice', 52.93, 42, 0.9, 10.03],
      ['170255', 'Frozen novelties, juice type, POPSICLE SCRIBBLERS', 19.68, 14.57, 0, 5.11],
      ['173478', 'Babyfood, juice treats, fruit medley, toddler', 86.68, 57.4, 0, 29.28],
    ];
    for (const [id, name, carbs, sugar, fibre, expected] of foods) {
      expect(foodFromUsda(id, name, values(carbs, sugar, fibre)).per100g.starch, id).toBeCloseTo(expected, 6);
    }
  });

  it('treats "Babyfood, juice, ..." as a drink but baby-food juice treats as a snack', () => {
    expect(foodFromUsda('171353', 'Babyfood, juice, apple and prune', values(18.1, 10.58, 0.1)).per100g.starch).toBe(0);
    expect(foodFromUsda('1', 'Babyfood, grape juice, no sugar, canned', values(17, 10, 0.1)).per100g.starch).toBe(0);
    expect(foodFromUsda('173478', 'Babyfood, juice treats, fruit medley, toddler', values(86.68, 57.4, 0)).per100g.starch).toBeCloseTo(29.28, 6);
  });

  it('gives sweeteners, syrups, sugars, cocoa mix and chocolate milk no derived starch', () => {
    const foods: readonly [string, string, number, number, number][] = [
      ['170679', 'Sweetener, herbal extract powder from Stevia leaf', 100, 0, 0],
      ['168088', 'Syrups, grenadine', 46.55, 46.55, 0],
      ['169658', 'Sugars, maple', 90.9, 84.87, 0],
      ['171887', 'Cocoa mix, NESTLE, Rich Chocolate Hot Cocoa Mix', 82, 60, 0.4],
      ['171303', 'Milk, chocolate, fat free, with added vitamin A and vitamin D', 13.6, 8.39, 0.1],
    ];
    for (const [id, name, carbs, sugar, fibre] of foods) {
      expect(foodFromUsda(id, name, values(carbs, sugar, fibre)).per100g.starch, id).toBe(0);
    }
  });

  it('still derives starch for plain milk-like and bakery names', () => {
    expect(foodFromUsda('1', 'Milk, evaporated, 2% fat', values(30, 6, 1)).per100g.starch).toBeCloseTo(23, 6);
    expect(foodFromUsda('2', 'Bagels, plain, enriched', values(55, 6, 2.3)).per100g.starch).toBeCloseTo(46.7, 6);
  });

  it('keeps starch 0 for the Shake N Bake coating because its sugar was not measured', () => {
    expect(foodFromUsda('167514', 'Kraft Foods, Shake N Bake Original Recipe, Coating for Pork, dry', new Map([['1005', 79.8]])).per100g.starch).toBe(0);
  });
});

describe('measured edge cases', () => {
  it('keeps an explicit USDA zero', () => {
    const m = foodFromUsda('1', 'x', new Map([['2000', 0], ['1178', 0]])).measured;
    expect(m?.sugar).toBe(0);
    expect(m?.vitaminB12).toBe(0);
  });

  it('applies the animal zero rule by name alone, without matching collard', () => {
    const zeros = { 'Cholesterol; cholc': '0', 'Retinol; retol': '0', 'Vitamin D; vitd': '0' };
    const butter = foodFromIfct(ifct({ ...zeros, 'Food Name; name': 'Butter, salted', 'Food Group; grup': 'Sugars' })).measured;
    expect(butter).not.toHaveProperty('cholesterol');
    expect(butter).not.toHaveProperty('vitaminA');
    expect(butter).not.toHaveProperty('vitaminD');
    const greens = foodFromIfct(ifct({ ...zeros, 'Food Name; name': 'Cabbage, collard greens', 'Food Group; grup': 'Green Leafy Vegetables' })).measured;
    expect(greens?.cholesterol).toBe(0);
    expect(greens?.vitaminD).toBe(0);
  });
});
