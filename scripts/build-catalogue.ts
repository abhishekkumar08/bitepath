import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'csv-parse/sync';
import type { Food } from '@/engine/types';
import { USDA_MEASURED_IDS, USDA_NUTRIENT_IDS, foodFromIfct, foodFromUsda } from './lib/convert';

const ifct = createRequire(import.meta.url)('@ifct2017/compositions') as { csv: () => string };

const USDA_ZIP_URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip';
const USDA_DIR = 'assets-src/usda';
const USDA_CSV_DIR = `${USDA_DIR}/FoodData_Central_sr_legacy_food_csv_2018-04`;
const OUT_DIR = 'public/data';
const OUT = `${OUT_DIR}/foods.json`;

const readCsv = (path: string): Record<string, string>[] =>
  parse(readFileSync(path), { columns: true, skip_empty_lines: true, comment: '#' }) as Record<string, string>[];

async function ensureUsda(): Promise<void> {
  if (existsSync(`${USDA_CSV_DIR}/food.csv`)) return;
  mkdirSync(USDA_DIR, { recursive: true });
  const res = await fetch(USDA_ZIP_URL);
  if (!res.ok) throw new Error(`USDA download failed: HTTP ${res.status}`);
  writeFileSync(`${USDA_DIR}/sr.zip`, Buffer.from(await res.arrayBuffer()));
  execFileSync('unzip', ['-oq', `${USDA_DIR}/sr.zip`, '-d', USDA_DIR]);
}

function usdaFoods(): Food[] {
  const wanted = new Set<string>([...Object.values(USDA_NUTRIENT_IDS), ...Object.values(USDA_MEASURED_IDS)]);
  const byFood = new Map<string, Map<string, number>>();
  for (const row of readCsv(`${USDA_CSV_DIR}/food_nutrient.csv`)) {
    if (!wanted.has(row.nutrient_id)) continue;
    const values = byFood.get(row.fdc_id) ?? new Map<string, number>();
    values.set(row.nutrient_id, Number(row.amount));
    byFood.set(row.fdc_id, values);
  }
  return readCsv(`${USDA_CSV_DIR}/food.csv`).map((f) => foodFromUsda(f.fdc_id, f.description, byFood.get(f.fdc_id) ?? new Map()));
}

async function main(): Promise<void> {
  await ensureUsda();
  const foods = [...readCsv(ifct.csv()).map(foodFromIfct), ...usdaFoods()].sort((a, b) => a.name.localeCompare(b.name));
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify(foods));
  process.stdout.write(`Wrote ${foods.length} foods to ${OUT}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
