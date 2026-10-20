> Archived research from commit `077051e`. These instructions describe the retired experiment, not the current app.

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
stays below GitHub's 100 MB file limit. Browser caching depends on the host.
Each presentation uses a fresh worker, released as soon as its PDF arrives, or
when conversion fails. This avoids reusing a worker that published a result and
then stalled in native document cleanup, and releases its office memory after use.
Both tools serialize conversions through one queue. Repeated files pay the runtime
initialization/decompression cost again; cached assets depend on the host/browser.

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
files are not automatically accessible to the browser. The optional fonts panel
supports original TTF, OTF and TTC files, including bold/italic variants. Where
the browser supports Local Font Access, **Load installed Office fonts** asks for
permission and reads installed Arial, Calibri, Cambria, Cambria Math, Georgia and
Times New Roman faces. Other browsers can use the file selector. Load fonts before
selecting PPTX files in the converter, or before clicking Combine in the combiner.
Fonts are held in page memory and installed into each worker's filesystem before
LibreOffice's initial font scan; they are never uploaded or persisted by this app.
Selections are capped at 32 files, 20 MB per file and 64 MB total. Font access is
never requested automatically. An unavailable/denied device API leaves manual
selection available. Matching original fonts helps avoid substitution, including
glyph differences in vector images, but does not establish identical rendering.
For an exact match to
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

The real lecture regression corpus is pinned by Git commit and SHA-256 in
`e2e/fixtures/lectures.json`. The CI job downloads it and runs all lecture tests.
To run the same corpus locally:

```
node scripts/fetch-lecture-fixtures.mjs /tmp/ioctl-lectures
IOCTL_LECTURE_FIXTURES_DIR=/tmp/ioctl-lectures npm run test:e2e
```

In the Codex cloud environment with Node 24, the downloader needs
`NODE_USE_ENV_PROXY=1` to use the configured HTTPS proxy. Without a fixture
directory, the nine lecture tests are explicitly skipped; the generated fixture
and font tests still run. Do not describe a skipped corpus as validated.

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium binary.
The browser suite serves the production build without isolation headers, tests
the service worker, converts generated two-slide presentations, checks searchable
text/tables/chart labels/links and page dimensions, merges mixed inputs, and checks
recovery after a damaged file. It verifies that a selected local font is embedded
in two consecutive exports and that device font access is requested only by a click.
The real corpus covers eight decks/197 slides and a 62-page PDF-plus-three-deck
merge, checking page counts/sizes/order and absence of external conversion calls.
These tests establish those behaviors, not visual equivalence to arbitrary
PowerPoint presentations. See [lecture validation](pptx-lecture-validation.md)
for comparison findings and the remaining fidelity limits.

The worker bootstrap sets Emscripten `Module.noInitialRun` before loading
the runtime. LibreOfficeKit initializes the office instance; allowing the
application entry point to run as well causes nondeterministic startup deadlocks.
Keep this override when upgrading and test more than one fresh browser session.
The same bootstrap populates 16 pthread workers in `Module.preRun`, before the
pinned Emscripten loader loads their modules. A native import/export can wait
synchronously for background work; attempting to create a worker at that point
requires the blocked JavaScript worker's event loop and can deadlock. The original
four-worker pool hung on real decks. Preloading uses the classic loader's `PThread`
object and does not modify upstream JS/WASM/data files. This is an implementation
detail of the pinned runtime and must be verified when upgrading. More preloaded
workers increase startup/resource costs; validation used desktop Chromium.

The adapter uses the pinned upstream classic-worker message protocol so it can
terminate hung WASM workers. Review that protocol and rerun the browser suite
before upgrading the package. Unit tests alone do not validate a runtime upgrade.

Runtime license: MPL-2.0. Corresponding source/build instructions:
https://github.com/matbeedotcom/libreoffice-document-converter/tree/v2.7.2
