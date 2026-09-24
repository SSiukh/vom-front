import type { PathCommand } from '../models/glyph-source.model';
import { STICKER_ICONS } from '../data/sticker-icons';
import {
  commandsBounds,
  commandsToPathData,
  formatNumber,
  transformCommands,
  transformPathData,
} from './path-data';

describe('path-data', () => {
  describe('formatNumber', () => {
    it('rounds to three decimals and drops trailing zeros', () => {
      expect(formatNumber(1.23456)).toBe('1.235');
      expect(formatNumber(2)).toBe('2');
      expect(formatNumber(0.5)).toBe('0.5');
    });

    it('never emits a negative zero', () => {
      expect(formatNumber(-0.0001)).toBe('0');
      expect(formatNumber(-0)).toBe('0');
    });
  });

  describe('commandsToPathData', () => {
    it('serialises every command type', () => {
      const commands: PathCommand[] = [
        { type: 'M', x: 1, y: 2 },
        { type: 'L', x: 3, y: -4 },
        { type: 'Q', x1: 5, y1: 6, x: 7, y: 8 },
        { type: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 },
        { type: 'Z' },
      ];

      expect(commandsToPathData(commands)).toBe('M1 2L3 -4Q5 6 7 8C1 2 3 4 5 6Z');
    });

    it('returns an empty string for no commands', () => {
      expect(commandsToPathData([])).toBe('');
    });
  });

  describe('transformCommands', () => {
    it('scales then translates every coordinate, including control points', () => {
      const commands: PathCommand[] = [
        { type: 'M', x: 1, y: 1 },
        { type: 'Q', x1: 2, y1: 2, x: 3, y: 3 },
        { type: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 },
        { type: 'Z' },
      ];

      expect(transformCommands(commands, 2, 10, 20)).toEqual([
        { type: 'M', x: 12, y: 22 },
        { type: 'Q', x1: 14, y1: 24, x: 16, y: 26 },
        { type: 'C', x1: 12, y1: 24, x2: 16, y2: 28, x: 20, y: 32 },
        { type: 'Z' },
      ]);
    });

    it('does not mutate its input', () => {
      const commands: PathCommand[] = [{ type: 'M', x: 1, y: 1 }];

      transformCommands(commands, 5, 5, 5);

      expect(commands).toEqual([{ type: 'M', x: 1, y: 1 }]);
    });
  });

  describe('commandsBounds', () => {
    it('returns null when there is nothing to measure', () => {
      expect(commandsBounds([])).toBeNull();
      expect(commandsBounds([{ type: 'Z' }])).toBeNull();
    });

    it('covers on-curve and control points', () => {
      const commands: PathCommand[] = [
        { type: 'M', x: 0, y: 0 },
        { type: 'Q', x1: -5, y1: 20, x: 10, y: 10 },
        { type: 'C', x1: 1, y1: -3, x2: 30, y2: 4, x: 8, y: 8 },
        { type: 'Z' },
      ];

      expect(commandsBounds(commands)).toEqual({ minX: -5, minY: -3, maxX: 30, maxY: 20 });
    });
  });

  describe('transformPathData', () => {
    it('transforms M, L, C and Z with scale and translation', () => {
      expect(transformPathData('M0 0L10 20C1 2 3 4 5 6Z', 2, 100, 200)).toBe('M100 200L120 240C102 204 106 208 110 212Z');
    });

    it('transforms H only by x and V only by y', () => {
      expect(transformPathData('M0 0H10V20', 2, 100, 200)).toBe('M100 200H120V240');
    });

    it('treats extra coordinate pairs after M as implicit lineto', () => {
      expect(transformPathData('M0 0 10 10', 1, 0, 0)).toBe('M0 0L10 10');
    });

    it('handles negative numbers, commas and decimals', () => {
      expect(transformPathData('M-1.5,2.5L.5-1', 1, 0, 0)).toBe('M-1.5 2.5L0.5 -1');
    });

    it('rejects relative commands and arcs', () => {
      expect(() => transformPathData('m0 0l1 1', 1, 0, 0)).toThrow('Unsupported SVG path command');
      expect(() => transformPathData('M0 0A1 1 0 0 1 2 2', 1, 0, 0)).toThrow('Unsupported SVG path command');
    });

    it('rejects a command with the wrong number of arguments', () => {
      expect(() => transformPathData('M0 0L10', 1, 0, 0)).toThrow('Malformed SVG path data');
      expect(() => transformPathData('M', 1, 0, 0)).toThrow('Malformed SVG path data');
      expect(() => transformPathData('M0 0 1 1 ZZ 5', 1, 0, 0)).toThrow('Malformed SVG path data');
      expect(() => transformPathData('5 M0 0', 1, 0, 0)).toThrow('Malformed SVG path data');
    });

    it('can transform every supplied brand icon path', () => {
      for (const icon of STICKER_ICONS) {
        const paths = icon.kind === 'mono' ? icon.paths : icon.layers.map((layer) => layer.d);
        for (const path of paths) {
          const transformed = transformPathData(path, 0.5, 10, 10);

          expect(transformed.startsWith('M')).toBe(true);
          expect(transformed).not.toContain('NaN');
        }
      }
    });
  });
});
