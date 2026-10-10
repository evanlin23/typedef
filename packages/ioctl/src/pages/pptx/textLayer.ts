import { PDFDocument, PDFHexString, PDFRef, PDFString } from 'pdf-lib';

// Characters no bundled font has (like CJK or emoji) are drawn as pictures, so
// this adds their text invisibly on top (like OCR'd scans) to keep them searchable.

// A 600-byte TrueType font whose only glyph is empty. Every character is drawn
// with it (as one UTF-16 code unit per glyph) and the ToUnicode map below
// recovers the original text, so any script works without embedding real fonts.
const GLYPHLESS_FONT =
  'AAEAAAAKAIAAAwAgT1MvMkTeRSAAAAEoAAAAYGNtYXAADABGAAABjAAAACxnbHlmAAAAAAAAAbwAAAABaGVhZCz0tqgAAACsAAAANmhoZWED6QH2AAAA5AAAACRobXR4AfQAAAAAAYgAAAAEbG9jYQAAAAAAAAG4AAAABG1heHAAAgACAAABCAAAACBuYW1lGZ8ZNAAAAcAAAABycG9zdAADAAAAAAI0AAAAJAABAAAAAQAAgthu1l8PPPUAAwPoAAAAAObvOuQAAAAA5u865AAAAAAAAAAAAAAAAwACAAAAAAAAAAEAAAPoAAAAAAH0AAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAEAAAABAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwH0AZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPz8/PwAAAAAAAAPoAAAAAAPoAAAAAAAAAAAAAAAAAAAAAAAgAAAB9AAAAAAAAgAAAAMAAAAUAAMAAQAAABQABAAYAAAAAgACAAAAAP//AAD//wABAAAAAAAAAAAAAAAAAAQANgABAAAAAAABAA0AAAABAAAAAAACAAcADQADAAEECQABABoAFAADAAEECQACAA4ALkdseXBoTGVzc0ZvbnRSZWd1bGFyAEcAbAB5AHAAaABMAGUAcwBzAEYAbwBuAHQAUgBlAGcAdQBsAGEAcgAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA';

// Advance width of every glyph, as a fraction of the font size
export const GLYPH_WIDTH = 0.5;

// Maps each 2-byte code to the same UTF-16 code unit. bfrange entries may only
// vary in their last byte, so there's one per high byte, at most 100 per block.
function toUnicodeCMap() {
  const ranges = Array.from({ length: 256 }, (_, high) => {
    const hex = high.toString(16).padStart(2, '0');
    return `<${hex}00> <${hex}ff> <${hex}00>`;
  });
  const blocks = [];
  for (let i = 0; i < ranges.length; i += 100) {
    const block = ranges.slice(i, i + 100);
    blocks.push(`${block.length} beginbfrange\n${block.join('\n')}\nendbfrange`);
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange\n<0000> <ffff>\nendcodespacerange',
    ...blocks,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
}

export function embedInvisibleFont(doc: PDFDocument): PDFRef {
  const { context } = doc;
  const fontFile = Uint8Array.from(atob(GLYPHLESS_FONT), (c) => c.charCodeAt(0));
  const descriptor = context.obj({
    Type: 'FontDescriptor',
    FontName: 'GlyphLessFont',
    Flags: 4,
    FontBBox: [0, 0, GLYPH_WIDTH * 1000, 1000],
    ItalicAngle: 0,
    Ascent: 1000,
    Descent: 0,
    CapHeight: 1000,
    StemV: 80,
    FontFile2: context.register(context.flateStream(fontFile, { Length1: fontFile.length })),
  });
  const cidFont = context.obj({
    Type: 'Font',
    Subtype: 'CIDFontType2',
    BaseFont: 'GlyphLessFont',
    CIDSystemInfo: { Registry: PDFString.of('Adobe'), Ordering: PDFString.of('Identity'), Supplement: 0 },
    FontDescriptor: context.register(descriptor),
    DW: GLYPH_WIDTH * 1000,
    CIDToGIDMap: 'Identity',
  });
  return context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type0',
      BaseFont: 'GlyphLessFont',
      Encoding: 'Identity-H',
      DescendantFonts: [context.register(cidFont)],
      ToUnicode: context.register(context.flateStream(toUnicodeCMap())),
    })
  );
}

// Encodes text for the invisible font: one glyph per UTF-16 code unit
export function encodeInvisibleText(text: string) {
  return PDFHexString.of(Array.from({ length: text.length }, (_, i) => text.charCodeAt(i).toString(16).padStart(4, '0')).join(''));
}
