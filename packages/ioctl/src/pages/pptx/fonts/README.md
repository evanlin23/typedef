# Bundled fonts

Converted slides are laid out and embedded with these fonts, so text looks and
wraps the same on every computer. They are metric-compatible stand-ins for the
fonts most decks use (same character widths, so lines break in the same places):

| Bundled font | Used for |
| --- | --- |
| Carlito | Calibri |
| Caladea | Cambria |
| Gelasio | Georgia |
| Inconsolata (SemiExpanded) | Consolas |
| Liberation Sans | Arial, Helvetica, and other sans-serif fonts |
| Liberation Serif | Times New Roman and other serif fonts |
| Liberation Mono | Courier New and other monospace fonts |
| DejaVu Sans | Symbols and characters the fonts above don't have |

The files are unmodified copies of the upstream releases (Liberation 2.1.5,
Carlito 1.104, Caladea 1.001, Gelasio from github.com/SorkinType/Gelasio,
DejaVu 2.37), except Inconsolata. The Inconsolata files are made from its
variable font in github.com/google/fonts by scripts/make-inconsolata.py: the
SemiExpanded width (0.55em characters, like Consolas) in regular and bold, and
slanted copies of those as the italics, since Inconsolata has none.
Their licenses (SIL Open Font License 1.1, and the Bitstream Vera license for
DejaVu) are in the LICENSE-*.txt files next to them.
