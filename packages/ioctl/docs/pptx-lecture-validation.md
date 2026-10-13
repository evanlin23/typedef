# Lecture validation: browser runtime repair

Validation used the production build in desktop Chromium 154 on a local static
server without isolation headers. The app's service worker established browser
isolation. All conversion ran locally; no conversion service/account/API key was
used. The live GitHub Pages deployment was not tested.

The original merged browser implementation completed two of eight authentic
lecture decks. Increasing the preloaded pthread pool to 16 and using a fresh
worker per presentation completed all eight, including all 197 slides. Both an
experimental larger-pool build and the final bootstrap implementation completed
the corpus; the upstream WASM/data/loader files are unchanged in the final patch.
The runtime adapter and bootstrap are shared by PPTX-to-PDF and the PDF combiner.

| Lecture | Slides | Original run | Repaired build (seconds) |
|---|---:|---|---:|
| kth-linear-algebra | 14 | Timed out | 20.4 |
| kth-information-theory | 12 | Timed out | 18.2 |
| kth-beamforming | 26 | Converted | 43.2 |
| kth-mimo-capacity | 24 | Timed out | 19.3 |
| kth-practical-networks | 21 | Converted | 35.2 |
| liu-fading-channels | 26 | Timed out | 13.5 |
| liu-practical-networks | 21 | Timed out | 18.8 |
| iit-opencv | 53 | Timed out | 10.2 |

All output page counts and dimensions matched the presentation manifests; every
page in the seven KTH/Linköping decks had searchable text. The 53-slide IIT deck
had text on 51 pages; two are image-only. Source files are public faculty course
repositories for KTH/Linköping multiple-antenna communications and IIT Gandhinagar
Introduction to OpenCV. Immutable source/reference URLs and input checksums are
in [the fixture manifest](../e2e/fixtures/lectures.json). The lecture binaries are
not committed; CI fetches and verifies the public sources.

## Rendering findings

All 144 pages across the seven decks with paired instructor PDFs were raster
compared at 72 DPI. A one-pixel border caused by PDF dimension rounding was
cropped for comparison; page content was not rescaled. Similarity scores were
used to select review pages, not as percentages of accuracy. The OpenCV deck has
no paired reference in this corpus.

The runtime fixes prevent the observed stalls but do not change LibreOffice's
rendering engine. Inspected exports still differed from the references:

- Practical networks page 6 clips the right end of the URLLC text near the plot.
- Linear algebra page 10 has changed font weight, bullet placement and spacing.
- Beamforming page 15 has changed mathematical typography and equation placement.

The decks request Georgia, Cambria Math and a university font, among others;
those original fonts are not supplied with the PPTX files. The new optional font
loader accepts original local files, or installed common Office fonts where the
browser supports access. Its integration test embeds an original synthetic test
font in consecutive exports. Actual Cambria Math/Georgia files were not available
in the test environment, so corrected lecture fidelity with those original fonts
has not been established. The loader does not ship renamed/substitute fonts or
modify presentation font references.

These results establish successful conversion on this corpus, not 100% PowerPoint
fidelity. Fonts, vector glyph IDs, equations, SmartArt/effects and media can still
render differently. Export with PowerPoint when an identical appearance is required.

## Regression coverage

The browser suite includes all eight real decks, a mixed-document merge with
three decks and local PDF notes, generated chart/table/link slides, recovery after
a damaged presentation, consecutive exports with a supplied font, and explicit
local-font permission handling. Unit tests cover worker lifecycle, preloading,
font validation/filtering, PDF page geometry and links. See the conversion guide
for reproducible commands; lecture tests require the downloaded fixture directory.
The completed validation run passed 29 unit tests and all 14 browser tests, plus
TypeScript, lint and the production build. The mixed merge produced 62 pages with
the expected lecture boundaries and the original PDF note dimensions. The device
permission-denial test uses a mocked browser API; it is not a Windows-font test.

Investigation also tried another packaged headless runtime, which still stalled,
and an unofficial full runtime package, which failed startup/CLI conversion. The
official ZetaOffice CDN was blocked by this cloud environment's network policy.
Those alternatives were not integrated or deployed. No hosted/API-key fallback
was added.
