import { describe, expect, it } from 'vitest';
import { isMetafile, metafileFonts, parseMetafile } from './metafile';

// Builds metafiles record by record
class Writer {
  bytes: number[] = [];
  u16(...values: number[]) {
    for (const v of values) this.bytes.push(v & 0xff, (v >> 8) & 0xff);
    return this;
  }
  u32(...values: number[]) {
    for (const v of values) this.u16(v & 0xffff, (v >>> 16) & 0xffff);
    return this;
  }
  i16(...values: number[]) {
    return this.u16(...values.map((v) => v & 0xffff));
  }
  i32(...values: number[]) {
    return this.u32(...values.map((v) => v >>> 0));
  }
  utf16(text: string, length = text.length) {
    for (let i = 0; i < length; i++) this.u16(text.charCodeAt(i) || 0);
    return this;
  }
}

function emf(build: (record: (type: number, body: Writer) => void) => void) {
  const records: number[][] = [];
  const record = (type: number, body: Writer) => {
    while (body.bytes.length % 4) body.bytes.push(0);
    records.push(new Writer().u32(type, 8 + body.bytes.length).bytes.concat(body.bytes));
  };
  build(record);
  record(14, new Writer().u32(0, 16, 0));
  // Header: 200x100 pixel bounds, frame in 0.01 mm at 96 dpi
  const header = new Writer().i32(0, 0, 199, 99, 0, 0, 5292, 2646).u32(0x464d4520, 0x10000, 0, records.length + 1).u16(8, 0).u32(0, 0, 0).i32(1920, 1080, 508, 286);
  const headerRecord = new Writer().u32(1, 8 + header.bytes.length).bytes.concat(header.bytes);
  const bytes = new Uint8Array(headerRecord.concat(...records));
  new DataView(bytes.buffer).setUint32(48, bytes.length, true);
  return bytes;
}

const measure = (text: string, _font: unknown, em: number) => text.length * em * 0.5;

describe('EMF', () => {
  const file = emf((record) => {
    record(39, new Writer().u32(1, 0).u32(0x0000ff).u32(0)); // CreateBrushIndirect: red
    record(37, new Writer().u32(1)); // SelectObject
    record(43, new Writer().i32(10, 10, 90, 60)); // Rectangle
    const font = new Writer().u32(2).i32(-20, 0, 0, 0, 700).u32(0, 0).utf16('Arial', 32);
    while (font.bytes.length < 4 + 332) font.bytes.push(0);
    record(82, font); // ExtCreateFontIndirectW
    record(37, new Writer().u32(2));
    record(22, new Writer().u32(24)); // SetTextAlign: baseline
    const text = new Writer().i32(0, 0, -1, -1).u32(1).u32(0, 0).i32(100, 80).u32(2, 76, 0).i32(0, 0, -1, -1).u32(0).utf16('Hi');
    record(84, text); // ExtTextOutW
  });

  it('is recognized', () => {
    expect(isMetafile(file)).toBe(true);
    expect(isMetafile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe(false);
  });

  it('draws shapes with the selected brush and text with the selected font', () => {
    const drawing = parseMetafile(file, measure)!;
    // The bounds come from the header's frame, in 0.01 mm
    expect(drawing.bounds.width).toBeCloseTo(200, 0);
    expect(drawing.bounds.height).toBeCloseTo(100, 0);
    const rect = drawing.items.find((item) => item.kind === 'path');
    expect(rect).toMatchObject({ fill: { r: 1, g: 0, b: 0 } });
    const text = drawing.items.find((item) => item.kind === 'text');
    expect(text).toMatchObject({ text: 'Hi', y: 80, valign: 'baseline', font: { face: 'Arial', bold: true, height: -20 } });
    expect(metafileFonts(file)).toHaveLength(1);
  });
});

describe('WMF', () => {
  // A placeable WMF: 1000x500 logical units at 1000 units per inch
  const records = new Writer();
  const wmfRecord = (fn: number, ...params: number[]) => records.u32(3 + params.length).u16(fn).i16(...params);
  wmfRecord(0x020c, 500, 1000); // SetWindowExt (y, x)
  wmfRecord(0x02fc, 0, 0x0000, 0x00ff, 0); // CreateBrushIndirect: style, blue (COLORREF 0x00FF0000 as two words), hatch
  wmfRecord(0x012d, 0); // SelectObject
  wmfRecord(0x0324, 3, 0, 0, 1000, 0, 500, 500); // Polygon: 3 points
  wmfRecord(0x0000);
  const header = new Writer().u16(1, 9, 0x300).u32(9 + records.bytes.length / 2).u16(1).u32(6).u16(0);
  const placeable = new Writer().u32(0x9ac6cdd7).u16(0).i16(0, 0, 1000, 500).u16(1000).u32(0);
  let checksum = 0;
  for (let i = 0; i < 10; i++) checksum ^= placeable.bytes[i * 2] | (placeable.bytes[i * 2 + 1] << 8);
  placeable.u16(checksum);
  const file = new Uint8Array([...placeable.bytes, ...header.bytes, ...records.bytes]);

  it('draws polygons in logical units', () => {
    const drawing = parseMetafile(file, measure)!;
    expect(drawing.bounds).toMatchObject({ width: 1000, height: 500 });
    const polygon = drawing.items.find((item) => item.kind === 'path');
    expect(polygon).toMatchObject({ fill: { r: 0, g: 0, b: 1 } });
    if (polygon?.kind !== 'path') throw new Error('expected a path');
    expect(polygon.segments.filter((s) => s.type === 'L')).toHaveLength(2);
  });
});
