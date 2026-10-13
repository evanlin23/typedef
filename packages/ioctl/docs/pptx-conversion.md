# Browser-only PowerPoint conversion

The PPTX converter and PDF combiner share a headless LibreOffice WebAssembly
runtime, pinned to `@matbee/libreoffice-converter` 2.7.2. Presentations are loaded
and exported by LibreOffice, rather than reconstructed by a custom slide renderer.
Neither tool uploads document contents. PDF-only merging does not start or fetch
the office runtime.

## Development and deployment

Install with the repository's pnpm 9 workflow. `npm run dev` and `npm run build`
in `packages/ioctl` automatically copy the pinned runtime and worker into ignored
`public/libreoffice/`. Do not commit these generated binaries. The runtime is
shipped as approximately 80 MB of gzip assets (about 250 MB uncompressed). The worker decompresses them locally, and each deployed file
stays below GitHub's 100 MB file limit. Browser caching depends on the host. Subsequent conversions reuse the worker
until it has been
idle for two minutes. Errors and timeouts terminate the runtime so the next file
can start a fresh instance. Both tools serialize conversions through one queue.

The output directory is a self-contained static site: no conversion backend or
external runtime CDN is required. Deploy the entire `dist` directory, including
`libreoffice/`, `NOTICE.txt`, and `coi-serviceworker.js`.

WebAssembly threads require HTTPS (localhost also works), SharedArrayBuffer, and
cross-origin isolation. Vite supplies COOP/COEP headers in development. For static
hosts such as GitHub Pages, the pinned `coi-serviceworker` establishes these headers
and reloads the page on initial installation. Browsers must allow service workers.
If isolation is unavailable, conversion reports an actionable error; PDF-only
merging remains available.

## Fidelity limits

LibreOffice supports presentations, text, vector graphics, charts, and PDF links,
but uses a different rendering engine from Microsoft PowerPoint. It is not a
guarantee of identical PowerPoint output. Font substitution, SmartArt, effects,
embedded objects, and unsupported media can differ. Original PowerPoint font
files are not automatically accessible to the browser. For an exact match to
PowerPoint's static PDF appearance, export the PDF from PowerPoint and use the
PDF combiner. A PDF does not preserve playback or animation.

The combiner preserves original page dimensions by default. Width normalization
is explicitly optional because scaling changes page geometry. Existing external
links and links between pages in each source PDF are retained; document-level
features such as signatures and interactive forms are not guaranteed by page
copying in pdf-lib.

## Validation

From `packages/ioctl`:

```
npm run lint
npm run test
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
npm run build
npm exec playwright install chromium
npm run test:e2e
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium binary.
The browser suite serves the production build without isolation headers, tests
the service worker, converts generated two-slide presentations, checks searchable
text/tables/chart labels/links and page dimensions, merges mixed inputs, and checks
recovery after a damaged file. These tests establish those behaviors, not visual
equivalence to arbitrary PowerPoint presentations. Real PowerPoint-exported PDF
references are needed for that comparison.

The worker bootstrap sets Emscripten `Module.noInitialRun` before loading
the runtime. LibreOfficeKit initializes the office instance; allowing the
application entry point to run as well causes nondeterministic startup deadlocks.
Keep this override when upgrading and test more than one fresh browser session.

The adapter uses the pinned upstream classic-worker message protocol so it can
terminate hung WASM workers. Review that protocol and rerun the browser suite
before upgrading the package. Unit tests alone do not validate a runtime upgrade.

Runtime license: MPL-2.0. Corresponding source/build instructions:
https://github.com/matbeedotcom/libreoffice-document-converter/tree/v2.7.2
