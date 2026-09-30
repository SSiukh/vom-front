import { transformPathAffine } from './transform-path-affine';

const IDENTITY = [1, 0, 0, 1, 0, 0] as const;
const ROTATE_CCW = [0, -1, 1, 0, 0, 100] as const;

describe('transformPathAffine', () => {
  it('leaves a path unchanged under the identity matrix', () => {
    expect(transformPathAffine('M1 2L3 4C5 6 7 8 9 10Q11 12 13 14Z', IDENTITY)).toBe('M1 2L3 4C5 6 7 8 9 10Q11 12 13 14Z');
  });

  it('scales and translates like transformPathData', () => {
    expect(transformPathAffine('M1 2L3 4Z', [2, 0, 0, 2, 10, 20])).toBe('M12 24L16 28Z');
  });

  it('rotates a quarter turn counter-clockwise: x becomes y, and the old x runs bottom to top', () => {
    expect(transformPathAffine('M0 0L10 0L10 5Z', ROTATE_CCW)).toBe('M0 100L0 90L5 90Z');
  });

  it('rotates control points of curves too', () => {
    expect(transformPathAffine('M0 0C10 0 10 5 0 5Z', ROTATE_CCW)).toBe('M0 100C0 90 5 90 5 100Z');
    expect(transformPathAffine('M0 0Q10 0 10 5Z', ROTATE_CCW)).toBe('M0 100Q0 90 5 90Z');
  });

  it('turns horizontal and vertical lines into plain lines so that they can be rotated', () => {
    expect(transformPathAffine('M0 0H10V5Z', ROTATE_CCW)).toBe('M0 100L0 90L5 90Z');
  });

  it('follows the current point through repeated arguments and after a close', () => {
    expect(transformPathAffine('M0 0H10 20V5 8Z M50 50L60 60', IDENTITY)).toBe('M0 0L10 0L20 0L20 5L20 8ZM50 50L60 60');
  });

  it('treats extra coordinate pairs after M as lines', () => {
    expect(transformPathAffine('M0 0 10 0 10 10Z', IDENTITY)).toBe('M0 0L10 0L10 10Z');
  });

  it('keeps the winding direction under a rotation, so holes stay holes', () => {
    const outer = 'M0 0L10 0L10 10L0 10Z';
    const hole = 'M2 2L2 8L8 8L8 2Z';
    const area = (path: string) => {
      const points = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      let sum = 0;
      for (let index = 0; index < points.length; index += 2) {
        const next = (index + 2) % points.length;
        sum += (points[index] ?? 0) * (points[next + 1] ?? 0) - (points[next] ?? 0) * (points[index + 1] ?? 0);
      }
      return Math.sign(sum);
    };

    expect(area(transformPathAffine(outer, ROTATE_CCW))).toBe(area(outer));
    expect(area(transformPathAffine(hole, ROTATE_CCW))).toBe(area(hole));
  });

  it('rejects relative commands, arcs and malformed data', () => {
    expect(() => transformPathAffine('M0 0l1 1Z', IDENTITY)).toThrow('Unsupported SVG path command');
    expect(() => transformPathAffine('M0 0L1Z', IDENTITY)).toThrow('Malformed SVG path data');
    expect(() => transformPathAffine('5 M0 0', IDENTITY)).toThrow('Malformed SVG path data');
    expect(() => transformPathAffine('M0 0 Z 5', IDENTITY)).toThrow('Malformed SVG path data');
  });

  it('never emits NaN', () => {
    expect(transformPathAffine('M1e1 .5L2 3Z', ROTATE_CCW)).not.toMatch(/NaN|Infinity/);
  });
});
