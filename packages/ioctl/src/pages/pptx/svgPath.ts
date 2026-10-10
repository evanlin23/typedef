// Parses SVG path data (the shape outlines pptxtojson produces) into absolute
// move/line/cubic segments, which map directly onto PDF path operators.

export type Point = { x: number; y: number };
export type Segment =
  | { type: 'M'; to: Point }
  | { type: 'L'; to: Point }
  | { type: 'C'; c1: Point; c2: Point; to: Point }
  | { type: 'Z' };

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

export function parseSvgPath(d: string): Segment[] {
  const tokens = d.match(TOKEN) ?? [];
  const segments: Segment[] = [];
  let i = 0;
  let command = '';
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  // Reflected control points for the S and T shorthands
  let lastCubic: Point | null = null;
  let lastQuad: Point | null = null;

  const cubic = (c1: Point, c2: Point, to: Point) => {
    segments.push({ type: 'C', c1, c2, to });
    current = to;
  };
  const quad = (q: Point, to: Point) => {
    const from = current;
    cubic(
      { x: from.x + (2 / 3) * (q.x - from.x), y: from.y + (2 / 3) * (q.y - from.y) },
      { x: to.x + (2 / 3) * (q.x - to.x), y: to.y + (2 / 3) * (q.y - to.y) },
      to
    );
  };

  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) command = tokens[i++];
    else if (!command) break;
    const lower = command.toLowerCase();
    const relative = command === lower;
    const count = ARGS[lower];
    if (count === undefined) break;
    const n = tokens.slice(i, i + count).map(Number);
    if (n.length < count || n.some(Number.isNaN)) break;
    i += count;
    const pt = (x: number, y: number): Point => (relative ? { x: current.x + x, y: current.y + y } : { x, y });
    const prevCubic: Point | null = lastCubic;
    const prevQuad: Point | null = lastQuad;
    lastCubic = null;
    lastQuad = null;

    switch (lower) {
      case 'm':
        current = start = pt(n[0], n[1]);
        segments.push({ type: 'M', to: current });
        // Further coordinate pairs after a move are implicit line-tos
        command = relative ? 'l' : 'L';
        break;
      case 'l':
        current = pt(n[0], n[1]);
        segments.push({ type: 'L', to: current });
        break;
      case 'h':
        current = { x: relative ? current.x + n[0] : n[0], y: current.y };
        segments.push({ type: 'L', to: current });
        break;
      case 'v':
        current = { x: current.x, y: relative ? current.y + n[0] : n[0] };
        segments.push({ type: 'L', to: current });
        break;
      case 'c': {
        const c2 = pt(n[2], n[3]);
        cubic(pt(n[0], n[1]), c2, pt(n[4], n[5]));
        lastCubic = c2;
        break;
      }
      case 's': {
        const c1 = prevCubic ? { x: 2 * current.x - prevCubic.x, y: 2 * current.y - prevCubic.y } : current;
        const c2 = pt(n[0], n[1]);
        cubic(c1, c2, pt(n[2], n[3]));
        lastCubic = c2;
        break;
      }
      case 'q': {
        const q = pt(n[0], n[1]);
        quad(q, pt(n[2], n[3]));
        lastQuad = q;
        break;
      }
      case 't': {
        const q: Point = prevQuad ? { x: 2 * current.x - prevQuad.x, y: 2 * current.y - prevQuad.y } : current;
        quad(q, pt(n[0], n[1]));
        lastQuad = q;
        break;
      }
      case 'a':
        for (const c of arcToCubics(current, n[0], n[1], n[2], n[3] !== 0, n[4] !== 0, pt(n[5], n[6]))) cubic(c.c1, c.c2, c.to);
        break;
      case 'z':
        segments.push({ type: 'Z' });
        current = start;
        break;
    }
  }
  return segments;
}

// Converts an SVG elliptical arc to cubic Béziers (SVG spec, appendix F.6)
function arcToCubics(from: Point, rx: number, ry: number, angle: number, largeArc: boolean, sweep: boolean, to: Point) {
  if ((from.x === to.x && from.y === to.y) || !rx || !ry) return [{ c1: from, c2: to, to }];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const sign = largeArc === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const coef = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
  const cx1 = (coef * rx * y1) / ry;
  const cy1 = (-coef * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2;
  const angleOf = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta = angleOf(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angleOf((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  const parts = Math.ceil(Math.abs(delta) / (Math.PI / 2));
  const step = delta / parts;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t: number, r = 1) => ({ ex: Math.cos(t) * r, ey: Math.sin(t) * r });
  const map = (ux: number, uy: number): Point => ({ x: cx + rx * ux * cos - ry * uy * sin, y: cy + rx * ux * sin + ry * uy * cos });
  const cubics = [];
  for (let p = 0, t = theta; p < parts; p++, t += step) {
    const a = point(t);
    const b = point(t + step);
    cubics.push({
      c1: map(a.ex - k * a.ey, a.ey + k * a.ex),
      c2: map(b.ex + k * b.ey, b.ey - k * b.ex),
      to: p === parts - 1 ? to : map(b.ex, b.ey),
    });
  }
  return cubics;
}

// Scales segments by (sx, sy), then moves them by (dx, dy)
export function scaleSegments(segments: Segment[], sx: number, sy: number, dx = 0, dy = 0): Segment[] {
  const p = (q: Point) => ({ x: q.x * sx + dx, y: q.y * sy + dy });
  return segments.map((s) => (s.type === 'Z' ? s : s.type === 'C' ? { type: 'C', c1: p(s.c1), c2: p(s.c2), to: p(s.to) } : { type: s.type, to: p(s.to) }));
}

export function segmentsToSvg(segments: Segment[]) {
  return segments
    .map((s) => (s.type === 'Z' ? 'Z' : s.type === 'C' ? `C${s.c1.x},${s.c1.y} ${s.c2.x},${s.c2.y} ${s.to.x},${s.to.y}` : `${s.type}${s.to.x},${s.to.y}`))
    .join(' ');
}

export const rectPath = (x: number, y: number, w: number, h: number) => `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;

export const ellipsePath = (x: number, y: number, w: number, h: number) =>
  `M${x},${y + h / 2} A${w / 2},${h / 2} 0 1,0 ${x + w},${y + h / 2} A${w / 2},${h / 2} 0 1,0 ${x},${y + h / 2} Z`;

export function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  return (
    `M${x + r},${y} L${x + w - r},${y} A${r},${r} 0 0,1 ${x + w},${y + r} L${x + w},${y + h - r} ` +
    `A${r},${r} 0 0,1 ${x + w - r},${y + h} L${x + r},${y + h} A${r},${r} 0 0,1 ${x},${y + h - r} ` +
    `L${x},${y + r} A${r},${r} 0 0,1 ${x + r},${y} Z`
  );
}

// Start and end points of an open path with the direction it leaves/arrives, for arrowheads
export function pathEnds(segments: Segment[]) {
  const drawn = segments.filter((s): s is Exclude<Segment, { type: 'Z' }> => s.type !== 'Z');
  if (drawn.length < 2) return null;
  const first = drawn[0].to;
  const second = drawn[1];
  const startToward = second.type === 'C' && !samePoint(second.c1, first) ? second.c1 : second.to;
  const last = drawn[drawn.length - 1];
  const beforeLast = drawn[drawn.length - 2].to;
  const endFrom = last.type === 'C' && !samePoint(last.c2, last.to) ? last.c2 : beforeLast;
  return { start: first, startToward, end: last.to, endFrom };
}

const samePoint = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
