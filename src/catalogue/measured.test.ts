import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DETAILS } from '@/engine/details';
import type { Food } from '@/engine/types';

const foods = JSON.parse(readFileSync('public/data/foods.json', 'utf8')) as Food[];
const byId = new Map(foods.map((f) => [f.id, f]));
const food = (id: string): Food => {
  const found = byId.get(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};
const inRange = (id: string, key: keyof NonNullable<Food['measured']>, lo: number, hi: number): void => {
  const value = food(id).measured?.[key];
  expect(value, `${id} ${key}`).toBeGreaterThanOrEqual(lo);
  expect(value, `${id} ${key}`).toBeLessThanOrEqual(hi);
};

describe('DETAILS', () => {
  it('lists the 24 ids once each with the right units and groups', () => {
    expect(DETAILS.map((d) => d.id)).toEqual([
      'carbs', 'sugar', 'fibre', 'protein', 'fat', 'satFat', 'cholesterol',
      'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'sodium', 'zinc',
      'vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK',
      'thiamin', 'riboflavin', 'niacin', 'folate', 'vitaminB12',
    ]);
    expect(DETAILS).toHaveLength(24);
    expect(new Set(DETAILS.map((d) => d.id)).size).toBe(24);
    const unit = (id: string) => DETAILS.find((d) => d.id === id)?.unit;
    for (const id of ['carbs', 'sugar', 'fibre', 'protein', 'fat', 'satFat']) expect(unit(id)).toBe('g');
    for (const id of ['cholesterol', 'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'sodium', 'zinc', 'vitaminC', 'vitaminE', 'thiamin', 'riboflavin', 'niacin']) expect(unit(id)).toBe('mg');
    for (const id of ['vitaminA', 'vitaminD', 'vitaminK', 'folate', 'vitaminB12']) expect(unit(id)).toBe('µg');
    expect(DETAILS.slice(0, 7).every((d) => d.group === 'macro')).toBe(true);
    expect(DETAILS.slice(7, 14).every((d) => d.group === 'mineral')).toBe(true);
    expect(DETAILS.slice(14).every((d) => d.group === 'vitamin')).toBe(true);
  });
});

describe('generated foods.json', () => {
  it('does not store unmeasured animal cholesterol as zero', () => {
    for (const id of ['ifct:L002', 'ifct:L003', 'ifct:T013']) expect(food(id).measured).not.toHaveProperty('cholesterol');
  });

  it('does not store never-analysed IFCT zeros as measured', () => {
    expect(food('ifct:T012').measured).not.toHaveProperty('vitaminE');
    expect(food('ifct:T012').measured).not.toHaveProperty('vitaminK');
    expect(food('ifct:T011').measured).not.toHaveProperty('vitaminK');
    expect(food('ifct:O008').measured).not.toHaveProperty('folate');
    expect(food('ifct:N005').measured?.folate).toBe(1032);
  });

  it('gives sweeteners and sweet mixes no derived starch', () => {
    for (const id of ['170679', '168088', '169658', '171887', '171303']) expect(food(`usda:${id}`).per100g.starch, id).toBe(0);
  });

  it('gives drinks and drink mixes no derived starch', () => {
    for (const id of ['167723', '175112', '173176', '175097', '171893', '174133', '171873', '174823', '171882']) {
      expect(food(`usda:${id}`).per100g.starch, id).toBe(0);
    }
  });

  it('gives breads starch and drinks none', () => {
    const bread = food('usda:174924').per100g.starch;
    expect(bread).toBeGreaterThanOrEqual(25);
    expect(bread).toBeLessThanOrEqual(55);
    expect(food('usda:173190').per100g.starch).toBe(0);
    expect(food('usda:174852').per100g.starch).toBe(0);
  });

  it('has plausible magnitudes', () => {
    inRange('ifct:C033', 'calcium', 30, 200);
    inRange('ifct:C033', 'vitaminC', 10, 80);
    inRange('ifct:C033', 'vitaminK', 100, 700);
    inRange('ifct:L002', 'calcium', 80, 160);
    inRange('ifct:A015', 'iron', 0.2, 2);
    inRange('ifct:A015', 'calcium', 2, 20);
    inRange('ifct:M004', 'vitaminA', 50, 400);
    expect(food('ifct:M004').measured).not.toHaveProperty('vitaminB12');
    inRange('usda:169098', 'vitaminC', 30, 70);
    inRange('usda:171284', 'calcium', 80, 200);
    inRange('usda:171284', 'vitaminB12', 0.2, 1.5);
    inRange('usda:171890', 'potassium', 40, 150);
  });

  it('keeps every measured value to 4 significant figures', () => {
    for (const f of foods) {
      for (const value of Object.values(f.measured ?? {})) expect(Number(value.toPrecision(4))).toBe(value);
    }
  });
});
