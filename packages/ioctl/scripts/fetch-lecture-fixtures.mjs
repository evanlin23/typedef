// Download public faculty course files at immutable Git commits; verify bytes
// before running native browser conversions. No account or API key is required.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const directory = process.argv[2];
if (!directory) throw new Error('Usage: node scripts/fetch-lecture-fixtures.mjs <directory>');
const fixtures = JSON.parse(await readFile(new URL('../e2e/fixtures/lectures.json', import.meta.url), 'utf8'));
await mkdir(directory, { recursive: true });
for (const fixture of fixtures) {
  const path = resolve(directory, `${fixture.id}.pptx`);
  let bytes;
  try { bytes = await readFile(path); } catch { /* download below */ }
  const hash = (data) => createHash('sha256').update(data).digest('hex');
  if (!bytes || hash(bytes) !== fixture.sha256) {
    const response = await fetch(fixture.source, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Could not download ${fixture.id}: HTTP ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
    if (hash(bytes) !== fixture.sha256) throw new Error(`Checksum mismatch for ${fixture.id}`);
    await writeFile(path, bytes);
  }
  console.log(`Verified ${fixture.id} (${fixture.expectedPages} slides)`);
}
