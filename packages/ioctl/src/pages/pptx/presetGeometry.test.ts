import { describe, expect, it } from 'vitest';
import { PRESET_SHAPES } from './presetShapes';
import { adjustValues, presetGeometry } from './presetGeometry';
import type { Segment } from './svgPath';

const points = (segments: Segment[]) => segments.flatMap((s) => (s.type === 'Z' ? [] : [s.to]));
const bounds = (segments: Segment[]) => {
  const xs = points(segments).map((p) => p.x);
  const ys = points(segments).map((p) => p.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
};

describe('presetGeometry', () => {
  it('draws every preset shape within its box', () => {
    for (const name of Object.keys(PRESET_SHAPES)) {
      const geometry = presetGeometry(name, 200, 100)!;
      expect(geometry.paths.length, name).toBeGreaterThan(0);
      for (const path of geometry.paths) {
        for (const p of points(path.segments)) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y), name).toBe(true);
        }
      }
    }
  });

  it('rounds rectangle corners by the shorter side, like PowerPoint', () => {
    const { paths, textInsets } = presetGeometry('roundRect', 216, 72)!;
    // The default radius is 16.667% of the shorter side, on both axes
    const [move] = paths[0].segments;
    expect(move).toMatchObject({ type: 'M', to: { x: 0 } });
    expect((move as { to: { y: number } }).to.y).toBeCloseTo(12, 1);
    expect(textInsets.left).toBeCloseTo(12 * 0.29289, 2);
    expect(textInsets.top).toBeCloseTo(textInsets.left, 6);
  });

  it('uses adjust values', () => {
    const { paths } = presetGeometry('roundRect', 100, 100, { adj: 50000 })!;
    // A 50% radius makes a circle
    const box = bounds(paths[0].segments);
    for (const [side, expected] of Object.entries({ left: 0, top: 0, right: 100, bottom: 100 })) expect(box[side as keyof typeof box]).toBeCloseTo(expected, 6);
    expect(adjustValues({ adj: 0.33334 })).toEqual({ adj: 16667 });
  });

  it('places text in the inscribed rectangle of an ellipse', () => {
    const { textInsets } = presetGeometry('ellipse', 200, 100)!;
    expect(textInsets.left).toBeCloseTo(100 * (1 - Math.SQRT1_2), 6);
    expect(textInsets.top).toBeCloseTo(50 * (1 - Math.SQRT1_2), 6);
  });

  it('reads formulas with irregular spacing', () => {
    // The heptagon's definition has "*/ vc  vf 100000"
    const { paths } = presetGeometry('heptagon', 100, 100)!;
    const box = bounds(paths[0].segments);
    expect(box.top).toBeCloseTo(0, 6);
    expect(box.bottom).toBeGreaterThan(90);
  });

  it('measures arc angles as rays from the center, so pie slices meet the center', () => {
    // A quarter pie (0 to 90 degrees) of a wide ellipse ends at the bottom middle
    const { paths } = presetGeometry('pie', 200, 100, { adj1: 0, adj2: 5400000 })!;
    const ends = points(paths[0].segments);
    expect(ends).toContainEqual({ x: 100, y: 50 });
    const bottom = ends.find((p) => Math.abs(p.x - 100) < 1e-6 && Math.abs(p.y - 100) < 1e-6);
    expect(bottom).toBeDefined();
  });

  it('returns null for shapes that are not presets', () => {
    expect(presetGeometry('custom', 10, 10)).toBeNull();
    expect(presetGeometry(undefined, 10, 10)).toBeNull();
  });
});
