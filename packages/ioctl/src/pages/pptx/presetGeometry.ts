import { PRESET_SHAPES } from './presetShapes';
import type { Point, Segment } from './svgPath';

// Computes PowerPoint's preset shapes (rounded rectangles, arrows, callouts,
// stars, ...) from their DrawingML definitions: guide formulas evaluated for
// the shape's size and adjust values, then path commands. This gives the exact
// outlines PowerPoint draws, and each shape's text rectangle.

export type FillMode = 'norm' | 'none' | 'lighten' | 'lightenLess' | 'darken' | 'darkenLess';

export interface PresetGeometry {
  paths: { segments: Segment[]; fill: FillMode; stroke: boolean }[];
  // Where text goes, as insets from each edge
  textInsets: { left: number; top: number; right: number; bottom: number };
}

// Angles are in 60000ths of a degree
const toRadians = (angle: number) => (angle / 60000) * (Math.PI / 180);
const toAngle = (radians: number) => (radians * 180 * 60000) / Math.PI;

function builtIns(w: number, h: number): Record<string, number> {
  const ss = Math.min(w, h);
  return {
    l: 0, t: 0, r: w, b: h, w, h, hc: w / 2, vc: h / 2, ss, ls: Math.max(w, h),
    wd2: w / 2, wd3: w / 3, wd4: w / 4, wd5: w / 5, wd6: w / 6, wd8: w / 8, wd10: w / 10, wd12: w / 12, wd32: w / 32,
    hd2: h / 2, hd3: h / 3, hd4: h / 4, hd5: h / 5, hd6: h / 6, hd8: h / 8, hd10: h / 10, hd12: h / 12, hd32: h / 32,
    ssd2: ss / 2, ssd4: ss / 4, ssd6: ss / 6, ssd8: ss / 8, ssd16: ss / 16, ssd32: ss / 32,
    cd2: 10800000, cd4: 5400000, cd8: 2700000, '3cd4': 16200000, '3cd8': 8100000, '5cd8': 13500000, '7cd8': 18900000,
  };
}

function evaluate(formula: string, value: (token: string) => number) {
  const [op, ...args] = formula.trim().split(/\s+/);
  const [x, y, z] = args.map(value);
  switch (op) {
    case 'val': return x;
    case '*/': return (x * y) / z;
    case '+-': return x + y - z;
    case '+/': return (x + y) / z;
    case '?:': return x > 0 ? y : z;
    case 'abs': return Math.abs(x);
    case 'at2': return toAngle(Math.atan2(y, x));
    case 'cat2': return x * Math.cos(Math.atan2(z, y));
    case 'sat2': return x * Math.sin(Math.atan2(z, y));
    case 'cos': return x * Math.cos(toRadians(y));
    case 'sin': return x * Math.sin(toRadians(y));
    case 'tan': return x * Math.tan(toRadians(y));
    case 'max': return Math.max(x, y);
    case 'min': return Math.min(x, y);
    case 'mod': return Math.sqrt(x * x + y * y + z * z);
    case 'pin': return y < x ? x : y > z ? z : y;
    case 'sqrt': return Math.sqrt(x);
    default: return 0;
  }
}

// An elliptical arc from `from`, starting at angle stAng and sweeping swAng.
// The angles are those of rays from the ellipse's center (not the ellipse's
// parametric angle), which the shape formulas rely on.
function arc(from: Point, wR: number, hR: number, stAng: number, swAng: number): Extract<Segment, { type: 'C' }>[] {
  if (!wR || !hR || !swAng) return [];
  const st = toRadians(stAng);
  const sw = toRadians(swAng);
  const parametric = (a: number) => Math.atan2(wR * Math.sin(a), hR * Math.cos(a));
  const start = parametric(st);
  let end = parametric(st + sw);
  if (Math.abs(sw) >= 2 * Math.PI - 1e-9) end = start + Math.sign(sw) * 2 * Math.PI;
  else {
    while (sw > 0 && end <= start) end += 2 * Math.PI;
    while (sw < 0 && end >= start) end -= 2 * Math.PI;
  }
  const cx = from.x - wR * Math.cos(start);
  const cy = from.y - hR * Math.sin(start);
  const parts = Math.max(1, Math.ceil(Math.abs(end - start) / (Math.PI / 2) - 1e-9));
  const step = (end - start) / parts;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (a: number) => ({ x: cx + wR * Math.cos(a), y: cy + hR * Math.sin(a) });
  const segments: Extract<Segment, { type: 'C' }>[] = [];
  for (let i = 0, a = start; i < parts; i++, a += step) {
    const b = a + step;
    segments.push({
      type: 'C',
      c1: { x: cx + wR * (Math.cos(a) - k * Math.sin(a)), y: cy + hR * (Math.sin(a) + k * Math.cos(a)) },
      c2: { x: cx + wR * (Math.cos(b) + k * Math.sin(b)), y: cy + hR * (Math.sin(b) - k * Math.cos(b)) },
      to: at(b),
    });
  }
  return segments;
}

// adjust: the shape's adjust values (like adj or adj1), overriding the defaults
export function presetGeometry(name: string | undefined, w: number, h: number, adjust: Record<string, number> = {}): PresetGeometry | null {
  const shape = name ? PRESET_SHAPES[name] : undefined;
  if (!shape) return null;
  const values = builtIns(w, h);
  const value = (token: string) => (token in values ? values[token] : Number(token) || 0);
  for (const guide of shape.av.split(';').filter(Boolean)) {
    const [key, formula] = guide.split('=');
    values[key] = adjust[key] ?? evaluate(formula, value);
  }
  for (const guide of shape.gd.split(';').filter(Boolean)) {
    const separator = guide.indexOf('=');
    values[guide.slice(0, separator)] = evaluate(guide.slice(separator + 1), value);
  }

  const paths = shape.paths.map((path) => {
    // Paths can have their own coordinate space
    const sx = path.w ? w / path.w : 1;
    const sy = path.h ? h / path.h : 1;
    const tokens = path.d.split(' ');
    const segments: Segment[] = [];
    let current: Point = { x: 0, y: 0 };
    let start = current;
    let i = 0;
    const next = () => value(tokens[i++]);
    const point = () => ({ x: next() * sx, y: next() * sy });
    while (i < tokens.length) {
      const command = tokens[i++];
      if (command === 'M') {
        current = start = point();
        segments.push({ type: 'M', to: current });
      } else if (command === 'L') {
        current = point();
        segments.push({ type: 'L', to: current });
      } else if (command === 'C') {
        const [c1, c2, to] = [point(), point(), point()];
        segments.push({ type: 'C', c1, c2, to });
        current = to;
      } else if (command === 'Q') {
        const [q, to] = [point(), point()];
        segments.push({ type: 'C', c1: { x: current.x + (2 / 3) * (q.x - current.x), y: current.y + (2 / 3) * (q.y - current.y) }, c2: { x: to.x + (2 / 3) * (q.x - to.x), y: to.y + (2 / 3) * (q.y - to.y) }, to });
        current = to;
      } else if (command === 'A') {
        const [wR, hR, stAng, swAng] = [next() * sx, next() * sy, next(), next()];
        const curves = arc(current, wR, hR, stAng, swAng);
        segments.push(...curves);
        if (curves.length) current = curves[curves.length - 1].to;
      } else if (command === 'Z') {
        segments.push({ type: 'Z' });
        current = start;
      }
    }
    return { segments, fill: (path.fill ?? 'norm') as FillMode, stroke: path.stroke !== 'false' };
  });

  const [l, t, r, b] = (shape.rect ?? 'l t r b').split(' ').map(value);
  return { paths, textInsets: { left: l, top: t, right: w - r, bottom: h - b } };
}

// pptxtojson's adjust values ("keypoints") are the shape's values divided by 50000
export const adjustValues = (keypoints: Record<string, number> | undefined) =>
  Object.fromEntries(Object.entries(keypoints ?? {}).map(([name, value]) => [name, Math.round(value * 50000)]));
