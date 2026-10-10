import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont, PDFHexString } from 'pdf-lib';

// Slides are laid out by the browser and drawn into the PDF with the same
// bundled fonts (see fonts/README.md), so text lands exactly where the browser
// put it. Faces are downloaded only when a slide needs them.

export type FamilyKey = 'carlito' | 'caladea' | 'gelasio' | 'inconsolata' | 'sans' | 'serif' | 'mono' | 'symbols';

export interface Face {
  key: string;
  family: FamilyKey;
  bold: boolean;
  italic: boolean;
  bytes: Uint8Array;
  font: fontkit.Font;
}

const FONT_URLS = import.meta.glob<string>('./fonts/*.ttf', { query: '?url', import: 'default', eager: true });

function fontUrl(family: FamilyKey, bold: boolean, italic: boolean) {
  if (family === 'symbols') return FONT_URLS[bold ? './fonts/DejaVuSans-Bold.ttf' : './fonts/DejaVuSans.ttf'];
  const name = { carlito: 'Carlito', caladea: 'Caladea', gelasio: 'Gelasio', inconsolata: 'Inconsolata', sans: 'LiberationSans', serif: 'LiberationSerif', mono: 'LiberationMono' }[family];
  const variant = bold ? (italic ? 'BoldItalic' : 'Bold') : italic ? 'Italic' : 'Regular';
  return FONT_URLS[`./fonts/${name}-${variant}.ttf`];
}

export const cssFamily = (family: FamilyKey) => `pptx-${family}`;

// The CSS font-family for text in a given font: the bundled stand-in, then the
// symbol font for characters it lacks, then whatever the browser has
export const cssFontStack = (family: FamilyKey) => `"${cssFamily(family)}", "${cssFamily('symbols')}", sans-serif`;

// Picks the bundled stand-in for a font named in a presentation
export function familyFor(fontName: string): FamilyKey {
  const name = fontName.toLowerCase().replace(/["']/g, '').trim();
  if (name.startsWith('pptx-')) return name.slice(5) as FamilyKey;
  if (name.startsWith('calibri')) return 'carlito';
  if (name.startsWith('cambria')) return 'caladea';
  if (name.startsWith('georgia')) return 'gelasio';
  if (name.startsWith('consolas') || name.startsWith('inconsolata')) return 'inconsolata';
  if (/courier|mono|lucida console|menlo|monaco|source code/.test(name)) return 'mono';
  if (/times|georgia|garamond|palatino|book antiqua|bookman|baskerville|constantia|century schoolbook|didot|serif/.test(name) && !/sans/.test(name)) {
    return 'serif';
  }
  return 'sans';
}

export const faceKey = (family: FamilyKey, bold: boolean, italic: boolean) => `${family}${bold ? '-bold' : ''}${italic ? '-italic' : ''}`;

const faces = new Map<string, Promise<Face>>();

export function loadFace(family: FamilyKey, bold: boolean, italic: boolean): Promise<Face> {
  const key = faceKey(family, bold, italic);
  let face = faces.get(key);
  if (!face) {
    face = (async () => {
      const response = await fetch(fontUrl(family, bold, italic));
      if (!response.ok) throw new Error(`Couldn't download the ${key} font (HTTP ${response.status})`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const fontFace = new FontFace(cssFamily(family), bytes, { weight: bold ? '700' : '400', style: italic ? 'italic' : 'normal' });
      document.fonts.add(await fontFace.load());
      return { key, family, bold, italic, bytes, font: fontkit.create(bytes) };
    })();
    // Let a failed download be retried
    face.catch(() => faces.delete(key));
    faces.set(key, face);
  }
  return face;
}

// The face the browser uses for an element's text, from its computed style
export function faceStyle(style: CSSStyleDeclaration) {
  return {
    family: familyFor(style.fontFamily.split(',')[0]),
    bold: Number(style.fontWeight) >= 600 || style.fontWeight === 'bold',
    italic: style.fontStyle === 'italic' || style.fontStyle.startsWith('oblique'),
  };
}

const baselines = new Map<string, number>();

// Distance from the top of a text box (as Range rects report it) to the
// baseline, as a fraction of the font size. Measured, because browsers differ
// in which font metrics they use.
export function baselineRatio(face: Face, host: HTMLElement) {
  let ratio = baselines.get(face.key);
  if (ratio === undefined) {
    const probe = document.createElement('span');
    Object.assign(probe.style, {
      font: `${face.italic ? 'italic ' : ''}${face.bold ? 700 : 400} 100px "${cssFamily(face.family)}"`,
      lineHeight: 'normal',
      whiteSpace: 'nowrap',
    });
    probe.textContent = 'x';
    // An empty inline-block sits with its bottom edge on the baseline
    const marker = document.createElement('span');
    marker.style.display = 'inline-block';
    probe.append(marker);
    host.append(probe);
    const range = document.createRange();
    range.selectNodeContents(probe.firstChild!);
    ratio = (marker.getBoundingClientRect().bottom - range.getBoundingClientRect().top) / 100;
    probe.remove();
    baselines.set(face.key, ratio);
  }
  return ratio;
}

interface SubsetInternals {
  glyf: { length: number; constructor: { concat(list: unknown[]): unknown; alloc(size: number): unknown } }[];
  offset: number;
  _addGlyph(gid: number): number;
}

// fontkit stores subset glyph offsets in a format that needs every glyph to have
// an even size, but some fonts (like Carlito) have odd-sized glyphs, which
// corrupts the subset. Pad those glyphs with a byte.
const evenGlyphFontkit: typeof fontkit = {
  ...fontkit,
  create(data, postscriptName) {
    const font = fontkit.create(data, postscriptName);
    const createSubset = font.createSubset.bind(font);
    font.createSubset = () => {
      const subset = createSubset() as unknown as SubsetInternals;
      const addGlyph = subset._addGlyph;
      subset._addGlyph = function (gid) {
        const index = addGlyph.call(this, gid);
        const glyph = this.glyf[index];
        if (glyph.length % 2) {
          this.glyf[index] = glyph.constructor.concat([glyph, glyph.constructor.alloc(1)]) as SubsetInternals['glyf'][number];
          this.offset += 1;
        }
        return index;
      };
      return subset as unknown as ReturnType<typeof createSubset>;
    };
    return font;
  },
};

// Embeds each face into a PDF once, as a subset of the glyphs it uses
export class FontEmbedder {
  private doc: PDFDocument;
  private embedded = new Map<string, Promise<PDFFont>>();

  constructor(doc: PDFDocument) {
    this.doc = doc;
    doc.registerFontkit(evenGlyphFontkit);
  }

  embed(face: Face) {
    let font = this.embedded.get(face.key);
    if (!font) {
      // pdf-lib's own kerning is off: kernedText adds the kerning the layout has
      // (ligatures are off in the layout)
      font = this.doc.embedFont(face.bytes, { subset: true, features: { liga: false, kern: false } });
      this.embedded.set(face.key, font);
    }
    return font;
  }
}

// Text with the font's kerning between its characters, as laid out by the
// browser (the embedded font itself has no kerning)
export function kernedText(face: Face, font: PDFFont, text: string): (PDFHexString | number)[] {
  const chars = Array.from(text);
  const run = face.font.layout(text, { kern: true, liga: false, calt: false, clig: false });
  if (run.glyphs.length !== chars.length) return [font.encodeText(text)];
  const items: (PDFHexString | number)[] = [];
  let pending = '';
  chars.forEach((char, i) => {
    pending += char;
    const adjustment = run.positions[i].xAdvance - run.glyphs[i].advanceWidth;
    if (adjustment && i < chars.length - 1) {
      items.push(font.encodeText(pending), (-adjustment * 1000) / face.font.unitsPerEm);
      pending = '';
    }
  });
  if (pending) items.push(font.encodeText(pending));
  return items;
}
