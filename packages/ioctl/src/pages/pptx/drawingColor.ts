import type { Rgba } from './painter';

// Resolves DrawingML colors (<a:srgbClr>, <a:schemeClr> and so on, with their
// tint/shade/luminance modifiers) against a presentation's theme.

export interface ColorTheme {
  scheme: Record<string, string>; // Scheme color name (dk1, accent1, ...) to hex
  map: Record<string, string>; // The master's color map (tx1 -> dk1, ...)
}

export const DEFAULT_THEME: ColorTheme = {
  scheme: {
    dk1: '000000', lt1: 'FFFFFF', dk2: '44546A', lt2: 'E7E6E6', accent1: '4472C4', accent2: 'ED7D31',
    accent3: 'A5A5A5', accent4: 'FFC000', accent5: '5B9BD5', accent6: '70AD47', hlink: '0563C1', folHlink: '954F72',
  },
  map: { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' },
};

const PRESET_COLORS: Record<string, string> = {
  black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', cyan: '00FFFF',
  magenta: 'FF00FF', gray: '808080', grey: '808080', darkGray: 'A9A9A9', lightGray: 'D3D3D3', orange: 'FFA500', purple: '800080',
  navy: '000080', maroon: '800000', olive: '808000', teal: '008080', silver: 'C0C0C0', lime: '00FF00', brown: 'A52A2A',
};

// Reads a theme part and the color map of the master that uses it
export function readColorTheme(theme: Document | null, master: Document | null): ColorTheme {
  const scheme = { ...DEFAULT_THEME.scheme };
  const clrScheme = theme?.getElementsByTagNameNS('*', 'clrScheme')[0];
  for (const entry of Array.from(clrScheme?.children ?? [])) {
    const color = entry.firstElementChild;
    const hex = color?.getAttribute('val') && color.localName === 'srgbClr' ? color.getAttribute('val') : color?.getAttribute('lastClr');
    if (hex) scheme[entry.localName] = hex;
  }
  const map = { ...DEFAULT_THEME.map };
  const clrMap = master?.getElementsByTagNameNS('*', 'clrMap')[0];
  for (const attr of Array.from(clrMap?.attributes ?? [])) map[attr.name] = attr.value;
  return { scheme, map };
}

export const toHex = ({ r, g, b }: Rgba) =>
  [r, g, b].map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

const hexToRgba = (hex: string): Rgba => ({
  r: parseInt(hex.slice(0, 2), 16) / 255,
  g: parseInt(hex.slice(2, 4), 16) / 255,
  b: parseInt(hex.slice(4, 6), 16) / 255,
  a: 1,
});

function rgbToHsl({ r, g, b }: Rgba) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s, l };
}

function hslToRgb(h: number, s: number, l: number, a: number): Rgba {
  if (!s) return { r: l, g: l, b: l, a };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: channel(h + 1 / 3), g: channel(h), b: channel(h - 1 / 3), a };
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

// Applies one color modifier (<a:tint val="75000"/> is modify(color, 'tint', 0.75))
export function modify(c: Rgba, name: string, val: number): Rgba {
  switch (name) {
    case 'alpha':
      return { ...c, a: val };
    case 'tint': {
      // Mixes with white (in linear light, as Office does)
      const t = (x: number) => toSrgb(toLinear(x) * val + (1 - val));
      return { r: t(c.r), g: t(c.g), b: t(c.b), a: c.a };
    }
    case 'shade': {
      const t = (x: number) => toSrgb(toLinear(x) * val);
      return { r: t(c.r), g: t(c.g), b: t(c.b), a: c.a };
    }
    case 'alphaMod':
      return { ...c, a: clamp(c.a * val) };
    case 'alphaOff':
      return { ...c, a: clamp(c.a + val) };
    case 'lumMod':
    case 'lumOff':
    case 'satMod':
    case 'satOff':
    case 'hueMod':
    case 'hueOff': {
      const hsl = rgbToHsl(c);
      if (name === 'lumMod') hsl.l = clamp(hsl.l * val);
      if (name === 'lumOff') hsl.l = clamp(hsl.l + val);
      if (name === 'satMod') hsl.s = clamp(hsl.s * val);
      if (name === 'satOff') hsl.s = clamp(hsl.s + val);
      if (name === 'hueMod') hsl.h = (hsl.h * val) % 1;
      // Hue offsets are in 60000ths of a degree, so val is a fraction of 0.6 degrees
      if (name === 'hueOff') hsl.h = (((hsl.h + (val * 100000) / 60000 / 360) % 1) + 1) % 1;
      return hslToRgb(hsl.h, hsl.s, hsl.l, c.a);
    }
  }
  return c;
}

// Applies an element's color modifiers in document order
function applyModifiers(color: Rgba, modifiers: Element[]): Rgba {
  return modifiers.reduce((c, mod) => {
    const val = Number(mod.getAttribute('val')) / 100000;
    return Number.isNaN(val) ? c : modify(c, mod.localName, val);
  }, color);
}

export function schemeColor(name: string, theme: ColorTheme): Rgba {
  return hexToRgba(theme.scheme[theme.map[name] ?? name] ?? '000000');
}

// Resolves a color element (<a:srgbClr>, <a:schemeClr>, ...)
export function resolveColor(el: Element | null | undefined, theme: ColorTheme, placeholder?: Rgba): Rgba | null {
  if (!el) return null;
  let base: Rgba | null = null;
  const val = el.getAttribute('val') ?? '';
  switch (el.localName) {
    case 'srgbClr':
      base = /^[0-9a-f]{6}$/i.test(val) ? hexToRgba(val) : null;
      break;
    case 'schemeClr': {
      if (val === 'phClr') {
        base = placeholder ?? null;
        break;
      }
      const name = theme.map[val] ?? val;
      const hex = theme.scheme[name];
      base = hex ? hexToRgba(hex) : null;
      break;
    }
    case 'sysClr':
      base = hexToRgba(el.getAttribute('lastClr') ?? (val === 'window' ? 'FFFFFF' : '000000'));
      break;
    case 'prstClr':
      base = PRESET_COLORS[val] ? hexToRgba(PRESET_COLORS[val]) : null;
      break;
    case 'scrgbClr': {
      const channel = (name: string) => clamp(toSrgb(Number(el.getAttribute(name)) / 100000));
      base = { r: channel('r'), g: channel('g'), b: channel('b'), a: 1 };
      break;
    }
    case 'hslClr':
      base = hslToRgb(Number(el.getAttribute('hue')) / 60000 / 360, Number(el.getAttribute('sat')) / 100000, Number(el.getAttribute('lum')) / 100000, 1);
      break;
  }
  return base && applyModifiers(base, Array.from(el.children));
}

// The color of a fill-like element (<a:solidFill>, or the first stop of a <a:gradFill>)
export function resolveFill(fill: Element | null | undefined, theme: ColorTheme): Rgba | null {
  if (!fill) return null;
  if (fill.localName === 'solidFill') return resolveColor(fill.firstElementChild, theme);
  if (fill.localName === 'gradFill') {
    const stop = fill.getElementsByTagNameNS('*', 'gs')[0];
    return resolveColor(stop?.firstElementChild, theme);
  }
  if (fill.localName === 'pattFill') return resolveColor(fill.getElementsByTagNameNS('*', 'fgClr')[0]?.firstElementChild, theme);
  return null;
}
