import { describe, expect, it } from 'vitest';
import { COPY } from '@/copy';
import { formatAmount, formatEnergy, formatPercent, legendAmount, LEGEND_UNIT, mixLabel, rowFor } from '@/ui/format';

describe('formatAmount', () => {
  it('shows an exact zero as 0', () => {
    expect(formatAmount(0, 'g')).toBe('0 g');
  });

  it('flags tiny amounts instead of rounding them to zero', () => {
    expect(formatAmount(0.04, 'g')).toBe('<0.1 g');
    expect(formatAmount(0.1, 'g')).toBe('0.1 g');
  });

  it('uses one decimal under 10 and drops a trailing .0', () => {
    expect(formatAmount(4.4, 'mg')).toBe('4.4 mg');
    expect(formatAmount(4.0, 'g')).toBe('4 g');
    expect(formatAmount(2, 'g')).toBe('2 g');
  });

  it('rounds up into the whole-number range cleanly', () => {
    expect(formatAmount(9.96, 'g')).toBe('10 g');
  });

  it('uses whole numbers from 10 up', () => {
    expect(formatAmount(10, 'g')).toBe('10 g');
    expect(formatAmount(123.6, 'g')).toBe('124 g');
  });

  it('appends the unit it is given', () => {
    expect(formatAmount(55, 'µg')).toBe('55 µg');
    expect(formatAmount(0.04, 'µg')).toBe('<0.1 µg');
  });
});

describe('formatEnergy', () => {
  it('is a whole number of kcal', () => {
    expect(formatEnergy(248.6)).toBe('249 kcal');
    expect(formatEnergy(0)).toBe('0 kcal');
  });
});

describe('formatPercent', () => {
  it('rounds and never turns a present share into 0%', () => {
    expect(formatPercent(0.456)).toBe('46%');
    expect(formatPercent(0.002)).toBe('<1%');
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('rowFor', () => {
  it('marks an absent value as missing, never zero', () => {
    expect(rowFor(undefined, 'mg')).toEqual({ text: COPY.NUTRITION.NOT_MEASURED, partial: false, missing: true });
  });

  it('shows a partial total of zero as not measured, never as at least zero', () => {
    expect(rowFor({ value: 0, complete: false }, 'mg')).toEqual({ text: COPY.NUTRITION.NOT_MEASURED, partial: false, missing: true });
    expect(rowFor({ value: 0, complete: true }, 'mg')).toEqual({ text: '0 mg', partial: false, missing: false });
  });

  it('prefixes a partial value with the at-least sign', () => {
    expect(rowFor({ value: 4.4, complete: false }, 'mg')).toEqual({ text: '≥ 4.4 mg', partial: true, missing: false });
  });

  it('shows a complete value plainly', () => {
    expect(rowFor({ value: 12, complete: true }, 'g')).toEqual({ text: '12 g', partial: false, missing: false });
  });
});

describe('LEGEND_UNIT', () => {
  it('uses mg for caffeine and iron and g for the rest', () => {
    expect(LEGEND_UNIT).toEqual({ sugar: 'g', starch: 'g', protein: 'g', fat: 'g', fibre: 'g', alcohol: 'g', caffeine: 'mg', iron: 'mg' });
  });
});

describe('legendAmount', () => {
  const details = {
    sugar: { value: 12, complete: false },
    protein: { value: 9, complete: true },
  };

  it('prefixes an incomplete detail total with the at-least sign', () => {
    expect(legendAmount('sugar', 12, details)).toBe('≥ 12 g');
  });

  it('shows a complete detail total plainly', () => {
    expect(legendAmount('protein', 9, details)).toBe('9 g');
  });

  it('leaves nutrients without a detail id as they are', () => {
    expect(legendAmount('starch', 30, details)).toBe('30 g');
    expect(legendAmount('caffeine', 80, details)).toBe('80 mg');
    expect(legendAmount('alcohol', 14, details)).toBe('14 g');
  });
});

describe('mixLabel', () => {
  it('names every share with its percent', () => {
    const label = mixLabel([
      { nutrient: 'starch', share: 0.6 },
      { nutrient: 'sugar', share: 0.004 },
    ]);
    expect(label).toBe(`${COPY.NUTRITION.MIX_TITLE}: ${COPY.NUTRIENTS.starch} 60%, ${COPY.NUTRIENTS.sugar} <1%`);
  });
});
