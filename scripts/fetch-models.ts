import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { BP3D_BASE, BP3D_DIR, BP3D_DOWNLOADS, HUBMAP_URLS, hubmapPath } from './models/manifest';

async function download(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) {
    process.stdout.write(`have ${dest}\n`);
    return;
  }
  process.stdout.write(`get  ${url}\n`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status}): ${url}`);
  await pipeline(Readable.fromWeb(res.body as ReadableStream), createWriteStream(`${dest}.part`));
  renameSync(`${dest}.part`, dest);
}

async function main(): Promise<void> {
  mkdirSync(BP3D_DIR, { recursive: true });
  mkdirSync('assets-src/hubmap', { recursive: true });
  await download(HUBMAP_URLS.female, hubmapPath('female'));
  await download(HUBMAP_URLS.male, hubmapPath('male'));
  for (const file of BP3D_DOWNLOADS) await download(`${BP3D_BASE}/${file}`, `${BP3D_DIR}/${file}`);
  for (const tree of ['partof', 'isa']) {
    const dir = `${BP3D_DIR}/${tree}`;
    if (!existsSync(dir)) execFileSync('unzip', ['-oq', `${BP3D_DIR}/${tree}_BP3D_4.0_obj_99.zip`, '-d', dir]);
  }
  process.stdout.write('All model sources ready.\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
