import { copyFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Keep isolation support for browser tools without packaging the retired office runtime.
await copyFile(require.resolve('coi-serviceworker'), new URL('../public/coi-serviceworker.js', import.meta.url));
// Remove assets left by an earlier checkout so Vite cannot publish the retired engine.
await rm(new URL('../public/libreoffice/', import.meta.url), { recursive: true, force: true });
