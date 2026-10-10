import {
  PDFDocument,
  PDFHexString,
  PDFPage,
  PDFRef,
  PDFString,
  TextRenderingMode,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSqueeze,
  setFontAndSize,
  setTextMatrix,
  setTextRenderingMode,
  showText,
} from 'pdf-lib';

// Slides are embedded as images, so this adds their text as an invisible layer
// (like OCR'd scans) to keep the PDF searchable and selectable.

// A line of text, positioned in pt from the slide's top-left corner
export interface TextLine {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

// A 600-byte TrueType font whose only glyph is empty. Every character is drawn
// with it (as one UTF-16 code unit per glyph) and the ToUnicode map below
// recovers the original text, so any script works without embedding real fonts.
const GLYPHLESS_FONT =
  'AAEAAAAKAIAAAwAgT1MvMkTeRSAAAAEoAAAAYGNtYXAADABGAAABjAAAACxnbHlmAAAAAAAAAbwAAAABaGVhZCz0tqgAAACsAAAANmhoZWED6QH2AAAA5AAAACRobXR4AfQAAAAAAYgAAAAEbG9jYQAAAAAAAAG4AAAABG1heHAAAgACAAABCAAAACBuYW1lGZ8ZNAAAAcAAAABycG9zdAADAAAAAAI0AAAAJAABAAAAAQAAgthu1l8PPPUAAwPoAAAAAObvOuQAAAAA5u865AAAAAAAAAAAAAAAAwACAAAAAAAAAAEAAAPoAAAAAAH0AAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAEAAAABAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwH0AZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPz8/PwAAAAAAAAPoAAAAAAPoAAAAAAAAAAAAAAAAAAAAAAAgAAAB9AAAAAAAAgAAAAMAAAAUAAMAAQAAABQABAAYAAAAAgACAAAAAP//AAD//wABAAAAAAAAAAAAAAAAAAQANgABAAAAAAABAA0AAAABAAAAAAACAAcADQADAAEECQABABoAFAADAAEECQACAA4ALkdseXBoTGVzc0ZvbnRSZWd1bGFyAEcAbAB5AHAAaABMAGUAcwBzAEYAbwBuAHQAUgBlAGcAdQBsAGEAcgAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA';

// Advance width of every glyph, as a fraction of the font size
const GLYPH_WIDTH = 0.5;

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

// Groups the words in a rendered slide into lines, measured in pt
export function measureTextLines(root: HTMLElement, ptPerPx: number): TextLine[] {
  const origin = root.getBoundingClientRect();
  const lines: TextLine[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest('[data-decorative]')) continue;
    for (const word of node.data.matchAll(/\S+/g)) {
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const box = {
        left: (rect.left - origin.left) * ptPerPx,
        top: (rect.top - origin.top) * ptPerPx,
        width: rect.width * ptPerPx,
        height: rect.height * ptPerPx,
      };
      // Continue the previous line if this word sits right after it
      const line = lines[lines.length - 1];
      const gap = line ? box.left - (line.left + line.width) : 0;
      if (line && Math.abs(box.top - line.top) < line.height / 2 && gap > -0.2 * line.height && gap < line.height) {
        line.text += (gap > 0.1 * line.height ? ' ' : '') + word[0];
        line.width = box.left + box.width - line.left;
      } else {
        lines.push({ text: word[0], ...box });
      }
    }
  }
  return lines;
}

export function drawInvisibleText(page: PDFPage, font: PDFRef, lines: TextLine[]) {
  const fontName = page.node.newFontDictionary('GlyphLessFont', font);
  const pageHeight = page.getHeight();
  const ops = [pushGraphicsState(), beginText(), setTextRenderingMode(TextRenderingMode.Invisible)];
  for (const line of lines) {
    const hex = Array.from({ length: line.text.length }, (_, i) => line.text.charCodeAt(i).toString(16).padStart(4, '0')).join('');
    ops.push(
      setFontAndSize(fontName, line.height),
      // Stretch the text horizontally so selections match the rendered words
      setCharacterSqueeze((100 * line.width) / (line.text.length * line.height * GLYPH_WIDTH)),
      setTextMatrix(1, 0, 0, 1, line.left, pageHeight - line.top - line.height),
      showText(PDFHexString.of(hex))
    );
  }
  ops.push(endText(), popGraphicsState());
  page.pushOperators(...ops);
}
