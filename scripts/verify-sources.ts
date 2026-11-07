import { SOURCES } from '@/engine/sources';

async function check(url: string): Promise<string | null> {
  const doi = url.match(/^https:\/\/doi\.org\/(.+)$/)?.[1];
  const res = doi
    ? await fetch(`https://api.crossref.org/works/${doi}`)
    : await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (BitePath source check)' } });
  return res.ok ? null : `HTTP ${res.status}`;
}

async function main(): Promise<void> {
  let failed = 0;
  for (const source of Object.values(SOURCES)) {
    const problem = await check(source.url).catch((error: unknown) => (error instanceof Error ? error.message : String(error)));
    process.stdout.write(`${problem ? 'FAIL' : 'ok  '} ${source.id} ${problem ?? ''}\n`);
    if (problem) failed++;
  }
  if (failed > 0) throw new Error(`${failed} source(s) did not resolve`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
