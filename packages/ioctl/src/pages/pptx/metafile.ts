import { isSymbolFont, symbolFontToUnicode } from './symbolFont';

// Browsers can't display Windows Metafiles (WMF), the format MathType and the
// old Equation Editor use for equation previews, so this converts them to SVG.
// It covers the records those equations use: text, lines and polygons.

const PLACEABLE_KEY = 0x9ac6cdd7;
const SYMBOL_CHARSET = 2;
// Code pages of the single-byte font character sets (others are read as Windows-1252)
const CHARSET_ENCODINGS: Record<number, string> = {
  77: 'macintosh', 161: 'windows-1253', 162: 'windows-1254', 163: 'windows-1258', 177: 'windows-1255',
  178: 'windows-1256', 186: 'windows-1257', 204: 'windows-1251', 222: 'windows-874', 238: 'windows-1250',
};
const PS_NULL = 5;
const BS_NULL = 1;
// SetTextAlign flags
const TA_UPDATECP = 1;
const TA_HORIZONTAL = 6;
const TA_RIGHT = 2;
const TA_CENTER = 6;
const TA_VERTICAL = 24;
const TA_BOTTOM = 8;
const TA_BASELINE = 24;

interface Font { height: number; weight: number; italic: boolean; underline: boolean; face: string; charset: number }
interface Pen { style: number; width: number; color: string }
interface Brush { style: number; color: string }
type GdiObject = { font: Font } | { pen: Pen } | { brush: Brush };

let measureContext: CanvasRenderingContext2D | null = null;

function measureText(text: string, font: string) {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return 0;
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

const escapeXml = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function wmfToSvg(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);
  const int16 = (offset: number) => view.getInt16(offset, true);
  const uint16 = (offset: number) => view.getUint16(offset, true);
  const color = (offset: number) => `rgb(${view.getUint8(offset)},${view.getUint8(offset + 1)},${view.getUint8(offset + 2)})`;
  const bytes = (offset: number, length: number) => new Uint8Array(buffer, offset, Math.max(0, Math.min(length, buffer.byteLength - offset)));

  let offset = 0;
  const window = { x: 0, y: 0, width: 0, height: 0 };
  if (buffer.byteLength >= 22 && view.getUint32(0, true) === PLACEABLE_KEY) {
    Object.assign(window, { x: int16(6), y: int16(8), width: int16(10) - int16(6), height: int16(12) - int16(8) });
    offset = 22;
  }
  if (buffer.byteLength < offset + 18) return null;
  offset += uint16(offset + 2) * 2; // Header size is in 16-bit words

  const objects: (GdiObject | undefined)[] = [];
  let font: Font = { height: -12, weight: 400, italic: false, underline: false, face: 'Times New Roman', charset: 0 };
  let pen: Pen = { style: 0, width: 0, color: 'rgb(0,0,0)' };
  let brush: Brush = { style: 0, color: 'rgb(255,255,255)' };
  let textColor = 'rgb(0,0,0)';
  let textAlign = 0;
  const position = { x: 0, y: 0 };
  const shapes: string[] = [];

  const strokeAttrs = () =>
    pen.style === PS_NULL
      ? 'stroke="none"'
      : `stroke="${pen.color}" stroke-linecap="round" stroke-linejoin="round" ${pen.width > 0 ? `stroke-width="${pen.width}"` : 'stroke-width="1" vector-effect="non-scaling-stroke"'}`;
  const points = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => `${int16(start + i * 4)},${int16(start + i * 4 + 2)}`).join(' ');

  const drawText = (x: number, y: number, raw: Uint8Array, dx: number[] | null) => {
    if (textAlign & TA_UPDATECP) ({ x, y } = position);
    const symbol = font.charset === SYMBOL_CHARSET || isSymbolFont(font.face);
    const text = symbol
      ? symbolFontToUnicode(String.fromCharCode(...raw), font.face)
      : new TextDecoder(CHARSET_ENCODINGS[font.charset] ?? 'windows-1252').decode(raw);
    // Negative heights are the character height; positive ones include internal leading
    const size = font.height < 0 ? -font.height : font.height * 0.8;
    const family = symbol ? '"Times New Roman", serif' : `"${font.face}", "Times New Roman", serif`;
    const cssFont = `${font.italic ? 'italic ' : ''}${font.weight} ${size}px ${family}`;
    const width = dx ? dx.reduce((sum, d) => sum + d, 0) : measureText(text, cssFont);

    const horizontal = textAlign & TA_HORIZONTAL;
    const startX = horizontal === TA_CENTER ? x - width / 2 : horizontal === TA_RIGHT ? x - width : x;
    // Position each character individually when the file gives their advances
    const xs = [startX];
    for (const advance of dx?.slice(0, -1) ?? []) xs.push(xs[xs.length - 1] + advance);
    const vertical = textAlign & TA_VERTICAL;
    const baseline = vertical === TA_BASELINE ? '' : `dominant-baseline="${vertical === TA_BOTTOM ? 'text-after-edge' : 'text-before-edge'}"`;
    shapes.push(
      `<text x="${xs.join(' ')}" y="${y}" ${baseline} font-family='${family}' font-size="${size}" font-weight="${font.weight}"` +
        `${font.italic ? ' font-style="italic"' : ''}${font.underline ? ' text-decoration="underline"' : ''} fill="${textColor}" xml:space="preserve">${escapeXml(text)}</text>`
    );
    if (textAlign & TA_UPDATECP) position.x = startX + width;
  };

  while (offset + 6 <= buffer.byteLength) {
    const size = view.getUint32(offset, true) * 2;
    const fn = uint16(offset + 4);
    const p = offset + 6;
    if (fn === 0 || size < 6 || offset + size > buffer.byteLength) break;
    switch (fn) {
      case 0x020b: // SetWindowOrg
        window.y = int16(p);
        window.x = int16(p + 2);
        break;
      case 0x020c: // SetWindowExt
        window.height = int16(p);
        window.width = int16(p + 2);
        break;
      case 0x0214: // MoveTo
        position.y = int16(p);
        position.x = int16(p + 2);
        break;
      case 0x0213: // LineTo
        shapes.push(`<line x1="${position.x}" y1="${position.y}" x2="${int16(p + 2)}" y2="${int16(p)}" ${strokeAttrs()}/>`);
        position.y = int16(p);
        position.x = int16(p + 2);
        break;
      case 0x012e: // SetTextAlign
        textAlign = uint16(p);
        break;
      case 0x0209: // SetTextColor
        textColor = color(p);
        break;
      case 0x02fb: // CreateFontIndirect
      case 0x02fa: // CreatePenIndirect
      case 0x02fc: { // CreateBrushIndirect
        const object: GdiObject =
          fn === 0x02fb
            ? {
                font: {
                  height: int16(p),
                  weight: int16(p + 8) || 400,
                  italic: view.getUint8(p + 10) !== 0,
                  underline: view.getUint8(p + 11) !== 0,
                  charset: view.getUint8(p + 13),
                  // Font names end up in SVG markup, so keep only characters font names use
                  face: String.fromCharCode(...bytes(p + 18, Math.min(32, offset + size - (p + 18)))).split('\0')[0].replace(/[^\w .-]/g, ''),
                },
              }
            : fn === 0x02fa
              ? { pen: { style: uint16(p) & 0xf, width: int16(p + 2), color: color(p + 6) } }
              : { brush: { style: uint16(p), color: color(p + 2) } };
        // New objects take the first free slot in the object table
        const slot = objects.findIndex((o) => !o);
        objects[slot === -1 ? objects.length : slot] = object;
        break;
      }
      case 0x012d: { // SelectObject
        const object = objects[uint16(p)];
        if (object && 'font' in object) font = object.font;
        if (object && 'pen' in object) pen = object.pen;
        if (object && 'brush' in object) brush = object.brush;
        break;
      }
      case 0x01f0: // DeleteObject
        objects[uint16(p)] = undefined;
        break;
      case 0x0a32: { // ExtTextOut
        const count = int16(p + 4);
        const options = uint16(p + 6);
        const textStart = p + 8 + (options & 0x6 ? 8 : 0); // Skip the clipping rectangle
        const dxStart = textStart + count + (count & 1);
        const dx = dxStart + count * 2 <= offset + size ? Array.from({ length: count }, (_, i) => int16(dxStart + i * 2)) : null;
        drawText(int16(p + 2), int16(p), bytes(textStart, count), dx);
        break;
      }
      case 0x0521: { // TextOut
        const count = int16(p);
        const end = p + 2 + count + (count & 1);
        drawText(int16(end + 2), int16(end), bytes(p + 2, count), null);
        break;
      }
      case 0x0324: // Polygon
      case 0x0325: // Polyline
        shapes.push(
          `<${fn === 0x0324 ? 'polygon' : 'polyline'} points="${points(p + 2, int16(p))}" ` +
            `fill="${fn === 0x0324 && brush.style !== BS_NULL ? brush.color : 'none'}" ${strokeAttrs()}/>`
        );
        break;
    }
    offset += size;
  }

  if (window.width <= 0 || window.height <= 0) return null;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${window.width}" height="${window.height}" viewBox="${window.x} ${window.y} ${window.width} ${window.height}" ` +
    `preserveAspectRatio="none">${shapes.join('')}</svg>`
  );
}
