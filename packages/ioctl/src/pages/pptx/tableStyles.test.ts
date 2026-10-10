import { describe, expect, it } from 'vitest';
import { builtInTableStyle } from './tableStyles';

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

describe('builtInTableStyle', () => {
  it("defines PowerPoint's default style", () => {
    const xml = builtInTableStyle('{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}')!;
    const style = parse(xml).documentElement;
    expect(style.getAttribute('styleName')).toBe('Medium Style 2 - Accent 1');
    const firstRow = style.getElementsByTagNameNS(A, 'firstRow')[0];
    expect(firstRow.getElementsByTagNameNS(A, 'tcTxStyle')[0].getAttribute('b')).toBe('on');
    expect(firstRow.getElementsByTagNameNS(A, 'schemeClr')[0].getAttribute('val')).toBe('lt1');
    const band = style.getElementsByTagNameNS(A, 'band1H')[0];
    expect(band.getElementsByTagNameNS(A, 'tint')[0].getAttribute('val')).toBe('40000');
  });

  it('matches style IDs case-insensitively and rejects unknown ones', () => {
    expect(builtInTableStyle('{69012ecd-51fc-41f1-aa8d-1b2483cd663e}')).toContain('Light Style 2 - Accent 1');
    expect(builtInTableStyle('{00000000-0000-0000-0000-000000000000}')).toBeNull();
  });

  it('pairs the accents of Dark Style 2', () => {
    const style = parse(builtInTableStyle('{91EBBBCC-DAD2-459C-BE2E-F6DE35CF9A28}')!).documentElement;
    expect(style.getAttribute('styleName')).toBe('Dark Style 2 - Accent 3');
    const header = style.getElementsByTagNameNS(A, 'firstRow')[0].getElementsByTagNameNS(A, 'fill')[0];
    expect(header.getElementsByTagNameNS(A, 'schemeClr')[0].getAttribute('val')).toBe('accent4');
  });
});
