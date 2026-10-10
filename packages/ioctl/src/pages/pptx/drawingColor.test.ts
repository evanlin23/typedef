import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, readColorTheme, resolveColor, toHex } from './drawingColor';

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const color = (xml: string) => new DOMParser().parseFromString(`<a:wrap xmlns:a="${A}">${xml}</a:wrap>`, 'application/xml').documentElement.firstElementChild;
const hex = (xml: string) => toHex(resolveColor(color(xml), DEFAULT_THEME)!);

describe('resolveColor', () => {
  it('resolves explicit and scheme colors', () => {
    expect(hex('<a:srgbClr val="1A2B3C"/>')).toBe('1A2B3C');
    expect(hex('<a:schemeClr val="accent1"/>')).toBe('4472C4');
    // tx1 maps to dk1 through the color map
    expect(hex('<a:schemeClr val="tx1"/>')).toBe('000000');
    expect(hex('<a:prstClr val="white"/>')).toBe('FFFFFF');
    expect(hex('<a:sysClr val="windowText" lastClr="000000"/>')).toBe('000000');
  });

  it('applies luminance modifiers like Office', () => {
    // Office's "Accent 1, Darker 25%" and "Lighter 40%"
    expect(hex('<a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr>')).toBe('2F5597');
    expect(hex('<a:schemeClr val="accent1"><a:lumMod val="60000"/><a:lumOff val="40000"/></a:schemeClr>')).toBe('8FAADC');
  });

  it('mixes tints in linear light (the classic #898989 subtitle gray)', () => {
    expect(hex('<a:schemeClr val="tx1"><a:tint val="75000"/></a:schemeClr>')).toBe('898989');
  });

  it('keeps alpha', () => {
    expect(resolveColor(color('<a:srgbClr val="FF0000"><a:alpha val="40000"/></a:srgbClr>'), DEFAULT_THEME)?.a).toBeCloseTo(0.4);
  });
});

describe('readColorTheme', () => {
  it('reads scheme colors and the master color map', () => {
    const theme = new DOMParser().parseFromString(
      `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="x"><a:dk1><a:sysClr val="windowText" lastClr="111111"/></a:dk1><a:lt1><a:srgbClr val="EEEEEE"/></a:lt1><a:accent1><a:srgbClr val="00FF00"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`,
      'application/xml'
    );
    const master = new DOMParser().parseFromString(
      `<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:clrMap bg1="dk1" tx1="lt1"/></p:sldMaster>`,
      'application/xml'
    );
    const colors = readColorTheme(theme, master);
    expect(toHex(resolveColor(color('<a:schemeClr val="accent1"/>'), colors)!)).toBe('00FF00');
    // A dark theme maps text to the light color
    expect(toHex(resolveColor(color('<a:schemeClr val="tx1"/>'), colors)!)).toBe('EEEEEE');
    expect(toHex(resolveColor(color('<a:schemeClr val="bg1"/>'), colors)!)).toBe('111111');
  });
});
