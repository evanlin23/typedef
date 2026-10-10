import {
  LineCapStyle,
  LineJoinStyle,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  TextRenderingMode,
  appendBezierCurve,
  beginText,
  clip,
  closePath,
  concatTransformationMatrix,
  drawObject,
  endPath,
  endText,
  fill,
  fillAndStroke,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSpacing,
  setDashPattern,
  setFillingRgbColor,
  setFontAndSize,
  setGraphicsState,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  setTextMatrix,
  setTextRenderingMode,
  showText,
  stroke,
  type PDFDocument,
  type PDFFont,
  type PDFHexString,
  type PDFImage,
  type PDFPage,
  type PDFRef,
} from 'pdf-lib';
import { parseSvgPath, type Segment } from './svgPath';

// Draws onto a PDF page in a top-left, y-down coordinate system (like the DOM),
// in points.

export type Rgba = { r: number; g: number; b: number; a: number };

export function parseColor(css: string | null | undefined): Rgba | null {
  if (!css) return null;
  const value = css.trim().toLowerCase();
  const hex = value.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) : 1 };
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/)?.[1];
  if (rgb) {
    const [r, g, b, a = '1'] = rgb.split(/[\s,/]+/).filter(Boolean);
    return { r: Number(r) / 255, g: Number(g) / 255, b: Number(b) / 255, a: Number(a) };
  }
  if (value === 'white') return { r: 1, g: 1, b: 1, a: 1 };
  if (value === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}

export interface GradientStop {
  offset: number; // 0-1
  color: Rgba;
}

export interface StrokeStyle {
  width: number;
  dash?: number[];
  cap?: LineCapStyle;
  join?: LineJoinStyle;
}

type Matrix = [number, number, number, number, number, number];

// A clickable area on the page, in PDF coordinates (y up)
export interface PageLink {
  rect: [number, number, number, number];
  target: string;
}

export class Painter {
  private ops: PDFOperator[] = [];
  // The current transformation, tracked to place link areas on the page
  private ctm: Matrix;
  private ctmStack: Matrix[] = [];
  links: PageLink[] = [];
  private fonts = new Map<PDFFont, PDFName>();
  private alphas = new Map<string, PDFName>();
  private nextShading = 0;
  private page: PDFPage;
  private doc: PDFDocument;

  constructor(page: PDFPage, doc: PDFDocument) {
    this.page = page;
    this.doc = doc;
    this.ctm = [1, 0, 0, -1, 0, page.getHeight()];
    this.ops.push(pushGraphicsState(), concatTransformationMatrix(...this.ctm));
  }

  save() {
    this.ops.push(pushGraphicsState());
    this.ctmStack.push(this.ctm);
  }

  restore() {
    this.ops.push(popGraphicsState());
    this.ctm = this.ctmStack.pop() ?? this.ctm;
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.ops.push(concatTransformationMatrix(a, b, c, d, e, f));
    const [A, B, C, D, E, F] = this.ctm;
    this.ctm = [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F];
  }

  // Makes a box (in the current coordinates) a link to `target`
  addLink(x: number, y: number, width: number, height: number, target: string) {
    if (!(width > 0) || !(height > 0)) return;
    const [a, b, c, d, e, f] = this.ctm;
    const corners = [
      [x, y + height],
      [x + width, y + height],
      [x + width, y],
      [x, y],
    ].map(([px, py]) => [a * px + c * py + e, b * px + d * py + f]);
    const xs = corners.map((p) => p[0]);
    const ys = corners.map((p) => p[1]);
    this.links.push({ rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], target });
  }

  // Moves to a box's top-left corner, then rotates (degrees) and flips around its center
  boxTransform(box: { left: number; top: number; width: number; height: number }, rotate = 0, flipH = false, flipV = false) {
    this.transform(1, 0, 0, 1, box.left, box.top);
    if (!rotate && !flipH && !flipV) return;
    const cx = box.width / 2;
    const cy = box.height / 2;
    this.transform(1, 0, 0, 1, cx, cy);
    if (rotate) {
      const radians = (rotate * Math.PI) / 180;
      this.transform(Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0);
    }
    if (flipH || flipV) this.transform(flipH ? -1 : 1, 0, 0, flipV ? -1 : 1, 0, 0);
    this.transform(1, 0, 0, 1, -cx, -cy);
  }

  private appendPath(path: string | Segment[]) {
    for (const s of typeof path === 'string' ? parseSvgPath(path) : path) {
      if (s.type === 'M') this.ops.push(moveTo(s.to.x, s.to.y));
      else if (s.type === 'L') this.ops.push(lineTo(s.to.x, s.to.y));
      else if (s.type === 'C') this.ops.push(appendBezierCurve(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y));
      else this.ops.push(closePath());
    }
  }

  private setAlpha(fillAlpha: number, strokeAlpha: number) {
    if (fillAlpha >= 1 && strokeAlpha >= 1) return;
    const key = `${fillAlpha.toFixed(3)}/${strokeAlpha.toFixed(3)}`;
    let name = this.alphas.get(key);
    if (!name) {
      name = this.page.node.newExtGState('GS', this.doc.context.obj({ Type: 'ExtGState', ca: fillAlpha, CA: strokeAlpha }));
      this.alphas.set(key, name);
    }
    this.ops.push(setGraphicsState(name));
  }

  private setStroke(color: Rgba, style: StrokeStyle) {
    this.ops.push(
      setStrokingRgbColor(color.r, color.g, color.b),
      setLineWidth(style.width),
      setLineCap(style.cap ?? LineCapStyle.Butt),
      setLineJoin(style.join ?? LineJoinStyle.Miter),
      setDashPattern(style.dash ?? [], 0)
    );
  }

  // Position in the drawing, to undo everything drawn after it (see rollback)
  mark() {
    return { ops: this.ops.length, links: this.links.length, ctm: this.ctm, stack: [...this.ctmStack] };
  }

  rollback(mark: ReturnType<Painter['mark']>) {
    this.ops.length = mark.ops;
    this.links.length = mark.links;
    this.ctm = mark.ctm;
    this.ctmStack = [...mark.stack];
  }

  // Fills and/or strokes a path given as SVG path data or parsed segments
  drawPath(path: string | Segment[], fillColor: Rgba | null, strokeColor?: Rgba | null, strokeStyle?: StrokeStyle, evenOdd = false) {
    const doStroke = !!strokeColor && !!strokeStyle && strokeStyle.width > 0 && strokeColor.a > 0;
    const doFill = !!fillColor && fillColor.a > 0;
    if (!doFill && !doStroke) return;
    this.save();
    this.setAlpha(doFill ? fillColor!.a : 1, doStroke ? strokeColor!.a : 1);
    if (doFill) this.ops.push(setFillingRgbColor(fillColor!.r, fillColor!.g, fillColor!.b));
    if (doStroke) this.setStroke(strokeColor!, strokeStyle!);
    this.appendPath(path);
    if (doFill && evenOdd) this.ops.push(PDFOperator.of(doStroke ? PDFOperatorNames.FillEvenOddAndStroke : PDFOperatorNames.FillEvenOdd));
    else this.ops.push(doFill && doStroke ? fillAndStroke() : doFill ? fill() : stroke());
    this.restore();
  }

  // Restricts later drawing (until the matching restore) to the inside of a path
  clipTo(path: string | Segment[]) {
    this.appendPath(path);
    this.ops.push(clip(), endPath());
  }

  // Fills a path with a linear (angle in degrees, clockwise from +x) or radial
  // gradient spanning the box (0, 0, width, height)
  drawGradient(path: string | Segment[], box: { width: number; height: number }, stops: GradientStop[], type: 'linear' | 'radial', angle = 0) {
    if (stops.length === 0) return;
    const { context } = this.doc;
    const sorted = [...stops].sort((a, b) => a.offset - b.offset);
    const colorArray = (c: Rgba) => [c.r, c.g, c.b];
    const pieces = sorted.slice(1).map((stop, i) => context.obj({ FunctionType: 2, Domain: [0, 1], C0: colorArray(sorted[i].color), C1: colorArray(stop.color), N: 1 }));
    const fn =
      pieces.length === 0
        ? context.obj({ FunctionType: 2, Domain: [0, 1], C0: colorArray(sorted[0].color), C1: colorArray(sorted[0].color), N: 1 })
        : pieces.length === 1
          ? pieces[0]
          : context.obj({
              FunctionType: 3,
              Domain: [0, 1],
              Functions: pieces,
              Bounds: sorted.slice(1, -1).map((s) => s.offset),
              Encode: pieces.flatMap(() => [0, 1]),
            });
    // Stops at offsets other than 0 and 1 are reached by extending the end colors
    const t0 = sorted[0].offset;
    const t1 = sorted[sorted.length - 1].offset;
    const { width: w, height: h } = box;
    let coords: number[];
    if (type === 'linear') {
      const radians = (angle * Math.PI) / 180;
      const dx = Math.cos(radians);
      const dy = Math.sin(radians);
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
      const at = (t: number) => [w / 2 + dx * half * (2 * t - 1), h / 2 + dy * half * (2 * t - 1)];
      coords = [...at(t0), ...at(t1)];
    } else {
      const radius = Math.hypot(w, h) / 2;
      coords = [w / 2, h / 2, radius * t0, w / 2, h / 2, radius * t1];
    }
    const shading = context.register(
      context.obj({ ShadingType: type === 'linear' ? 2 : 3, ColorSpace: 'DeviceRGB', Coords: coords, Function: fn, Extend: [true, true] })
    );
    const resources = this.page.node.normalizedEntries().Resources;
    let shadings = resources.lookupMaybe(PDFName.of('Shading'), PDFDict);
    if (!shadings) {
      shadings = context.obj({});
      resources.set(PDFName.of('Shading'), shadings);
    }
    const name = PDFName.of(`Sh${this.nextShading++}-${Math.random().toString(36).slice(2, 8)}`);
    shadings.set(name, shading);
    this.save();
    this.clipTo(path);
    this.ops.push(PDFOperator.of(PDFOperatorNames.ShadingFill, [name]));
    this.restore();
  }

  // Draws an image upright into the rectangle (x, y, width, height)
  drawImage(image: PDFImage | PDFRef, x: number, y: number, width: number, height: number, alpha = 1) {
    const ref = 'ref' in image ? image.ref : image;
    const name = this.page.node.newXObject('Image', ref);
    this.save();
    this.setAlpha(alpha, 1);
    this.transform(width, 0, 0, -height, x, y + height);
    this.ops.push(drawObject(name));
    this.restore();
  }

  private fontName(font: PDFFont) {
    let name = this.fonts.get(font);
    if (!name) {
      name = this.page.node.newFontDictionary(font.name, font.ref);
      this.fonts.set(font, name);
    }
    return name;
  }

  // Draws text with its baseline starting at (x, baseline)
  // `text` is encoded text, or a list of encoded pieces with position
  // adjustments between them (in thousandths of the font size; positive moves left)
  drawText(font: PDFFont, size: number, x: number, baseline: number, text: PDFHexString | (PDFHexString | number)[], color: Rgba, charSpacing = 0) {
    this.save();
    this.setAlpha(color.a, 1);
    let show: PDFOperator;
    if (Array.isArray(text)) {
      const array = PDFArray.withContext(this.doc.context);
      for (const item of text) array.push(typeof item === 'number' ? PDFNumber.of(item) : item);
      show = PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [array]);
    } else {
      show = showText(text);
    }
    this.ops.push(
      setFillingRgbColor(color.r, color.g, color.b),
      beginText(),
      setFontAndSize(this.fontName(font), size),
      setCharacterSpacing(charSpacing),
      setTextMatrix(1, 0, 0, -1, x, baseline),
      show,
      endText()
    );
    this.restore();
  }

  // Adds text that isn't drawn but can be searched and selected, stretched to fill the box
  drawInvisibleText(fontRef: PDFRef, encoded: PDFHexString, glyphCount: number, glyphWidth: number, box: { left: number; top: number; width: number; height: number }) {
    const name = this.page.node.newFontDictionary('Invisible', fontRef);
    const scale = (100 * box.width) / (glyphCount * box.height * glyphWidth);
    this.ops.push(
      beginText(),
      setTextRenderingMode(TextRenderingMode.Invisible),
      setFontAndSize(name, box.height),
      PDFOperator.of(PDFOperatorNames.SetTextHorizontalScaling, [this.doc.context.obj(scale)]),
      setTextMatrix(1, 0, 0, -1, box.left, box.top + box.height),
      showText(encoded),
      endText()
    );
  }

  finish() {
    this.ops.push(popGraphicsState());
    this.page.pushOperators(...this.ops);
    this.ops = [];
  }
}
