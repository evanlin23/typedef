import { copyFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('@matbee/libreoffice-converter/package.json'));
const target = new URL('../public/libreoffice/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['soffice.js', 'soffice.worker.js']) {
  await copyFile(resolve(root, 'wasm', name), new URL(name, target));
}
// Keep each deployed asset below GitHub's 100 MB file limit. The worker
// decompresses these locally, independently of host Content-Encoding settings.
for (const name of ['soffice.wasm', 'soffice.data']) {
  await pipeline(createReadStream(resolve(root, 'wasm', name)), createGzip(), createWriteStream(new URL(`${name}.gz`, target)));
  await rm(new URL(name, target), { force: true });
}
await copyFile(resolve(root, 'dist/browser.worker.global.js'), new URL('browser.worker.js', target));
await copyFile(new URL('./office.worker.js', import.meta.url), new URL('office.worker.js', target));
await copyFile(require.resolve('coi-serviceworker'), new URL('../public/coi-serviceworker.js', import.meta.url));
await copyFile(new URL('../licenses/LibreOffice-MPL-2.0.txt', import.meta.url), new URL('LICENSE-MPL-2.0.txt', target));
await writeFile(new URL('NOTICE.txt', target),
  'LibreOffice WASM runtime distributed by @matbee/libreoffice-converter 2.7.2.\n' +
  'License: Mozilla Public License 2.0 (https://www.mozilla.org/MPL/2.0/).\n' +
  'Corresponding source and build instructions: https://github.com/matbeedotcom/libreoffice-document-converter/tree/v2.7.2\n' +
  'LibreOffice and third-party notices are included in the runtime filesystem.\n');
