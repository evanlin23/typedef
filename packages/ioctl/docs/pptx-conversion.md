# PowerPoint conversion

The PPTX converter and PDF combiner share a headless LibreOffice WebAssembly
runtime by default, pinned to `@matbee/libreoffice-converter` 2.7.2. Presentations are loaded
and exported by LibreOffice, rather than reconstructed by a custom slide renderer.
Local mode does not upload document contents. Both tools also offer an explicit
CloudConvert connection using the user's own account key. PDF-only merging does
not start an office runtime or upload files, regardless of the selected backend.

## Hosted conversion without running a server

Select **CloudConvert (your account)** in either tool and enter a personal API
key with `task.read` and `task.write` scopes. The account/key is required: this
project does not supply shared credits, an anonymous conversion API, or a backend.
Do not embed a site-wide API key in Vite configuration or the static build.
Keys remain in component memory and are cleared when leaving the tool. Browser
conversion remains the default; errors never trigger an upload or change backend.

CloudConvert controls free allowances, credit charges, supported engines, and
retention. This integration does not guarantee unlimited free conversion and does
not enforce a free-credit-only spending limit on a paid CloudConvert account.
Check the current allowance at https://cloudconvert.com/pricing before use.
It does not purchase a subscription or credits. The app does not request a
particular conversion engine; CloudConvert chooses its supported PPTX/PDF default.
It has not been established that this is Microsoft PowerPoint or a more accurate
engine than LibreOffice.

The browser creates an `import/upload` → `convert` → `export/url` job, uploads
only the validated PPTX to the signed CloudConvert form, polls for the result,
and downloads PDF bytes for local merging. API credentials go only to the fixed
`https://api.cloudconvert.com/v2` endpoint; signed upload/download requests carry
no authorization header or cookies. Returned storage URLs must use HTTPS on a
CloudConvert subdomain. Uploads are limited to 50 MB and downloads to 200 MB by
this app. Jobs have a five-minute timeout and hosted conversions run serially.
Leaving the tool aborts active requests; job deletion is requested after success,
failure, or cancellation. Cleanup is best effort and is not a guarantee of remote
deletion. Closing the tab can interrupt cleanup.

Protocol references: CloudConvert's official SDK examples and response fixtures:
https://github.com/cloudconvert/cloudconvert-node and
https://github.com/cloudconvert/cloudconvert-php . A production account key and
network access are still needed to verify live CORS, upload/download endpoints,
the current allowance, and real lecture conversion fidelity. Unit tests and mocked
browser service responses do not establish those provider behaviors.

## Development and deployment

Install with the repository's pnpm 9 workflow. `npm run dev` and `npm run build`
in `packages/ioctl` automatically copy the pinned runtime and worker into ignored
`public/libreoffice/`. Do not commit these generated binaries. The runtime is
shipped as approximately 80 MB of gzip assets (about 250 MB uncompressed). The worker decompresses them locally, and each deployed file
stays below GitHub's 100 MB file limit. Browser caching depends on the host. Subsequent conversions reuse the worker
until it has been
idle for two minutes. Errors and timeouts terminate the runtime so the next file
can start a fresh instance. Both tools serialize conversions through one queue.

The output directory is a self-contained static site; no backend needs to be
hosted by this project. Deploy the entire `dist` directory, including
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
recovery after a damaged file. Hosted-service tests use mocked CloudConvert
responses and check opt-in/key entry, request destinations, local PDF merging,
errors without fallback, and cancellation/cleanup. These tests establish those behaviors, not visual
equivalence to arbitrary PowerPoint presentations. Real PowerPoint-exported PDF
references are needed for that comparison.

Real lecture validation of the merged browser implementation found six timeouts
among eight decks (197 slides total); both completed exports had visible fidelity
differences. A native LibreOffice diagnostic converted all eight with matching
page counts, but inspected pages also had equation/graphic differences. Neither
result is a 100% PowerPoint fidelity claim. The hosted integration is not yet
validated against that corpus.

The worker bootstrap sets Emscripten `Module.noInitialRun` before loading
the runtime. LibreOfficeKit initializes the office instance; allowing the
application entry point to run as well causes nondeterministic startup deadlocks.
Keep this override when upgrading and test more than one fresh browser session.

The adapter uses the pinned upstream classic-worker message protocol so it can
terminate hung WASM workers. Review that protocol and rerun the browser suite
before upgrading the package. Unit tests alone do not validate a runtime upgrade.

Runtime license: MPL-2.0. Corresponding source/build instructions:
https://github.com/matbeedotcom/libreoffice-document-converter/tree/v2.7.2
