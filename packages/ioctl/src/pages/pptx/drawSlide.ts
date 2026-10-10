import { LineCapStyle, type PDFRef } from 'pdf-lib';
import type { Element as SlideElement, Fill, Image as ImageElement, LineEnd, Shadow, Shape as ShapeElement, Slide } from 'pptxtojson';
import { drawChart } from './chart';
import type { ChartFrame } from './chartXml';
import { FontEmbedder, baselineRatio, faceStyle, familyFor, kernedText, loadFace, type Face } from './fonts';
import { ImageCache } from './images';
import { WORD_JOINER, textNodesIn, type SlideLayout } from './layoutSlide';
import { decodeDib, metafileFonts, parseMetafile, type MetafileFont } from './metafile';
import { Painter, parseColor, type Rgba } from './painter';
import { adjustValues, presetGeometry, type FillMode } from './presetGeometry';
import { ellipsePath, parseSvgPath, pathEnds, rectPath, roundRectPath, scaleSegments, segmentsToSvg, type Point, type Segment } from './svgPath';
import { symbolCode } from './symbolFont';
import { SYMBOL_BOXES } from './symbolMetrics';
import { GLYPH_WIDTH, encodeInvisibleText } from './textLayer';

// Draws a slide into the PDF as vector graphics: text in the embedded bundled
// fonts at the positions the browser laid it out, shapes as paths, and
// pictures as the original image files.

export interface DrawContext {
  painter: Painter;
  fonts: FontEmbedder;
  images: ImageCache;
  invisibleFont: PDFRef;
  host: HTMLElement; // Where the slide layout is attached, for measuring
  ptPerPx: number;
  charts: ChartFrame[]; // The charts read from the slide's XML, not yet drawn
}

type Box = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };
const GRAY: Rgba = { r: 0.55, g: 0.55, b: 0.55, a: 1 };
// Arrowhead width/length as multiples of the line width
const LINE_END_SIZES = { sm: 2, med: 3, lg: 5 };

const mix = (a: Rgba, b: Rgba): Rgba => ({ r: (a.r + b.r) / 2, g: (a.g + b.g) / 2, b: (a.b + b.b) / 2, a: (a.a + b.a) / 2 });

// PowerPoint's dash styles in multiples of the line width, by the dash
// pattern pptxtojson reports for each of them
const DASHES: Record<string, number[]> = {
  '5': [4, 3], // dash
  '5, 5, 1, 5': [4, 3, 1, 3], // dashDot
  '1, 5': [1, 3], // dot
  '10, 5': [8, 3], // lgDash
  '10, 5, 1, 5, 1, 5': [8, 3, 1, 3, 1, 3], // lgDashDotDot
  '5, 2': [3, 1], // sysDash
  '5, 2, 1, 5': [3, 1, 1, 1], // sysDashDot
  '5, 2, 1, 5, 1, 5': [3, 1, 1, 1, 1, 1], // sysDashDotDot
  '2, 5': [1, 1], // sysDot
};

// `pattern` is pptxtojson's dash pattern; `type` its coarser dashed/dotted style (as in tables)
function dashPattern(type: string | undefined, width: number, pattern?: string) {
  const dash = (pattern ? DASHES[pattern] : undefined) ?? (type === 'dashed' ? DASHES['5'] : type === 'dotted' ? DASHES['2, 5'] : undefined);
  return dash?.map((d) => d * width);
}

// Loads the faces a laid-out slide uses (and the symbol font where those lack characters)
export async function loadLayoutFonts(root: HTMLElement) {
  for (const node of textNodesIn(root)) {
    const text = node.data.replace(/\s/g, '').split(WORD_JOINER).join('');
    if (!text || !node.parentElement) continue;
    const spec = faceStyle(getComputedStyle(node.parentElement));
    const face = await loadFace(spec.family, spec.bold, spec.italic);
    if ([...text].some((c) => !face.font.hasGlyphForCodePoint(c.codePointAt(0)!))) await loadFace('symbols', spec.bold, spec.italic);
  }
  await document.fonts.ready;
}

async function fillPath(ctx: DrawContext, path: string | Segment[], size: Size, fill: Fill | null | undefined) {
  const { painter } = ctx;
  switch (fill?.type) {
    case 'color':
      painter.drawPath(path, parseColor(fill.value));
      break;
    case 'gradient': {
      const stops = fill.value.colors
        .map((stop) => ({ offset: (parseFloat(stop.pos) || 0) / 100, color: parseColor(stop.color) }))
        .filter((stop): stop is { offset: number; color: Rgba } => !!stop.color);
      painter.drawGradient(path, size, stops, fill.value.path === 'line' ? 'linear' : 'radial', fill.value.rot);
      break;
    }
    case 'pattern': {
      // Hatch patterns are approximated by blending their two colors
      const fg = parseColor(fill.value.foregroundColor);
      const bg = parseColor(fill.value.backgroundColor);
      painter.drawPath(path, fg && bg ? mix(fg, bg) : fg ?? bg);
      break;
    }
    case 'image': {
      const asset = await ctx.images.get(fill.value.base64, fill.value.ref);
      if (asset.kind !== 'image') break;
      painter.save();
      painter.clipTo(path);
      painter.drawImage(asset.image, 0, 0, size.width, size.height, fill.value.opacity ?? 1);
      painter.restore();
      break;
    }
  }
}

async function drawLabel(ctx: DrawContext, text: string, size: Size, color: Rgba, fontSize = 12) {
  const font = await ctx.fonts.embed(await loadFace('sans', false, false));
  const width = font.widthOfTextAtSize(text, fontSize);
  ctx.painter.drawText(font, fontSize, (size.width - width) / 2, size.height / 2 + fontSize * 0.35, font.encodeText(text), color);
}

// Marks content that can't be drawn so it isn't silently missing from the PDF
async function drawPlaceholder(ctx: DrawContext, size: Size, label: string) {
  ctx.painter.drawPath(rectPath(0, 0, size.width, size.height), null, GRAY, { width: 0.75, dash: [3, 3] });
  await drawLabel(ctx, label, size, GRAY);
}

// Pieces of a text node's characters [start, end) that sit on one line each
function linePieces(range: Range, node: globalThis.Text, start: number, end: number) {
  range.setStart(node, start);
  range.setEnd(node, end);
  if (range.getClientRects().length <= 1) return [{ start, end, rect: range.getBoundingClientRect() }];
  // The word wraps mid-word: group its characters by line
  const pieces: { start: number; end: number; rect: DOMRect }[] = [];
  for (let i = start; i < end; i++) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const rect = range.getBoundingClientRect();
    const last = pieces[pieces.length - 1];
    if (last && Math.abs(last.rect.top - rect.top) < rect.height / 2) {
      last.end = i + 1;
      range.setStart(node, last.start);
      last.rect = range.getBoundingClientRect();
    } else {
      pieces.push({ start: i, end: i + 1, rect });
    }
  }
  return pieces;
}

// Splits text into runs drawn with the same font: the primary face, the symbol
// font, or neither (null, for characters no bundled font has)
function fontRuns(text: string, offset: number, primary: Face, symbols: Face | null) {
  const runs: { start: number; end: number; face: Face | null }[] = [];
  let i = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    const face =
      char === WORD_JOINER ? (runs[runs.length - 1]?.face ?? primary)
      : primary.font.hasGlyphForCodePoint(code) ? primary
      : symbols?.font.hasGlyphForCodePoint(code) ? symbols
      : null;
    const last = runs[runs.length - 1];
    if (last && last.face === face) last.end = offset + i + char.length;
    else runs.push({ start: offset + i, end: offset + i + char.length, face });
    i += char.length;
  }
  return runs;
}

// Draws characters no bundled font has (e.g. CJK or emoji) as a picture, with invisible text for searching
async function drawFallbackText(ctx: DrawContext, text: string, box: Box, style: CSSStyleDeclaration, baseline: number) {
  const scale = 4; // Pixels per point
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(box.width * scale));
  canvas.height = Math.max(1, Math.ceil(box.height * scale));
  const c = canvas.getContext('2d')!;
  c.scale(scale, scale);
  c.font = `${style.fontStyle} ${style.fontWeight} ${parseFloat(style.fontSize) * ctx.ptPerPx}px ${style.fontFamily}`;
  c.fillStyle = style.color;
  c.fillText(text, 0, baseline);
  ctx.painter.drawImage(await ctx.images.embedCanvas(canvas), box.left, box.top, box.width, box.height);
  ctx.painter.drawInvisibleText(ctx.invisibleFont, encodeInvisibleText(text), text.length, GLYPH_WIDTH, box);
}

// Draws the text inside a laid-out element, positioned relative to `origin`
// (the element's box, which the painter's coordinates start at)
async function drawText(ctx: DrawContext, container: HTMLElement, origin: DOMRect) {
  const { painter, ptPerPx } = ctx;
  const local = (rect: DOMRect): Box => ({
    left: (rect.left - origin.left) * ptPerPx,
    top: (rect.top - origin.top) * ptPerPx,
    width: rect.width * ptPerPx,
    height: rect.height * ptPerPx,
  });
  const range = document.createRange();

  for (const node of textNodesIn(container)) {
    const parent = node.parentElement;
    if (!parent || !node.data.trim()) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === 'hidden') continue;
    const spec = faceStyle(style);
    const primary = await loadFace(spec.family, spec.bold, spec.italic);
    const needsSymbols = [...node.data].some((c) => !/\s/.test(c) && c !== WORD_JOINER && !primary.font.hasGlyphForCodePoint(c.codePointAt(0)!));
    const symbols = needsSymbols ? await loadFace('symbols', spec.bold, spec.italic) : null;
    const size = parseFloat(style.fontSize) * ptPerPx;
    const color = parseColor(style.color) ?? BLACK;
    const charSpacing = style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing) * ptPerPx || 0;
    const kerning = style.fontKerning !== 'none';
    // Range rects span the primary font's ascent and descent, whatever fonts the characters use
    const baselineOffset = baselineRatio(primary, ctx.host) * size;

    // Highlighted text
    const highlight = parseColor(style.backgroundColor);
    if (highlight && highlight.a > 0 && style.display.startsWith('inline')) {
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        const box = local(rect);
        painter.drawPath(rectPath(box.left, box.top, box.width, box.height), highlight);
      }
    }

    for (const word of node.data.matchAll(/\S+/g)) {
      const wordEnd = word.index! + word[0].length;
      // Keep the space after a word in the PDF text, so copied and searched text has it
      const space = node.data[wordEnd] === ' ' ? ' ' : '';
      for (const run of fontRuns(word[0], word.index!, primary, symbols)) {
        for (const piece of linePieces(range, node, run.start, run.end)) {
          const box = local(piece.rect);
          const text = node.data.slice(piece.start, piece.end).split(WORD_JOINER).join('') + (piece.end === wordEnd ? space : '');
          if (!text.trim()) continue;
          if (run.face) {
            const font = await ctx.fonts.embed(run.face);
            const content = kerning ? kernedText(run.face, font, text) : font.encodeText(text);
            painter.drawText(font, size, box.left, box.top + baselineOffset, content, color, charSpacing);
          } else {
            await drawFallbackText(ctx, text, box, style, baselineOffset);
          }
        }
      }
    }

    // Underline and strikethrough, one line per line of text
    const decoration = style.textDecorationLine;
    if (decoration.includes('underline') || decoration.includes('line-through')) {
      const { unitsPerEm, underlinePosition, underlineThickness } = primary.font;
      const thickness = Math.max((underlineThickness / unitsPerEm) * size, 0.5);
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        const box = local(rect);
        const baseline = box.top + baselineOffset;
        const lines = [];
        if (decoration.includes('underline')) lines.push(baseline - (underlinePosition / unitsPerEm) * size);
        if (decoration.includes('line-through')) lines.push(baseline - size * 0.28);
        for (const y of lines) painter.drawPath(`M${box.left},${y} L${box.left + box.width},${y}`, null, color, { width: thickness });
      }
    }
  }

  // Hyperlinks, one area per line of linked text
  for (const anchor of container.querySelectorAll('a[href]')) {
    for (const rect of anchor.getClientRects()) {
      const box = local(rect);
      painter.addLink(box.left, box.top, box.width, box.height, anchor.getAttribute('href')!);
    }
  }
}

// Draws a text box's text; vertical text was laid out turned a quarter turn
// around the box's center, so it's rotated back into place
async function drawTextBox(ctx: DrawContext, node: HTMLElement, size: Size) {
  await drawTurnedText(ctx, node, node.getBoundingClientRect(), { x: size.width / 2, y: size.height / 2 });
}

// Draws text measured relative to `origin`, rotated around `center` if it was laid out turned
async function drawTurnedText(ctx: DrawContext, container: HTMLElement, origin: DOMRect, center: Point) {
  const rotation = Number(container.querySelector<HTMLElement>('[data-rotate]')?.dataset.rotate ?? 0);
  if (!rotation) return drawText(ctx, container, origin);
  const { painter } = ctx;
  painter.save();
  const radians = (rotation * Math.PI) / 180;
  painter.transform(1, 0, 0, 1, center.x, center.y);
  painter.transform(Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0);
  painter.transform(1, 0, 0, 1, -center.x, -center.y);
  await drawText(ctx, container, origin);
  painter.restore();
}

// Overlays that darken or lighten parts of preset shapes
const SHADES: Partial<Record<FillMode, Rgba>> = {
  darken: { r: 0, g: 0, b: 0, a: 0.4 },
  darkenLess: { r: 0, g: 0, b: 0, a: 0.2 },
  lighten: { r: 1, g: 1, b: 1, a: 0.4 },
  lightenLess: { r: 1, g: 1, b: 1, a: 0.2 },
};

// A shape's outlines: computed from PowerPoint's definition for preset shapes,
// or pptxtojson's path for custom ones
function shapePaths(el: ShapeElement): { paths: { segments: Segment[]; fill: FillMode; stroke: boolean }[]; preset: boolean } {
  const geometry = presetGeometry(el.shapType, el.width, el.height, adjustValues(el.keypoints));
  if (geometry) return { paths: geometry.paths, preset: true };
  if (!el.path) return { paths: [], preset: false };
  const viewBox = el.pathViewBox ?? { x: 0, y: 0, width: el.width, height: el.height };
  // The outline is scaled to the shape's size itself (scaling the drawing
  // would distort line widths, and flatten lines of zero width or height)
  const sx = viewBox.width ? el.width / viewBox.width : 1;
  const sy = viewBox.height ? el.height / viewBox.height : 1;
  return { paths: [{ segments: scaleSegments(parseSvgPath(el.path), sx, sy, -viewBox.x * sx, -viewBox.y * sy), fill: 'norm', stroke: true }], preset: false };
}

// Draws a shape's soft shadow, as a blurred image (PDF has no blur), in the
// shape's local coordinates. The offset is on the page, so it's turned into
// local coordinates first.
async function drawShadow(ctx: DrawContext, outline: Segment[], size: Size, shadow: Shadow, filled: boolean, lineWidth: number, transform: { rotate?: number; flipH?: boolean; flipV?: boolean }) {
  const color = parseColor(shadow.color);
  if (!color || !color.a) return;
  const blur = Number(shadow.blur) || 0;
  const radians = (-(transform.rotate ?? 0) * Math.PI) / 180;
  let dx = shadow.h * Math.cos(radians) - shadow.v * Math.sin(radians);
  let dy = shadow.h * Math.sin(radians) + shadow.v * Math.cos(radians);
  if (transform.flipH) dx = -dx;
  if (transform.flipV) dy = -dy;

  const pad = blur + lineWidth + 2;
  const scale = Math.min(2, 3000 / Math.max(size.width + 2 * pad, size.height + 2 * pad));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil((size.width + 2 * pad) * scale));
  canvas.height = Math.max(1, Math.ceil((size.height + 2 * pad) * scale));
  const c = canvas.getContext('2d');
  if (!c) return;
  // The shape is drawn off the canvas so that only its blurred canvas shadow lands on it
  const away = canvas.width + 100;
  Object.assign(c, { shadowColor: `rgb(${color.r * 255},${color.g * 255},${color.b * 255})`, shadowBlur: blur * scale, shadowOffsetX: away });
  c.setTransform(scale, 0, 0, scale, pad * scale - away, pad * scale);
  const path = new Path2D(segmentsToSvg(outline));
  if (filled) c.fill(path);
  if (lineWidth) {
    c.lineWidth = lineWidth;
    c.stroke(path);
  }
  ctx.painter.drawImage(await ctx.images.embedCanvas(canvas), dx - pad, dy - pad, canvas.width / scale, canvas.height / scale, color.a);
}

function drawLineEnd(painter: Painter, end: LineEnd | undefined, tip: Point, from: Point, lineWidth: number, color: Rgba) {
  if (!end || end.type === 'none') return;
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  // Arrowheads on thin lines are sized as if the line were 2pt wide, like Office's
  const base = Math.max(lineWidth, 2);
  const w = base * LINE_END_SIZES[end.width ?? 'med'];
  const l = base * LINE_END_SIZES[end.length ?? 'med'];
  painter.save();
  // Local coordinates: the tip at the origin, pointing along +x
  painter.transform(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), tip.x, tip.y);
  if (end.type === 'arrow') {
    painter.drawPath(`M${-l},${-w / 2} L0,0 L${-l},${w / 2}`, null, color, { width: lineWidth, cap: LineCapStyle.Round });
  } else if (end.type === 'oval') {
    painter.drawPath(ellipsePath(-l / 2, -w / 2, l, w), color);
  } else if (end.type === 'diamond') {
    painter.drawPath(`M${l / 2},0 L0,${-w / 2} L${-l / 2},0 L0,${w / 2} Z`, color);
  } else if (end.type === 'stealth') {
    painter.drawPath(`M0,0 L${-l},${-w / 2} L${-l * 0.7},0 L${-l},${w / 2} Z`, color);
  } else {
    painter.drawPath(`M0,0 L${-l},${-w / 2} L${-l},${w / 2} Z`, color);
  }
  painter.restore();
}

// Draws a WMF/EMF picture (usually an equation) scaled to fill `size`
async function drawMetafile(ctx: DrawContext, bytes: Uint8Array, size: Size) {
  const { painter } = ctx;
  const faceFor = (font: MetafileFont) => loadFace(font.symbol ? 'serif' : familyFor(font.face), font.bold, font.italic);
  const faces = new Map<string, Face>();
  const keyOf = (font: MetafileFont) => `${font.face}/${font.bold}/${font.italic}/${font.symbol}`;
  for (const font of metafileFonts(bytes)) faces.set(keyOf(font), await faceFor(font));
  const symbols = await loadFace('symbols', false, false);
  const faceOf = (font: MetafileFont) => faces.get(keyOf(font)) ?? symbols;
  // Character runs by font, with each character's advance at the given em size
  const runs = (text: string, font: MetafileFont, em: number) =>
    [...text].map((char) => {
      const primary = faceOf(font);
      const face = primary.font.hasGlyphForCodePoint(char.codePointAt(0)!) ? primary : symbols;
      return { char, face, advance: (face.font.glyphForCodePoint(char.codePointAt(0)!).advanceWidth / face.font.unitsPerEm) * em };
    });
  // GDI font heights are either the em size (negative) or the line height (positive)
  const emSize = (font: MetafileFont) => {
    const f = faceOf(font).font;
    return font.height < 0 ? -font.height : (font.height * f.unitsPerEm) / (f.ascent - f.descent);
  };

  const drawing = parseMetafile(bytes, (text, font) => runs(text, font, emSize(font)).reduce((sum, r) => sum + r.advance, 0));
  if (!drawing) return drawPlaceholder(ctx, size, 'Image not shown');
  const { bounds } = drawing;
  const sx = size.width / bounds.width;
  const sy = size.height / bounds.height;
  painter.save();
  painter.transform(sx, 0, 0, sy, -bounds.x * sx, -bounds.y * sy);
  // Hairline pens are drawn about half a point wide
  const hairline = 0.5 / Math.min(sx, sy);
  for (const item of drawing.items) {
    if (item.kind === 'path') {
      painter.drawPath(item.segments, item.fill, item.stroke, { width: item.strokeWidth || hairline, cap: LineCapStyle.Round }, item.evenOdd);
    } else if (item.kind === 'text') {
      const em = emSize(item.font);
      const chars = runs(item.text, item.font, em);
      const primary = faceOf(item.font).font;
      const baseline =
        item.valign === 'baseline' ? item.y
        : item.valign === 'top' ? item.y + (primary.ascent / primary.unitsPerEm) * em
        : item.y + (primary.descent / primary.unitsPerEm) * em;
      let x = item.xs[0];
      for (const [i, { char, face, advance }] of chars.entries()) {
        if (item.xs.length === chars.length) x = item.xs[i];
        if (char.trim()) {
          const font = await ctx.fonts.embed(face);
          // Equation editors place Symbol-font characters (like ∑ or bracket pieces)
          // for that font's glyph shapes, so stretch the stand-in glyph over the
          // Symbol glyph's box
          const code = item.font.symbol && !/mt extra/i.test(item.font.face) ? symbolCode(char) : null;
          const target = code === null ? null : SYMBOL_BOXES[code - 0x20];
          const glyph = face.font.glyphForCodePoint(char.codePointAt(0)!).bbox;
          const upm = face.font.unitsPerEm;
          if (target && glyph.maxX > glyph.minX && glyph.maxY > glyph.minY) {
            const kx = ((target[2] - target[0]) / 1000) / ((glyph.maxX - glyph.minX) / upm);
            const ky = ((target[3] - target[1]) / 1000) / ((glyph.maxY - glyph.minY) / upm);
            painter.save();
            painter.transform(kx, 0, 0, ky, x + em * (target[0] / 1000 - (glyph.minX / upm) * kx), baseline - em * (target[1] / 1000 - (glyph.minY / upm) * ky));
            painter.drawText(font, em, 0, 0, font.encodeText(char), item.color);
            painter.restore();
          } else {
            painter.drawText(font, em, x, baseline, font.encodeText(char), item.color);
          }
        }
        x += advance;
      }
    } else {
      const pixels = decodeDib(item.dib);
      if (pixels) painter.drawImage(await ctx.images.embedPixels(pixels), item.x, item.y, item.width, item.height);
    }
  }
  painter.restore();
}

type PictureElement = Box & Partial<Pick<ImageElement, 'rotate' | 'isFlipH' | 'isFlipV' | 'rect' | 'geom' | 'borderColor' | 'borderWidth' | 'borderType' | 'borderStrokeDasharray' | 'link'>>;

async function drawPicture(ctx: DrawContext, el: PictureElement, dataUrl: string, key?: string) {
  const { painter } = ctx;
  const { width: w, height: h } = el;
  painter.boxTransform(el, el.rotate, el.isFlipH, el.isFlipV);
  const outline =
    el.geom === 'ellipse' ? ellipsePath(0, 0, w, h)
    : el.geom === 'roundRect' ? roundRectPath(0, 0, w, h, Math.min(w, h) / 6)
    : rectPath(0, 0, w, h);
  const asset = await ctx.images.get(dataUrl, key);
  if (asset.kind === 'image') {
    // rect holds the percentage cropped from each edge of the source image
    const { t = 0, b = 0, l = 0, r = 0 } = el.rect ?? {};
    const imageWidth = w / ((100 - l - r) / 100);
    const imageHeight = h / ((100 - t - b) / 100);
    painter.save();
    painter.clipTo(outline);
    painter.drawImage(asset.image, (-l / 100) * imageWidth, (-t / 100) * imageHeight, imageWidth, imageHeight);
    painter.restore();
  } else if (asset.kind === 'metafile') {
    await drawMetafile(ctx, asset.bytes, el);
  } else {
    await drawPlaceholder(ctx, el, 'Image not shown');
  }
  if (el.borderWidth) {
    painter.drawPath(outline, null, parseColor(el.borderColor), { width: el.borderWidth, dash: dashPattern(el.borderType, el.borderWidth, el.borderStrokeDasharray) });
  }
  if (el.link) painter.addLink(0, 0, w, h, el.link);
}

async function drawTable(ctx: DrawContext, node: HTMLElement) {
  const { painter, ptPerPx } = ctx;
  const origin = node.getBoundingClientRect();
  const cells = Array.from(node.querySelectorAll('td'));
  const boxOf = (cell: HTMLElement) => {
    const rect = cell.getBoundingClientRect();
    return { left: (rect.left - origin.left) * ptPerPx, top: (rect.top - origin.top) * ptPerPx, width: rect.width * ptPerPx, height: rect.height * ptPerPx };
  };
  for (const cell of cells) {
    const box = boxOf(cell);
    painter.drawPath(rectPath(box.left, box.top, box.width, box.height), parseColor(getComputedStyle(cell).backgroundColor));
  }
  // Borders go over all fills so neighboring cells don't cover them
  for (const element of [...cells, node.querySelector('table')!]) {
    const box = boxOf(element);
    const style = getComputedStyle(element);
    const right = box.left + box.width;
    const bottom = box.top + box.height;
    const sides = {
      Top: `M${box.left},${box.top} L${right},${box.top}`,
      Bottom: `M${box.left},${bottom} L${right},${bottom}`,
      Left: `M${box.left},${box.top} L${box.left},${bottom}`,
      Right: `M${right},${box.top} L${right},${bottom}`,
    };
    for (const [side, path] of Object.entries(sides)) {
      const width = parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) * ptPerPx;
      const lineStyle = style.getPropertyValue(`border-${side.toLowerCase()}-style`);
      if (!width || lineStyle === 'none' || lineStyle === 'hidden') continue;
      painter.drawPath(path, null, parseColor(style.getPropertyValue(`border-${side.toLowerCase()}-color`)), { width, dash: dashPattern(lineStyle, width) });
    }
  }
  for (const cell of cells) {
    const box = boxOf(cell);
    await drawTurnedText(ctx, cell, origin, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
  }
}

async function drawElementContent(ctx: DrawContext, el: SlideElement, layout: SlideLayout) {
  const { painter } = ctx;
  switch (el.type) {
    case 'text': {
      painter.boxTransform(el, el.rotate);
      if (el.link) painter.addLink(0, 0, el.width, el.height, el.link);
      const outline = rectPath(0, 0, el.width, el.height);
      if (el.shadow && el.fill) await drawShadow(ctx, parseSvgPath(outline), el, el.shadow, true, el.borderWidth, { rotate: el.rotate });
      await fillPath(ctx, outline, el, el.fill);
      if (el.borderWidth) painter.drawPath(outline, null, parseColor(el.borderColor), { width: el.borderWidth, dash: dashPattern(el.borderType, el.borderWidth, el.borderStrokeDasharray) });
      const node = layout.nodes.get(el);
      if (node) await drawTextBox(ctx, node, el);
      break;
    }
    case 'shape': {
      painter.boxTransform(el, el.rotate);
      if (el.link) painter.addLink(0, 0, el.width, el.height, el.link);
      const { paths, preset } = shapePaths(el);
      if (paths.length) {
        painter.save();
        // Flips apply to the geometry, not the text
        painter.boxTransform({ left: 0, top: 0, width: el.width, height: el.height }, 0, el.isFlipH, el.isFlipV);
        // Preset definitions say which parts are filled (arcs and braces have a filled area too)
        const fillable = !el.fill || (el.strokeOnly && !preset) ? [] : paths.filter((p) => p.fill !== 'none');
        const stroked = paths.filter((p) => p.stroke);
        const color = parseColor(el.borderColor);
        const lineWidth = color ? el.borderWidth : 0;
        if (el.shadow && (fillable.length || lineWidth)) {
          const outline = (fillable.length ? fillable : stroked).flatMap((p) => p.segments);
          await drawShadow(ctx, outline, el, el.shadow, fillable.length > 0, lineWidth, { rotate: el.rotate, flipH: el.isFlipH, flipV: el.isFlipV });
        }
        for (const path of fillable) {
          await fillPath(ctx, path.segments, el, el.fill);
          // Shaded faces, like the top of a can or the sides of a cube
          const shade = SHADES[path.fill];
          if (shade) painter.drawPath(path.segments, shade);
        }
        if (lineWidth && color) {
          const dash = dashPattern(el.borderType, lineWidth, el.borderStrokeDasharray);
          for (const path of stroked) painter.drawPath(path.segments, null, color, { width: lineWidth, dash });
          const ends = stroked.length ? pathEnds(stroked[0].segments) : null;
          if (ends) {
            drawLineEnd(painter, el.headEnd, ends.start, ends.startToward, lineWidth, color);
            drawLineEnd(painter, el.tailEnd, ends.end, ends.endFrom, lineWidth, color);
          }
        }
        painter.restore();
      }
      const node = layout.nodes.get(el);
      if (node) await drawTextBox(ctx, node, el);
      break;
    }
    case 'image':
      await drawPicture(ctx, el, el.base64, el.ref);
      break;
    case 'math':
      await drawPicture(ctx, el, el.picBase64, el.picRef);
      break;
    case 'table': {
      painter.boxTransform(el);
      const node = layout.nodes.get(el);
      if (node) await drawTable(ctx, node);
      break;
    }
    case 'group':
    case 'diagram':
      if (el.type === 'group') painter.boxTransform(el, el.rotate, el.isFlipH, el.isFlipV);
      else painter.boxTransform(el);
      for (const child of el.elements) await drawElement(ctx, child, layout);
      break;
    case 'chart':
      painter.boxTransform(el);
      if (!(await drawChart(ctx, el))) await drawPlaceholder(ctx, el, 'Chart not shown');
      break;
    case 'video':
      painter.boxTransform(el);
      await drawPlaceholder(ctx, el, 'Video not shown');
      break;
  }
}

async function drawElement(ctx: DrawContext, el: SlideElement, layout: SlideLayout) {
  const { painter } = ctx;
  const mark = painter.mark();
  painter.save();
  try {
    await drawElementContent(ctx, el, layout);
  } catch (error) {
    // Drop whatever this element drew and mark it instead of failing the whole slide
    console.error(`Couldn't draw slide element "${'name' in el ? el.name : el.type}":`, error);
    painter.rollback(mark);
    painter.save();
    painter.boxTransform(el);
    await drawPlaceholder(ctx, el, "Couldn't show this").catch(() => {});
  }
  painter.restore();
}

// A page for a slide that couldn't be read at all
export async function drawUnreadableSlide(ctx: DrawContext, size: Size) {
  ctx.painter.drawPath(rectPath(0, 0, size.width, size.height), WHITE);
  await drawPlaceholder(ctx, size, "This slide couldn't be converted");
}

export async function drawSlide(ctx: DrawContext, slide: Slide, layout: SlideLayout, size: Size) {
  const background = rectPath(0, 0, size.width, size.height);
  ctx.painter.drawPath(background, WHITE);
  await fillPath(ctx, background, size, slide.fill);
  const charts = ctx.charts;
  // Charts on layouts aren't read from the XML, so they're drawn as placeholders
  ctx.charts = [];
  for (const el of slide.layoutElements) await drawElement(ctx, el, layout);
  ctx.charts = charts;
  for (const el of slide.elements) await drawElement(ctx, el, layout);
}
