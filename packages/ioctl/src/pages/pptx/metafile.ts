import type { Rgba } from './painter';
import { isSymbolFont, symbolFontToUnicode } from './symbolFont';
import type { Segment } from './svgPath';

// Interprets Windows Metafiles (WMF) and Enhanced Metafiles (EMF), the vector
// formats old equation editors, MathType and many embedded objects use for
// their previews. Browsers can't display them, so they're turned into simple
// drawing commands (paths, text, bitmaps) that are drawn straight into the PDF.
// Only the records those files commonly use are supported. EMFs saved by Mac
// Office also carry the picture's original PDF, which is used instead.

export interface MetafileFont {
  face: string;
  height: number; // GDI font height: negative = character height, positive = cell height
  bold: boolean;
  italic: boolean;
  underline: boolean;
  symbol: boolean; // Symbol-encoded font, already mapped to Unicode
}

// The area drawing is limited to: inside all of the paths (null: no limit)
export interface ClipPath {
  segments: Segment[];
  evenOdd: boolean;
}
export type Clip = readonly ClipPath[] | null;

export type MetafileItem = (
  | { kind: 'path'; segments: Segment[]; fill: Rgba | null; stroke: Rgba | null; strokeWidth: number; evenOdd: boolean }
  | { kind: 'text'; text: string; xs: number[]; y: number; valign: 'baseline' | 'top' | 'bottom'; font: MetafileFont; color: Rgba }
  // `alpha`: the bitmap has per-pixel (premultiplied) alpha, as AlphaBlend draws it
  | { kind: 'bitmap'; dib: Uint8Array; x: number; y: number; width: number; height: number; alpha?: boolean }
) & { clip: Clip };

export interface MetafileDrawing {
  bounds: { x: number; y: number; width: number; height: number };
  items: MetafileItem[];
}

// Measures text drawn in a metafile font at the given em size
export type MeasureText = (text: string, font: MetafileFont, emSize: number) => number;

const WMF_PLACEABLE_KEY = 0x9ac6cdd7;
const EMF_SIGNATURE = 0x464d4520; // " EMF"
const SYMBOL_CHARSET = 2;
// Code pages of single-byte font character sets (others are read as Windows-1252)
const CHARSET_ENCODINGS: Record<number, string> = {
  77: 'macintosh', 161: 'windows-1253', 162: 'windows-1254', 163: 'windows-1258', 177: 'windows-1255',
  178: 'windows-1256', 186: 'windows-1257', 204: 'windows-1251', 222: 'windows-874', 238: 'windows-1250',
};

// SetTextAlign flags
const TA_UPDATECP = 1;
const TA_HORIZONTAL = 6;
const TA_RIGHT = 2;
const TA_CENTER = 6;
const TA_VERTICAL = 24;
const TA_BOTTOM = 8;
const TA_BASELINE = 24;
const PS_NULL = 5;
const BS_NULL = 1;
// How a new clip combines with the current one
const RGN_AND = 1;
const RGN_DIFF = 4;
const RGN_COPY = 5;
const MM_ISOTROPIC = 7;
const MM_ANISOTROPIC = 8;

const isEmf = (view: DataView) => view.byteLength >= 44 && view.getUint32(0, true) === 1 && view.getUint32(40, true) === EMF_SIGNATURE;
const isWmf = (view: DataView) =>
  view.byteLength >= 22 &&
  (view.getUint32(0, true) === WMF_PLACEABLE_KEY || ((view.getUint16(0, true) === 1 || view.getUint16(0, true) === 2) && view.getUint16(2, true) === 9));

export function isMetafile(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return isEmf(view) || isWmf(view);
}

interface Pen { style: number; width: number; color: Rgba }
interface Brush { style: number; color: Rgba }
type GdiObject = { font: MetafileFont } | { pen: Pen } | { brush: Brush };
type Matrix = [number, number, number, number, number, number];

interface DcState {
  font: MetafileFont;
  pen: Pen;
  brush: Brush;
  textColor: Rgba;
  textAlign: number;
  polyFillEvenOdd: boolean;
  position: { x: number; y: number };
  windowOrg: { x: number; y: number };
  windowExt: { x: number; y: number } | null;
  viewportOrg: { x: number; y: number };
  viewportExt: { x: number; y: number } | null;
  mapMode: number;
  world: Matrix;
  clip: Clip;
}

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

const initialState = (): DcState => ({
  font: { face: 'Times New Roman', height: -12, bold: false, italic: false, underline: false, symbol: false },
  pen: { style: 0, width: 0, color: BLACK },
  brush: { style: 0, color: WHITE },
  textColor: BLACK,
  textAlign: 0,
  polyFillEvenOdd: true,
  position: { x: 0, y: 0 },
  windowOrg: { x: 0, y: 0 },
  windowExt: null,
  viewportOrg: { x: 0, y: 0 },
  viewportExt: null,
  mapMode: 1,
  world: [1, 0, 0, 1, 0, 0],
  clip: null,
});

const STOCK_OBJECTS: Record<number, GdiObject> = {
  0x80000000: { brush: { style: 0, color: WHITE } },
  0x80000001: { brush: { style: 0, color: { r: 0.75, g: 0.75, b: 0.75, a: 1 } } },
  0x80000002: { brush: { style: 0, color: { r: 0.5, g: 0.5, b: 0.5, a: 1 } } },
  0x80000003: { brush: { style: 0, color: { r: 0.25, g: 0.25, b: 0.25, a: 1 } } },
  0x80000004: { brush: { style: 0, color: BLACK } },
  0x80000005: { brush: { style: BS_NULL, color: WHITE } },
  0x80000006: { pen: { style: 0, width: 0, color: WHITE } },
  0x80000007: { pen: { style: 0, width: 0, color: BLACK } },
  0x80000008: { pen: { style: PS_NULL, width: 0, color: BLACK } },
};

const colorRef = (view: DataView, offset: number): Rgba => ({
  r: view.getUint8(offset) / 255,
  g: view.getUint8(offset + 1) / 255,
  b: view.getUint8(offset + 2) / 255,
  a: 1,
});

// Font names end up in the PDF, so keep only characters font names use
const cleanFaceName = (name: string) => name.split('\0')[0].replace(/[^\w .-]/g, '');

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

// A rectangle around everything, for clipping to what's outside a path (even-odd)
const OUTSIDE: Segment[] = [
  { type: 'M', to: { x: -1e7, y: -1e7 } },
  { type: 'L', to: { x: 1e7, y: -1e7 } },
  { type: 'L', to: { x: 1e7, y: 1e7 } },
  { type: 'L', to: { x: -1e7, y: 1e7 } },
  { type: 'Z' },
];

const multiply = (x: Matrix, y: Matrix): Matrix => [
  x[0] * y[0] + x[1] * y[2],
  x[0] * y[1] + x[1] * y[3],
  x[2] * y[0] + x[3] * y[2],
  x[2] * y[1] + x[3] * y[3],
  x[4] * y[0] + x[5] * y[2] + y[4],
  x[4] * y[1] + x[5] * y[3] + y[5],
];

// GDI drawing state machine; the WMF and EMF readers feed it records
class Interpreter {
  state = initialState();
  private saved: DcState[] = [];
  objects: (GdiObject | undefined)[] = [];
  items: MetafileItem[] = [];
  fontCharsets = new Map<MetafileFont, number>();
  private path: Segment[] | null = null; // Set while recording a path (BeginPath..EndPath)
  private recordedPath: Segment[] | null = null;
  private measure: MeasureText;
  // EMF maps logical coordinates through the viewport; WMF output stays in logical units
  private useViewport: boolean;

  constructor(measure: MeasureText, useViewport: boolean) {
    this.measure = measure;
    this.useViewport = useViewport;
  }

  private viewportScale() {
    const s = this.state;
    if (!this.useViewport || (s.mapMode !== MM_ISOTROPIC && s.mapMode !== MM_ANISOTROPIC) || !s.windowExt || !s.viewportExt) return null;
    return { x: s.viewportExt.x / s.windowExt.x, y: s.viewportExt.y / s.windowExt.y };
  }

  // Logical coordinates to output coordinates
  point(x: number, y: number) {
    const s = this.state;
    const [a, b, c, d, e, f] = s.world;
    let px = a * x + c * y + e;
    let py = b * x + d * y + f;
    const k = this.viewportScale();
    if (k) {
      px = (px - s.windowOrg.x) * k.x + s.viewportOrg.x;
      py = (py - s.windowOrg.y) * k.y + s.viewportOrg.y;
    }
    return { x: px, y: py };
  }

  // Scale applied to lengths such as pen widths and font heights
  scale() {
    const [a, b, c, d] = this.state.world;
    const k = this.viewportScale();
    return { sx: Math.hypot(a, b) * Math.abs(k?.x ?? 1), sy: Math.hypot(c, d) * Math.abs(k?.y ?? 1) };
  }

  addObject(object: GdiObject, index?: number) {
    if (index === undefined) {
      // WMF objects take the first free slot in the object table
      const free = this.objects.findIndex((o) => !o);
      index = free === -1 ? this.objects.length : free;
    }
    this.objects[index] = object;
  }

  select(object: GdiObject | undefined) {
    if (!object) return;
    if ('font' in object) this.state.font = object.font;
    if ('pen' in object) this.state.pen = object.pen;
    if ('brush' in object) this.state.brush = object.brush;
  }

  save() {
    this.saved.push({ ...this.state, position: { ...this.state.position } });
  }

  restore(levels: number) {
    let state: DcState | undefined;
    for (let i = 0; i < levels; i++) state = this.saved.pop() ?? state;
    if (state) this.state = state;
  }

  // Adds a drawing item, limited to the current clip
  add(item: DistributiveOmit<MetafileItem, 'clip'>) {
    this.items.push({ ...item, clip: this.state.clip } as MetafileItem);
  }

  // Combines a path (in output coordinates) with the clip
  clipTo(segments: Segment[], evenOdd: boolean, mode: number) {
    const s = this.state;
    if (mode === RGN_COPY) s.clip = [{ segments, evenOdd }];
    else if (mode === RGN_AND) s.clip = [...(s.clip ?? []), { segments, evenOdd }];
    else if (mode === RGN_DIFF) s.clip = [...(s.clip ?? []), { segments: [...OUTSIDE, ...segments], evenOdd: true }];
    // Unions (RGN_OR, RGN_XOR) are rare; the clip is left as it is
  }

  rectPath(left: number, top: number, right: number, bottom: number): Segment[] {
    const corners = [this.point(left, top), this.point(right, top), this.point(right, bottom), this.point(left, bottom)];
    return [...corners.map((to, i) => ({ type: i ? 'L' : 'M', to }) as Segment), { type: 'Z' }];
  }

  // Uses the recorded path (BeginPath..EndPath) as a clip
  clipToRecordedPath(mode: number) {
    const segments = this.recordedPath;
    this.recordedPath = null;
    if (segments) this.clipTo(segments, this.state.polyFillEvenOdd, mode);
  }

  decodeText(bytes: Uint8Array) {
    const font = this.state.font;
    if (font.symbol) return symbolFontToUnicode(String.fromCharCode(...bytes), font.face);
    return new TextDecoder(CHARSET_ENCODINGS[this.fontCharsets.get(font) ?? 0] ?? 'windows-1252').decode(bytes);
  }

  private emitPath(segments: Segment[], fill: boolean, stroke: boolean) {
    if (this.path) {
      this.path.push(...segments);
      return;
    }
    const s = this.state;
    const fillColor = fill && s.brush.style !== BS_NULL ? s.brush.color : null;
    const strokeColor = stroke && s.pen.style !== PS_NULL ? s.pen.color : null;
    if (!fillColor && !strokeColor) return;
    const { sx, sy } = this.scale();
    this.add({ kind: 'path', segments, fill: fillColor, stroke: strokeColor, strokeWidth: s.pen.width * ((sx + sy) / 2), evenOdd: s.polyFillEvenOdd });
  }

  polyline(points: [number, number][], closed: boolean) {
    if (points.length === 0) return;
    const segments: Segment[] = points.map(([x, y], i) => ({ type: i === 0 ? 'M' : 'L', to: this.point(x, y) }) as Segment);
    if (closed) segments.push({ type: 'Z' });
    this.emitPath(segments, closed, true);
  }

  bezier(points: [number, number][]) {
    if (points.length < 4) return;
    const segments: Segment[] = [{ type: 'M', to: this.point(...points[0]) }];
    for (let i = 1; i + 2 < points.length; i += 3) {
      segments.push({ type: 'C', c1: this.point(...points[i]), c2: this.point(...points[i + 1]), to: this.point(...points[i + 2]) });
    }
    this.emitPath(segments, false, true);
  }

  // Continues from the current position (the *To record variants)
  continueFromPosition(points: [number, number][], bezier: boolean) {
    if (points.length === 0) return;
    const p = this.state.position;
    const segments: Segment[] = this.path?.length ? [] : [{ type: 'M', to: this.point(p.x, p.y) }];
    if (bezier) {
      for (let i = 0; i + 2 < points.length; i += 3) {
        segments.push({ type: 'C', c1: this.point(...points[i]), c2: this.point(...points[i + 1]), to: this.point(...points[i + 2]) });
      }
    } else {
      for (const [x, y] of points) segments.push({ type: 'L', to: this.point(x, y) });
    }
    const [lastX, lastY] = points[points.length - 1];
    this.state.position = { x: lastX, y: lastY };
    this.emitPath(segments, false, true);
  }

  moveTo(x: number, y: number) {
    this.state.position = { x, y };
    this.path?.push({ type: 'M', to: this.point(x, y) });
  }

  lineTo(x: number, y: number) {
    this.continueFromPosition([[x, y]], false);
  }

  shape(left: number, top: number, right: number, bottom: number, kind: 'rect' | 'ellipse') {
    const a = this.point(left, top);
    const b = this.point(right, bottom);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    const k = 0.5523 / 2; // Control point offset for quarter-ellipse Béziers
    const cx = x + w / 2;
    const cy = y + h / 2;
    const segments: Segment[] =
      kind === 'rect'
        ? [{ type: 'M', to: { x, y } }, { type: 'L', to: { x: x + w, y } }, { type: 'L', to: { x: x + w, y: y + h } }, { type: 'L', to: { x, y: y + h } }, { type: 'Z' }]
        : [
            { type: 'M', to: { x: x + w, y: cy } },
            { type: 'C', c1: { x: x + w, y: cy + k * h }, c2: { x: cx + k * w, y: y + h }, to: { x: cx, y: y + h } },
            { type: 'C', c1: { x: cx - k * w, y: y + h }, c2: { x, y: cy + k * h }, to: { x, y: cy } },
            { type: 'C', c1: { x, y: cy - k * h }, c2: { x: cx - k * w, y }, to: { x: cx, y } },
            { type: 'C', c1: { x: cx + k * w, y }, c2: { x: x + w, y: cy - k * h }, to: { x: x + w, y: cy } },
            { type: 'Z' },
          ];
    this.emitPath(segments, true, true);
  }

  // Draws text at a reference point; dx holds each character's advance when the file provides it
  text(x: number, y: number, text: string, dx: number[] | null) {
    const s = this.state;
    if (s.textAlign & TA_UPDATECP) ({ x, y } = s.position);
    if (!text) return;
    const { sx, sy } = this.scale();
    const font = { ...s.font, height: s.font.height * sy };
    const advances = dx && dx.length >= text.length ? dx.slice(0, text.length).map((d) => d * sx) : null;
    const width = advances ? advances.reduce((sum, a) => sum + a, 0) : this.measure(text, font, Math.abs(font.height));
    const origin = this.point(x, y);
    const horizontal = s.textAlign & TA_HORIZONTAL;
    const startX = horizontal === TA_CENTER ? origin.x - width / 2 : horizontal === TA_RIGHT ? origin.x - width : origin.x;
    const xs = [startX];
    for (const advance of advances?.slice(0, -1) ?? []) xs.push(xs[xs.length - 1] + advance);
    const vertical = s.textAlign & TA_VERTICAL;
    const valign = vertical === TA_BASELINE ? 'baseline' : vertical === TA_BOTTOM ? 'bottom' : 'top';
    this.add({ kind: 'text', text, xs, y: origin.y, valign, font, color: s.textColor });
    if (s.textAlign & TA_UPDATECP) s.position = { x: x + width / (sx || 1), y };
  }

  beginPath() {
    this.path = [];
  }

  endPath() {
    this.recordedPath = this.path;
    this.path = null;
  }

  closeFigure() {
    this.path?.push({ type: 'Z' });
  }

  drawRecordedPath(fill: boolean, stroke: boolean) {
    const segments = this.recordedPath;
    this.recordedPath = null;
    if (segments?.length) this.emitPath(segments, fill, stroke);
  }
}

function readWmf(view: DataView, interpreter: Interpreter) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const int16 = (o: number) => view.getInt16(o, true);
  const uint16 = (o: number) => view.getUint16(o, true);
  const points = (start: number, count: number) => Array.from({ length: count }, (_, i) => [int16(start + i * 4), int16(start + i * 4 + 2)] as [number, number]);
  const state = () => interpreter.state;

  let offset = 0;
  let bounds = { x: 0, y: 0, width: 0, height: 0 };
  if (view.getUint32(0, true) === WMF_PLACEABLE_KEY) {
    bounds = { x: int16(6), y: int16(8), width: int16(10) - int16(6), height: int16(12) - int16(8) };
    offset = 22;
  }
  offset += uint16(offset + 2) * 2; // Header size is in 16-bit words

  while (offset + 6 <= view.byteLength) {
    const size = view.getUint32(offset, true) * 2;
    const fn = uint16(offset + 4);
    const p = offset + 6;
    if (fn === 0 || size < 6 || offset + size > view.byteLength) break;
    switch (fn) {
      case 0x020b: // SetWindowOrg
        state().windowOrg = { x: int16(p + 2), y: int16(p) };
        break;
      case 0x020c: // SetWindowExt
        state().windowExt = { x: int16(p + 2), y: int16(p) };
        break;
      case 0x0214: // MoveTo
        interpreter.moveTo(int16(p + 2), int16(p));
        break;
      case 0x0213: // LineTo
        interpreter.lineTo(int16(p + 2), int16(p));
        break;
      case 0x012e: // SetTextAlign
        state().textAlign = uint16(p);
        break;
      case 0x0209: // SetTextColor
        state().textColor = colorRef(view, p);
        break;
      case 0x0106: // SetPolyFillMode
        state().polyFillEvenOdd = uint16(p) !== 2;
        break;
      case 0x001e: // SaveDC
        interpreter.save();
        break;
      case 0x0127: // RestoreDC
        interpreter.restore(Math.abs(int16(p)) || 1);
        break;
      case 0x02fb: { // CreateFontIndirect
        const face = cleanFaceName(String.fromCharCode(...bytes.subarray(p + 18, Math.min(p + 50, offset + size))));
        const charset = view.getUint8(p + 13);
        const font: MetafileFont = {
          face,
          height: int16(p),
          bold: int16(p + 8) >= 600,
          italic: view.getUint8(p + 10) !== 0,
          underline: view.getUint8(p + 11) !== 0,
          symbol: charset === SYMBOL_CHARSET || isSymbolFont(face),
        };
        interpreter.fontCharsets.set(font, charset);
        interpreter.addObject({ font });
        break;
      }
      case 0x02fa: // CreatePenIndirect
        interpreter.addObject({ pen: { style: uint16(p) & 0xf, width: int16(p + 2), color: colorRef(view, p + 6) } });
        break;
      case 0x02fc: // CreateBrushIndirect
        interpreter.addObject({ brush: { style: uint16(p), color: colorRef(view, p + 2) } });
        break;
      case 0x012d: // SelectObject
        interpreter.select(interpreter.objects[uint16(p)]);
        break;
      case 0x01f0: // DeleteObject
        interpreter.objects[uint16(p)] = undefined;
        break;
      case 0x0a32: { // ExtTextOut
        const count = int16(p + 4);
        const options = uint16(p + 6);
        const textStart = p + 8 + (options & 0x6 ? 8 : 0); // Skip the clipping rectangle
        const dxStart = textStart + count + (count & 1);
        const dx = dxStart + count * 2 <= offset + size ? Array.from({ length: count }, (_, i) => int16(dxStart + i * 2)) : null;
        interpreter.text(int16(p + 2), int16(p), interpreter.decodeText(bytes.subarray(textStart, textStart + count)), dx);
        break;
      }
      case 0x0521: { // TextOut
        const count = int16(p);
        const end = p + 2 + count + (count & 1);
        interpreter.text(int16(end + 2), int16(end), interpreter.decodeText(bytes.subarray(p + 2, p + 2 + count)), null);
        break;
      }
      case 0x0324: // Polygon
        interpreter.polyline(points(p + 2, int16(p)), true);
        break;
      case 0x0325: // Polyline
        interpreter.polyline(points(p + 2, int16(p)), false);
        break;
      case 0x0538: { // PolyPolygon
        const polygons = uint16(p);
        let start = p + 2 + polygons * 2;
        for (let i = 0; i < polygons; i++) {
          const count = uint16(p + 2 + i * 2);
          interpreter.polyline(points(start, count), true);
          start += count * 4;
        }
        break;
      }
      case 0x041b: // Rectangle
        interpreter.shape(int16(p + 6), int16(p + 4), int16(p + 2), int16(p), 'rect');
        break;
      case 0x0418: // Ellipse
        interpreter.shape(int16(p + 6), int16(p + 4), int16(p + 2), int16(p), 'ellipse');
        break;
    }
    offset += size;
  }
  const { windowOrg, windowExt } = interpreter.state;
  return windowExt ? { x: windowOrg.x, y: windowOrg.y, width: windowExt.x, height: windowExt.y } : bounds;
}

// An EMF's picture frame (in 0.01 mm) converted to device units, or else its drawing's bounds
function emfBounds(view: DataView) {
  const int32 = (o: number) => view.getInt32(o, true);
  const devicePx = { x: int32(72), y: int32(76) };
  const deviceMm = { x: int32(80), y: int32(84) };
  const frame = { left: int32(24), top: int32(28), right: int32(32), bottom: int32(36) };
  if (deviceMm.x > 0 && deviceMm.y > 0 && frame.right > frame.left && frame.bottom > frame.top) {
    const kx = devicePx.x / (deviceMm.x * 100);
    const ky = devicePx.y / (deviceMm.y * 100);
    return { x: frame.left * kx, y: frame.top * ky, width: (frame.right - frame.left) * kx, height: (frame.bottom - frame.top) * ky };
  }
  return { x: int32(8), y: int32(12), width: int32(16) - int32(8), height: int32(20) - int32(12) };
}

const GDI_COMMENT = 0x43494447; // "GDIC"
const MULTIFORMATS_COMMENT = 0x40000004;
const PDF_FORMAT = 0x50444620; // "PDF "

// Mac Office keeps a picture's original PDF inside the EMF it saves (in a
// multiformat comment), with the GDI drawing as a fallback for other programs;
// Mac PowerPoint shows the PDF. Returns the PDF and where it goes, in the same
// units as the drawing's bounds.
export function embeddedPdf(bytes: Uint8Array): { pdf: Uint8Array; rect: { x: number; y: number; width: number; height: number }; bounds: MetafileDrawing['bounds'] } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!isEmf(view)) return null;
  const int32 = (o: number) => view.getInt32(o, true);
  const uint32 = (o: number) => view.getUint32(o, true);
  for (let offset = 0; offset + 8 <= view.byteLength; ) {
    const type = uint32(offset);
    const size = uint32(offset + 4);
    if (size < 8 || offset + size > view.byteLength || type === 14) break;
    // The comment's data starts with its identifier, which offsets count from
    const id = offset + 12;
    if (type === 70 && size >= 56 && uint32(id) === GDI_COMMENT && uint32(id + 4) === MULTIFORMATS_COMMENT) {
      const [left, top, right, bottom] = [int32(id + 8), int32(id + 12), int32(id + 16), int32(id + 20)];
      const count = uint32(id + 24);
      for (let i = 0; i < count && id + 44 + i * 16 <= offset + size; i++) {
        const format = id + 28 + i * 16;
        const length = uint32(format + 8);
        const start = id + uint32(format + 12);
        if (uint32(format) === PDF_FORMAT && start + length <= offset + size && right > left && bottom > top) {
          return { pdf: bytes.subarray(start, start + length), rect: { x: left, y: top, width: right - left, height: bottom - top }, bounds: emfBounds(view) };
        }
      }
    }
    offset += size;
  }
  return null;
}

function readEmf(view: DataView, interpreter: Interpreter) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const int32 = (o: number) => view.getInt32(o, true);
  const uint32 = (o: number) => view.getUint32(o, true);
  const float32 = (o: number) => view.getFloat32(o, true);
  const matrix = (o: number): Matrix => [float32(o), float32(o + 4), float32(o + 8), float32(o + 12), float32(o + 16), float32(o + 20)];
  const points32 = (start: number, count: number) => Array.from({ length: count }, (_, i) => [int32(start + i * 8), int32(start + i * 8 + 4)] as [number, number]);
  const points16 = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => [view.getInt16(start + i * 4, true), view.getInt16(start + i * 4 + 2, true)] as [number, number]);
  const state = () => interpreter.state;
  const bounds = emfBounds(view);

  let offset = 0;
  while (offset + 8 <= view.byteLength) {
    const type = uint32(offset);
    const size = uint32(offset + 4);
    const p = offset + 8;
    if (size < 8 || offset + size > view.byteLength) break;
    // Points of the poly* records follow a bounds rectangle and a count
    const polyPoints = (wide: boolean) => (wide ? points32 : points16)(p + 20, uint32(p + 16));
    switch (type) {
      case 2: // PolyBezier
      case 85: // PolyBezier16
        interpreter.bezier(polyPoints(type === 2));
        break;
      case 3: // Polygon
      case 86: // Polygon16
        interpreter.polyline(polyPoints(type === 3), true);
        break;
      case 4: // Polyline
      case 87: // Polyline16
        interpreter.polyline(polyPoints(type === 4), false);
        break;
      case 5: // PolyBezierTo
      case 88: // PolyBezierTo16
        interpreter.continueFromPosition(polyPoints(type === 5), true);
        break;
      case 6: // PolylineTo
      case 89: // PolylineTo16
        interpreter.continueFromPosition(polyPoints(type === 6), false);
        break;
      case 7: // PolyPolyline
      case 8: // PolyPolygon
      case 90: // PolyPolyline16
      case 91: { // PolyPolygon16
        const polys = uint32(p + 16);
        const wide = type === 7 || type === 8;
        const closed = type === 8 || type === 91;
        let start = p + 24 + polys * 4;
        for (let i = 0; i < polys; i++) {
          const count = uint32(p + 24 + i * 4);
          interpreter.polyline((wide ? points32 : points16)(start, count), closed);
          start += count * (wide ? 8 : 4);
        }
        break;
      }
      case 9: // SetWindowExtEx
        state().windowExt = { x: int32(p), y: int32(p + 4) };
        break;
      case 10: // SetWindowOrgEx
        state().windowOrg = { x: int32(p), y: int32(p + 4) };
        break;
      case 11: // SetViewportExtEx
        state().viewportExt = { x: int32(p), y: int32(p + 4) };
        break;
      case 12: // SetViewportOrgEx
        state().viewportOrg = { x: int32(p), y: int32(p + 4) };
        break;
      case 14: // EOF
        return bounds;
      case 17: // SetMapMode
        state().mapMode = uint32(p);
        break;
      case 19: // SetPolyFillMode
        state().polyFillEvenOdd = uint32(p) !== 2;
        break;
      case 22: // SetTextAlign
        state().textAlign = uint32(p);
        break;
      case 24: // SetTextColor
        state().textColor = colorRef(view, p);
        break;
      case 27: // MoveToEx
        interpreter.moveTo(int32(p), int32(p + 4));
        break;
      case 29: // ExcludeClipRect
      case 30: // IntersectClipRect
        interpreter.clipTo(interpreter.rectPath(int32(p), int32(p + 4), int32(p + 8), int32(p + 12)), false, type === 29 ? RGN_DIFF : RGN_AND);
        break;
      case 33: // SaveDC
        interpreter.save();
        break;
      case 34: // RestoreDC
        interpreter.restore(Math.abs(int32(p)) || 1);
        break;
      case 35: // SetWorldTransform
        state().world = matrix(p);
        break;
      case 36: { // ModifyWorldTransform
        const mode = uint32(p + 24);
        if (mode === 1) state().world = [1, 0, 0, 1, 0, 0];
        else if (mode === 2) state().world = multiply(matrix(p), state().world);
        else if (mode === 3) state().world = multiply(state().world, matrix(p));
        else if (mode === 4) state().world = matrix(p);
        break;
      }
      case 37: { // SelectObject
        const index = uint32(p);
        interpreter.select(index & 0x80000000 ? STOCK_OBJECTS[index] : interpreter.objects[index]);
        break;
      }
      case 38: // CreatePen
        interpreter.addObject({ pen: { style: uint32(p + 4) & 0xf, width: int32(p + 8), color: colorRef(view, p + 16) } }, uint32(p));
        break;
      case 95: // ExtCreatePen
        interpreter.addObject({ pen: { style: uint32(p + 20) & 0xf, width: uint32(p + 24), color: colorRef(view, p + 32) } }, uint32(p));
        break;
      case 39: // CreateBrushIndirect
        interpreter.addObject({ brush: { style: uint32(p + 4), color: colorRef(view, p + 8) } }, uint32(p));
        break;
      case 40: // DeleteObject
        interpreter.objects[uint32(p)] = undefined;
        break;
      case 42: // Ellipse
      case 43: // Rectangle
        interpreter.shape(int32(p), int32(p + 4), int32(p + 8), int32(p + 12), type === 42 ? 'ellipse' : 'rect');
        break;
      case 54: // LineTo
        interpreter.lineTo(int32(p), int32(p + 4));
        break;
      case 59: // BeginPath
        interpreter.beginPath();
        break;
      case 60: // EndPath
        interpreter.endPath();
        break;
      case 61: // CloseFigure
        interpreter.closeFigure();
        break;
      case 67: // SelectClipPath
        interpreter.clipToRecordedPath(uint32(p));
        break;
      case 75: { // ExtSelectClipRgn
        const regionSize = uint32(p);
        const mode = uint32(p + 4);
        if (!regionSize) {
          // Without a region, RGN_COPY removes the clip
          if (mode === RGN_COPY) state().clip = null;
          break;
        }
        // The region's rectangles, in device units (like the output)
        const count = uint32(p + 8 + 8);
        const rects: Segment[] = [];
        for (let i = 0; i < count; i++) {
          const r = p + 8 + 32 + i * 16;
          const [left, top, right, bottom] = [int32(r), int32(r + 4), int32(r + 8), int32(r + 12)];
          rects.push({ type: 'M', to: { x: left, y: top } }, { type: 'L', to: { x: right, y: top } }, { type: 'L', to: { x: right, y: bottom } }, { type: 'L', to: { x: left, y: bottom } }, { type: 'Z' });
        }
        interpreter.clipTo(rects, false, mode);
        break;
      }
      case 62: // FillPath
      case 63: // StrokeAndFillPath
      case 64: // StrokePath
        interpreter.drawRecordedPath(type !== 64, type !== 62);
        break;
      case 81: // StretchDIBits
      case 114: { // AlphaBlend
        // Where each record keeps its bitmap and destination size
        const [bmi, dest] = type === 81 ? [p + 40, p + 64] : [p + 76, p + 24];
        const offBmi = uint32(bmi);
        const cbBmi = uint32(bmi + 4);
        const offBits = uint32(bmi + 8);
        const cbBits = uint32(bmi + 12);
        if (!cbBmi || !cbBits) break;
        const dib = new Uint8Array(cbBmi + cbBits);
        dib.set(bytes.subarray(offset + offBmi, offset + offBmi + cbBmi));
        dib.set(bytes.subarray(offset + offBits, offset + offBits + cbBits), cbBmi);
        const a = interpreter.point(int32(p + 16), int32(p + 20));
        const b = interpreter.point(int32(p + 16) + int32(dest), int32(p + 20) + int32(dest + 4));
        // AlphaBlend's AC_SRC_ALPHA: the bitmap's own alpha channel applies
        const alpha = type === 114 && view.getUint8(p + 35) === 1;
        interpreter.add({ kind: 'bitmap', dib, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), alpha });
        break;
      }
      case 82: { // ExtCreateFontIndirectW
        const lf = p + 4;
        const face = cleanFaceName(new TextDecoder('utf-16le').decode(bytes.subarray(lf + 28, lf + 92)));
        const charset = view.getUint8(lf + 23);
        const font: MetafileFont = {
          face,
          height: int32(lf),
          bold: int32(lf + 16) >= 600,
          italic: view.getUint8(lf + 20) !== 0,
          underline: view.getUint8(lf + 21) !== 0,
          symbol: charset === SYMBOL_CHARSET || isSymbolFont(face),
        };
        interpreter.fontCharsets.set(font, charset);
        interpreter.addObject({ font }, uint32(p));
        break;
      }
      case 83: // ExtTextOutA
      case 84: { // ExtTextOutW
        const t = p + 28; // EMRTEXT
        const count = uint32(t + 8);
        const start = offset + uint32(t + 12);
        const options = uint32(t + 16);
        const offDx = uint32(t + 36);
        let text: string;
        if (type === 84) {
          text = String.fromCharCode(...Array.from({ length: count }, (_, i) => view.getUint16(start + i * 2, true)));
          if (state().font.symbol) text = symbolFontToUnicode(text, state().font.face);
        } else {
          text = interpreter.decodeText(bytes.subarray(start, start + count));
        }
        // With ETO_PDY each character has an x and a y advance
        const stride = options & 0x2000 ? 8 : 4;
        const dx = offDx ? Array.from({ length: count }, (_, i) => int32(offset + offDx + i * stride)) : null;
        interpreter.text(int32(t), int32(t + 4), text, dx);
        break;
      }
    }
    offset += size;
  }
  return bounds;
}

export function parseMetafile(bytes: Uint8Array, measure: MeasureText): MetafileDrawing | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const emf = isEmf(view);
  if (!emf && !isWmf(view)) return null;
  const interpreter = new Interpreter(measure, emf);
  const bounds = emf ? readEmf(view, interpreter) : readWmf(view, interpreter);
  if (!(bounds.width > 0) || !(bounds.height > 0)) return null;
  return { bounds, items: interpreter.items };
}

// Lists the fonts a metafile draws text with, so they can be loaded before it's drawn
export function metafileFonts(bytes: Uint8Array): MetafileFont[] {
  const fonts: MetafileFont[] = [];
  parseMetafile(bytes, () => 0)?.items.forEach((item) => {
    if (item.kind === 'text' && !fonts.some((f) => f.face === item.font.face && f.bold === item.font.bold && f.italic === item.font.italic)) {
      fonts.push(item.font);
    }
  });
  return fonts;
}

// Decodes a device-independent bitmap (as embedded in EMF files) to pixels
// `alpha`: 32-bit pixels carry premultiplied alpha (as AlphaBlend uses)
export function decodeDib(dib: Uint8Array, alpha = false): ImageData | null {
  const view = new DataView(dib.buffer, dib.byteOffset, dib.byteLength);
  const headerSize = view.getUint32(0, true);
  if (headerSize < 40) return null;
  const width = view.getInt32(4, true);
  const rawHeight = view.getInt32(8, true);
  const height = Math.abs(rawHeight);
  const bitCount = view.getUint16(14, true);
  const compression = view.getUint32(16, true);
  // Only uncompressed (BI_RGB) and bit-field (BI_BITFIELDS) bitmaps
  if (width <= 0 || height <= 0 || width * height > 50_000_000 || (compression !== 0 && compression !== 3)) return null;
  const colorCount = bitCount <= 8 ? view.getUint32(32, true) || 1 << bitCount : 0;
  const paletteStart = headerSize + (compression === 3 && headerSize === 40 ? 12 : 0);
  const palette = Array.from({ length: colorCount }, (_, i) => [dib[paletteStart + i * 4 + 2], dib[paletteStart + i * 4 + 1], dib[paletteStart + i * 4]]);
  const bitsStart = paletteStart + colorCount * 4;
  const stride = Math.floor((width * bitCount + 31) / 32) * 4;
  if (bitsStart + stride * height > dib.length) return null;
  const pixels = new ImageData(width, height);
  for (let row = 0; row < height; row++) {
    // Rows are stored bottom-up unless the height is negative
    const src = bitsStart + (rawHeight > 0 ? height - 1 - row : row) * stride;
    for (let x = 0; x < width; x++) {
      let rgb: number[];
      let a = 255;
      if (bitCount === 32 && alpha) {
        const i = src + x * 4;
        a = dib[i + 3];
        const k = a ? 255 / a : 0;
        rgb = [dib[i + 2] * k, dib[i + 1] * k, dib[i] * k];
      } else if (bitCount === 24 || bitCount === 32) {
        const i = src + x * (bitCount / 8);
        rgb = [dib[i + 2], dib[i + 1], dib[i]];
      } else if (bitCount === 16) {
        const v = dib[src + x * 2] | (dib[src + x * 2 + 1] << 8);
        rgb = [((v >> 10) & 31) * 8.226, ((v >> 5) & 31) * 8.226, (v & 31) * 8.226];
      } else if (bitCount === 1 || bitCount === 4 || bitCount === 8) {
        const bit = x * bitCount;
        const index = (dib[src + (bit >> 3)] >> (8 - bitCount - (bit & 7))) & ((1 << bitCount) - 1);
        rgb = palette[index] ?? [0, 0, 0];
      } else {
        return null;
      }
      pixels.data.set([rgb[0], rgb[1], rgb[2], a], (row * width + x) * 4);
    }
  }
  return pixels;
}
