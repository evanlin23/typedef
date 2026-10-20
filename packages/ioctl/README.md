## How to use

Use at https://evanlin23.github.io/ioctl/.

## What is ioctl?

A collection of browser utilities, including folder flattening, PDF combining,
and FFmpeg image animation.

The PDF Combiner accepts PDF files only and combines them locally. It preserves
page sizes by default, with optional width matching. For presentations, export a
PDF with PowerPoint or Google Slides first. See [export guidance](docs/pptx-conversion.md)
and the [PPTX experiment archive](docs/archive/pptx/README.md).

## Development

From the repository root, install with pnpm 9 using `pnpm install --frozen-lockfile`.
Start with `npm run dev --workspace=ioctl`. Development and builds prepare the
isolation service worker used by browser tools and remove stale LibreOffice assets.
No office runtime is downloaded or packaged.

Checks: `npm run test --workspace=ioctl`, `npm run lint --workspace=ioctl`,
`pnpm --filter ioctl exec tsc --noEmit -p tsconfig.app.json`, and
`npm run test:e2e --workspace=ioctl` (builds and runs Chromium tests against a
static server). Install Chromium first using `pnpm --filter ioctl exec playwright install chromium`,
or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium executable.
