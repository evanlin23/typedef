# Archived PPTX-to-PDF experiment

The in-browser PPTX converter is retired. The PDF Combiner now accepts PDFs only.
Export presentations with PowerPoint for the closest match to the original, or use
Google Slides as a free alternative with a Google account. Google Slides requires
an upload and can change fonts and layouts. Review the exported PDF before merging.

## Why it was retired

The browser LibreOffice runtime could not guarantee PowerPoint fidelity. Repair
experiments converted all eight lecture decks (197 slides), but comparison with
144 instructor PDF pages still found changed equations, font weights, and clipped
text. Completing a conversion does not establish visual accuracy. The runtime
also required about 80 MB on first use and substantial browser memory.

No hosted conversion service, API key, payment, or backend has been introduced.
PDF merging still runs locally, preserves page sizes by default, and retains its
existing internal and external link handling. Page merging does not preserve all
document-level features such as digital signatures or interactive forms.

## Recovering the experiment

Code is preserved in Git history rather than included as inactive application code:

- Last version merged into main: [`43a5072`](https://github.com/evanlin23/typedef/commit/43a5072934682372415cb8a360389e500f190618).
- Later runtime/font repairs and lecture validation: [`077051e`](https://github.com/evanlin23/typedef/commit/077051ed98b310886c774dbb93d96012f6a7eeea), [PR #14](https://github.com/evanlin23/typedef/pull/14).
- Historical paths: `packages/ioctl/src/pages/PptxConverter.tsx`,
  `packages/ioctl/src/pages/pptx/`, `packages/ioctl/scripts/prepare-office.mjs`,
  `packages/ioctl/scripts/office.worker.js`, and `packages/ioctl/e2e/`.
- [Runtime notes](pptx-conversion.md), [lecture results](pptx-lecture-validation.md),
  and [pinned public lecture sources](lectures.json) are retained here for reference.

The LibreOffice dependency, generated runtime, worker, conversion tests, and
obsolete renderer-generation scripts have been removed from the active build.
The old `/pptx-to-pdf` URL remains an export guide so existing links stay useful.
The isolation service worker remains available for browser tools, including the
image animators; FFmpeg dependencies and animation code are unchanged.
