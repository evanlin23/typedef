import { describe, expect, it } from 'vitest';
import { parseSvgPath, pathEnds, scaleSegments, segmentsToSvg, type Segment } from './svgPath';

const last = (segments: Segment[]) => segments.filter((s) => s.type !== 'Z').pop() as Exclude<Segment, { type: 'Z' }>;

describe('parseSvgPath', () => {
  it('turns relative and shorthand commands into absolute segments', () => {
    const segments = parseSvgPath('M10,10 l10,0 v5 h-10 z');
    expect(segments.map((s) => s.type)).toEqual(['M', 'L', 'L', 'L', 'Z']);
    expect(last(segments).to).toEqual({ x: 10, y: 15 });
  });

  it('treats extra coordinate pairs after a move as lines', () => {
    expect(parseSvgPath('M0 0 10 0 10 10').map((s) => s.type)).toEqual(['M', 'L', 'L']);
  });

  it('converts quadratic curves and arcs to cubic curves', () => {
    const quad = parseSvgPath('M0,0 Q10,10 20,0');
    expect(quad[1]).toMatchObject({ type: 'C', to: { x: 20, y: 0 } });

    // A half circle of radius 10 takes two quarter-circle curves
    const arc = parseSvgPath('M0,0 A10,10 0 0,1 20,0');
    expect(arc.filter((s) => s.type === 'C')).toHaveLength(2);
    expect(last(arc).to).toEqual({ x: 20, y: 0 });
    const middle = arc[1] as Extract<Segment, { type: 'C' }>;
    // Sweeping clockwise from (0,0) to (20,0) passes through the top, (10,-10)
    expect(middle.to.x).toBeCloseTo(10);
    expect(middle.to.y).toBeCloseTo(-10);
  });

  it('stops at malformed data instead of throwing', () => {
    expect(parseSvgPath('M0,0 L10')).toHaveLength(1);
    expect(parseSvgPath('')).toEqual([]);
  });
});

describe('segment helpers', () => {
  it('scales and offsets segments', () => {
    const scaled = scaleSegments(parseSvgPath('M1,1 L2,3'), 10, 100, 5, 0);
    expect(segmentsToSvg(scaled)).toBe('M15,100 L25,300');
  });

  it('finds the direction a path leaves its start and arrives at its end', () => {
    const ends = pathEnds(parseSvgPath('M0,0 L10,0 L10,10'));
    expect(ends).toEqual({ start: { x: 0, y: 0 }, startToward: { x: 10, y: 0 }, end: { x: 10, y: 10 }, endFrom: { x: 10, y: 0 } });
  });
});
