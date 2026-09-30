import type { PrintArea, TextGraphic, VectorGraphic } from '../models/keychain.model';
import { layoutArtwork } from './layout-artwork';

const VERTICAL = { mark: 'vertical', text: 'vertical' } as const;
const all = (factor: number) => ({ photo: factor, mark: factor, text: factor });
const AREA: PrintArea = { x: 100, y: 200, width: 200, height: 400 };
const square: VectorGraphic = { width: 100, height: 100, paths: ['M0 0L100 0L100 100Z'] };
const wideMark: VectorGraphic = { width: 400, height: 40, paths: ['M0 0L400 0L400 40Z'] };
const text: TextGraphic = { width: 100, height: 40, capHeight: 20, paths: ['M0 0L100 0L100 40Z'] };

describe('layoutArtwork', () => {
  it('draws nothing without any graphic', () => {
    expect(layoutArtwork({ area: AREA, photo: null, mark: null, text: null })).toEqual({ paths: [], evenOddPaths: [], bounds: null });
  });

  it('ignores graphics without a size', () => {
    const empty: VectorGraphic = { width: 0, height: 10, paths: ['M0 0Z'] };

    expect(layoutArtwork({ area: AREA, photo: empty, mark: null, text: null })).toEqual({ paths: [], evenOddPaths: [], bounds: null });
  });

  it('draws nothing when the padded area has no room', () => {
    expect(layoutArtwork({ area: { x: 0, y: 0, width: 0, height: 100 }, photo: square, mark: null, text: null }).paths).toEqual([]);
  });

  it('fits a lone photo into the padded area and centres it on both axes', () => {
    const result = layoutArtwork({ area: AREA, photo: square, mark: null, text: null });

    expect(result.paths).toEqual(['M112 312L288 312L288 488Z']);
    expect(result.bounds).toEqual({ minX: 112, minY: 312, maxX: 288, maxY: 488 });
  });

  it('limits a lone photo by height as well as by width', () => {
    const tall: VectorGraphic = { width: 100, height: 1000, paths: ['M0 0L100 0L100 1000Z'] };

    const result = layoutArtwork({ area: AREA, photo: tall, mark: null, text: null });

    expect(result.bounds?.maxY).toBeCloseTo(588, 6);
    expect(result.bounds?.minY).toBeCloseTo(212, 6);
    expect(result.bounds?.minX).toBeCloseTo(200 - 18.8, 6);
  });

  it('fits a lone wide mark to 85 % of the content width, centred', () => {
    const { bounds } = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text: null });

    expect(bounds?.maxX).toBeCloseTo(200 + 74.8, 6);
    expect(bounds?.minX).toBeCloseTo(200 - 74.8, 6);
    expect((bounds?.minY ?? 0) + ((bounds?.maxY ?? 0) - (bounds?.minY ?? 0)) / 2).toBeCloseTo(400, 6);
  });

  it('lets a lone text reach 90 % of the content width', () => {
    const { bounds } = layoutArtwork({ area: AREA, photo: null, mark: null, text });

    expect((bounds?.maxX ?? 0) - (bounds?.minX ?? 0)).toBeCloseTo(158.4, 6);
    expect((bounds?.maxY ?? 0) - (bounds?.minY ?? 0)).toBeCloseTo(63.36, 6);
  });

  it('stacks photo, mark and text from top to bottom with a gap of 5 % of the content height', () => {
    const result = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text: null });

    const [photo, mark] = result.paths.map((path) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number));
    expect(photo?.[1]).toBeCloseTo(295.12, 2);
    expect(mark?.[1]).toBeCloseTo(489.92, 2);
    expect(result.bounds?.minY).toBeCloseTo(295.12, 2);
    expect(result.bounds?.maxY).toBeCloseTo(489.92 + 14.96, 2);
  });

  it('gives the text more room when there is no photo to share the area with', () => {
    const crowded = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text });
    const roomy = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text });

    const textHeight = (result: typeof crowded) => {
      const values = (result.paths.at(-1)?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, index) => index % 2 === 1);
      return Math.max(...values) - Math.min(...values);
    };
    expect(textHeight(crowded)).toBeCloseTo(52.64, 2);
    expect(textHeight(roomy)).toBeCloseTo(63.36, 2);
  });

  it('centres the whole stack vertically', () => {
    const { bounds } = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text });

    expect(((bounds?.minY ?? 0) + (bounds?.maxY ?? 0)) / 2).toBeCloseTo(400, 6);
    expect(((bounds?.minX ?? 0) + (bounds?.maxX ?? 0)) / 2).toBeCloseTo(200, 6);
  });

  it('shrinks the whole stack when it would be taller than the padded area', () => {
    const tall: VectorGraphic = { width: 100, height: 1000, paths: ['M0 0L100 0L100 1000Z'] };
    const box: VectorGraphic = { width: 100, height: 100, paths: ['M0 0L100 0L100 100Z'] };

    const { bounds } = layoutArtwork({ area: AREA, photo: tall, mark: box, text });

    expect(bounds?.minY).toBeCloseTo(212, 4);
    expect(bounds?.maxY).toBeCloseTo(588, 4);
  });

  it('uses a smaller share of the height for the photo when other blocks are present', () => {
    const tall: VectorGraphic = { width: 100, height: 1000, paths: ['M0 0L100 0L100 1000Z'] };

    const left = (paths: string[]) => Number(/^M(-?\d+(?:\.\d+)?)/.exec(paths[0] ?? '')?.[1]);
    const alone = layoutArtwork({ area: AREA, photo: tall, mark: null, text: null });
    const withMark = layoutArtwork({ area: AREA, photo: tall, mark: square, text: null });

    expect(left(withMark.paths)).toBeGreaterThan(left(alone.paths));
  });

  it('keeps everything inside the print area', () => {
    const { bounds } = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text });

    expect(bounds?.minX).toBeGreaterThanOrEqual(AREA.x);
    expect(bounds?.maxX).toBeLessThanOrEqual(AREA.x + AREA.width);
    expect(bounds?.minY).toBeGreaterThanOrEqual(AREA.y);
    expect(bounds?.maxY).toBeLessThanOrEqual(AREA.y + AREA.height);
  });

  it('keeps even-odd paths separate and places them exactly like the ordinary ones', () => {
    const mixed: VectorGraphic = { width: 100, height: 100, paths: [], evenOddPaths: ['M0 0L100 0L100 100Z'] };

    const result = layoutArtwork({ area: AREA, photo: mixed, mark: null, text: null });

    expect(result.paths).toEqual([]);
    expect(result.evenOddPaths).toEqual(['M112 312L288 312L288 488Z']);
    expect(result.bounds).toEqual({ minX: 112, minY: 312, maxX: 288, maxY: 488 });
  });

  it('never emits NaN', () => {
    const result = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text });

    expect(result.paths.join('')).not.toMatch(/NaN|Infinity/);
  });

  it('falls back to the text height when the cap height is unknown', () => {
    expect(layoutArtwork({ area: AREA, photo: null, mark: null, text: { ...text, capHeight: 0 } }).paths).toHaveLength(1);
  });

  describe('content scale', () => {
    it('shrinks a lone photo by the factor and keeps it centred', () => {
      const result = layoutArtwork({ area: AREA, photo: square, mark: null, text: null, scales: all(0.5) });

      expect(result.paths).toEqual(['M156 356L244 356L244 444Z']);
      expect(result.bounds).toEqual({ minX: 156, minY: 356, maxX: 244, maxY: 444 });
    });

    it('treats a missing factor as 1', () => {
      expect(layoutArtwork({ area: AREA, photo: square, mark: null, text: null })).toEqual(
        layoutArtwork({ area: AREA, photo: square, mark: null, text: null, scales: all(1) }),
      );
    });

    it('enlarges beyond the standard padding but stops 2 % of the width short of the area edge', () => {
      const { bounds } = layoutArtwork({ area: AREA, photo: square, mark: null, text: null, scales: all(1.2) });

      expect(bounds?.minX).toBeCloseTo(104, 6);
      expect(bounds?.maxX).toBeCloseTo(296, 6);
      expect((bounds?.maxX ?? 0) - (bounds?.minX ?? 0)).toBeCloseTo((bounds?.maxY ?? 0) - (bounds?.minY ?? 0), 6);
    });

    it('stops an enlarged tall photo 2 % of the width short of the top and bottom edge', () => {
      const tall: VectorGraphic = { width: 100, height: 1000, paths: ['M0 0L100 0L100 1000Z'] };

      const { bounds } = layoutArtwork({ area: AREA, photo: tall, mark: null, text: null, scales: all(1.2) });

      expect(bounds?.minY).toBeCloseTo(204, 6);
      expect(bounds?.maxY).toBeCloseTo(596, 6);
    });

    it('never lets any enlarged combination leave the print area', () => {
      for (const factor of [1.1, 1.2, 3]) {
        const { bounds } = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text, scales: all(factor) });

        expect(bounds?.minX).toBeGreaterThanOrEqual(AREA.x);
        expect(bounds?.maxX).toBeLessThanOrEqual(AREA.x + AREA.width);
        expect(bounds?.minY).toBeGreaterThanOrEqual(AREA.y);
        expect(bounds?.maxY).toBeLessThanOrEqual(AREA.y + AREA.height);
      }
    });
  });

  describe('vertical orientation', () => {
    it('turns a lone mark a quarter turn clockwise (-90°), centred on the area', () => {
      const result = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text: null, orientations: VERTICAL });

      expect(result.paths).toEqual(['M215.98 240.2L215.98 559.8L184.02 559.8Z']);
      expect(result.bounds?.minX).toBeCloseTo(184.02, 6);
      expect(result.bounds?.maxX).toBeCloseTo(215.98, 6);
      expect(result.bounds?.minY).toBeCloseTo(240.2, 6);
      expect(result.bounds?.maxY).toBeCloseTo(559.8, 6);
    });

    it('turns a lone text the same way', () => {
      const { bounds } = layoutArtwork({ area: AREA, photo: null, mark: null, text, orientations: VERTICAL });

      expect(bounds?.minX).toBeCloseTo(171.84, 6);
      expect(bounds?.maxX).toBeCloseTo(228.16, 6);
      expect(bounds?.minY).toBeCloseTo(329.6, 6);
      expect(bounds?.maxY).toBeCloseTo(470.4, 6);
    });

    it('measures the margins against the real width of the area, not against the longer side of the rotated frame', () => {
      const strap: PrintArea = { x: 0, y: 0, width: 100, height: 1000 };

      const { bounds } = layoutArtwork({ area: strap, photo: null, mark: wideMark, text: null, orientations: VERTICAL, scales: all(3) });

      expect(bounds?.minX).toBeGreaterThanOrEqual(2 - 1e-6);
      expect(bounds?.maxX).toBeLessThanOrEqual(98 + 1e-6);
      expect(bounds?.maxX).toBeGreaterThan(50);
    });

    it('puts the mark and the text side by side, the mark on the left, centred as a group', () => {
      const result = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text, orientations: VERTICAL });

      const stats = (path: string | undefined) => {
        const values = (path?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        const xs = values.filter((_, index) => index % 2 === 0);
        const ys = values.filter((_, index) => index % 2 === 1);
        return { meanX: xs.reduce((sum, value) => sum + value, 0) / xs.length, length: Math.max(...ys) - Math.min(...ys) };
      };
      const [first, second] = result.paths.map(stats);
      const mark = (first?.length ?? 0) > (second?.length ?? 0) ? first : second;
      const label = mark === first ? second : first;
      expect(result.paths).toHaveLength(2);
      expect(mark?.meanX).toBeLessThan(label?.meanX ?? 0);
      expect(((result.bounds?.minX ?? 0) + (result.bounds?.maxX ?? 0)) / 2).toBeCloseTo(200, 6);
      expect((result.bounds?.maxX ?? 0) - (result.bounds?.minX ?? 0)).toBeCloseTo(97.08, 6);
    });

    it('reads a vertical text from top to bottom: the start of the line is at the top', () => {
      const flag: TextGraphic = { width: 100, height: 40, capHeight: 20, paths: ['M0 0L100 0L100 10Z'] };

      const [path] = layoutArtwork({ area: AREA, photo: null, mark: null, text: flag, orientations: VERTICAL }).paths;

      const values = (path?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      expect(values[3] ?? 0).toBeGreaterThan(values[1] ?? 0);
    });

    it('keeps the photo upright in the top half and puts the rotated mark in the bottom half', () => {
      const result = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text: null, orientations: VERTICAL });

      expect(result.paths[0]).toBe('M112 212L288 212L288 388Z');
      expect(result.bounds?.minX).toBeCloseTo(112, 6);
      expect(result.bounds?.maxX).toBeCloseTo(288, 6);
      expect(result.bounds?.minY).toBeCloseTo(212, 6);
      expect(result.bounds?.maxY).toBeCloseTo(574.8, 6);
      const rotated = (result.paths[1]?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      expect(Math.min(...rotated.filter((_, index) => index % 2 === 1))).toBeGreaterThanOrEqual(400);
    });

    it('gives the rotated group the whole area when there is no photo', () => {
      const alone = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text: null, orientations: VERTICAL });

      expect((alone.bounds?.maxY ?? 0) - (alone.bounds?.minY ?? 0)).toBeCloseTo(319.6, 6);
    });

    it('gives the rotated group only the bottom half when an upright photo takes the top half', () => {
      const withPhoto = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text: null, orientations: VERTICAL });

      const markValues = (withPhoto.paths[1]?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      const ys = markValues.filter((_, index) => index % 2 === 1);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(400);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(319.6);
    });

    it('applies the content scale to the rotated group as well', () => {
      const { bounds } = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text: null, orientations: VERTICAL, scales: all(0.5) });

      expect((bounds?.maxY ?? 0) - (bounds?.minY ?? 0)).toBeCloseTo(159.8, 6);
    });

    it('carries even-odd paths through the rotation', () => {
      const mark: VectorGraphic = { width: 400, height: 40, paths: [], evenOddPaths: ['M0 0L400 0L400 40Z'] };

      const result = layoutArtwork({ area: AREA, photo: null, mark, text: null, orientations: VERTICAL });

      expect(result.paths).toEqual([]);
      expect(result.evenOddPaths).toEqual(['M215.98 240.2L215.98 559.8L184.02 559.8Z']);
    });

    it('keeps everything inside the print area and never emits NaN', () => {
      const result = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text, orientations: VERTICAL, scales: all(1.2) });

      expect(result.paths.join('')).not.toMatch(/NaN|Infinity/);
      expect(result.bounds?.minX).toBeGreaterThanOrEqual(AREA.x);
      expect(result.bounds?.maxX).toBeLessThanOrEqual(AREA.x + AREA.width);
      expect(result.bounds?.minY).toBeGreaterThanOrEqual(AREA.y);
      expect(result.bounds?.maxY).toBeLessThanOrEqual(AREA.y + AREA.height);
    });
  });

  describe('text size', () => {
    const heightOf = (path: string | undefined) => {
      const values = (path?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, index) => index % 2 === 1);
      return Math.max(...values) - Math.min(...values);
    };

    const widthOf = (path: string | undefined) => {
      const values = (path?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, index) => index % 2 === 0);
      return Math.max(...values) - Math.min(...values);
    };

    it('shrinks only the text: half the factor gives half the text height and the same mark', () => {
      const normal = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text });
      const small = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text, scales: { text: 0.5 } });

      expect(heightOf(small.paths[1])).toBeCloseTo(heightOf(normal.paths[1]) * 0.5, 6);
      expect(heightOf(small.paths[0])).toBeCloseTo(heightOf(normal.paths[0]), 6);
    });

    it('enlarges the text of a stack where it is not already at the width limit', () => {
      const shortText: TextGraphic = { width: 40, height: 40, capHeight: 20, paths: ['M0 0L40 0L40 40Z'] };

      const normal = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text: shortText });
      const large = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text: shortText, scales: { text: 1.3 } });

      expect(heightOf(large.paths[1])).toBeCloseTo(heightOf(normal.paths[1]) * 1.3, 6);
    });

    it('stops an enlarged text at the width of the padded area, without shrinking the mark', () => {
      const normal = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text });
      const huge = layoutArtwork({ area: AREA, photo: null, mark: wideMark, text, scales: { text: 4 } });

      expect(heightOf(huge.paths[1])).toBeCloseTo(76.8, 6);
      expect(heightOf(huge.paths[0])).toBeCloseTo(heightOf(normal.paths[0]), 6);
    });

    it('does not resize the mark or the photo', () => {
      const normal = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text });
      const small = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text, scales: { text: 0.6 } });

      expect(heightOf(small.paths[0])).toBeCloseTo(heightOf(normal.paths[0]), 6);
      expect(widthOf(small.paths[0])).toBeCloseTo(widthOf(normal.paths[0]), 6);
      expect(heightOf(small.paths[1])).toBeLessThan(heightOf(normal.paths[1]));
    });

    it('applies to the rotated text as well: its length along the keychain scales', () => {
      const normal = layoutArtwork({ area: AREA, photo: null, mark: null, text, orientations: VERTICAL });
      const small = layoutArtwork({ area: AREA, photo: null, mark: null, text, orientations: VERTICAL, scales: { text: 0.5 } });

      const length = (result: typeof normal) => (result.bounds?.maxY ?? 0) - (result.bounds?.minY ?? 0);
      expect(length(small)).toBeCloseTo(length(normal) * 0.5, 6);
    });

    it('has no effect when there is no text', () => {
      expect(layoutArtwork({ area: AREA, photo: square, mark: null, text: null, scales: { text: 2 } })).toEqual(
        layoutArtwork({ area: AREA, photo: square, mark: null, text: null }),
      );
    });

    it('never lets an enlarged text leave the print area', () => {
      for (const base of [1, 1.3]) {
        const { bounds } = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text, scales: { photo: base, mark: base, text: base * 3 } });

        expect(bounds?.minX).toBeGreaterThanOrEqual(AREA.x);
        expect(bounds?.maxX).toBeLessThanOrEqual(AREA.x + AREA.width);
        expect(bounds?.maxY).toBeLessThanOrEqual(AREA.y + AREA.height);
      }
    });
  });

  describe('independent blocks', () => {
    const spans = (path: string | undefined) => {
      const values = (path?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      const xs = values.filter((_, index) => index % 2 === 0);
      const ys = values.filter((_, index) => index % 2 === 1);
      return {
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        meanX: xs.reduce((sum, value) => sum + value, 0) / xs.length,
        meanY: ys.reduce((sum, value) => sum + value, 0) / ys.length,
      };
    };
    const tall: VectorGraphic = { width: 100, height: 200, paths: ['M0 0L100 0L100 200Z'] };

    it('scales the photo and the mark on their own', () => {
      const normal = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text: null });
      const small = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text: null, scales: { photo: 0.5 } });

      expect(spans(small.paths[0]).width).toBeCloseTo(spans(normal.paths[0]).width * 0.5, 6);
      expect(spans(small.paths[1]).width).toBeCloseTo(spans(normal.paths[1]).width, 6);
    });

    it('lets a bigger mark grow without making the text or the photo smaller', () => {
      const normal = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text });
      const big = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text, scales: { mark: 2 } });

      expect(spans(big.paths[1]).width).toBeGreaterThan(spans(normal.paths[1]).width);
      expect(spans(big.paths[0]).width).toBeCloseTo(spans(normal.paths[0]).width, 6);
      expect(spans(big.paths[2]).width).toBeCloseTo(spans(normal.paths[2]).width, 6);
    });

    it('turns only the block that asks for it: a vertical mark under an upright photo and text', () => {
      const result = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text, orientations: { mark: 'vertical' } });

      const [photo, label, mark] = result.paths.map(spans);
      expect(photo?.width).toBeCloseTo(photo?.height ?? 0, 6);
      expect((label?.width ?? 0) / (label?.height ?? 1)).toBeCloseTo(100 / 40, 1);
      expect((mark?.height ?? 0) / (mark?.width ?? 1)).toBeCloseTo(400 / 40, 1);
    });

    it('turns a photo on its own: a tall photo becomes wide', () => {
      const upright = layoutArtwork({ area: AREA, photo: tall, mark: null, text: null });
      const turned = layoutArtwork({ area: AREA, photo: tall, mark: null, text: null, orientations: { photo: 'vertical' } });

      expect(spans(upright.paths[0]).height).toBeGreaterThan(spans(upright.paths[0]).width);
      expect(spans(turned.paths[0]).width).toBeGreaterThan(spans(turned.paths[0]).height);
    });

    it('keeps upright blocks in the top half and rotated ones in the bottom half', () => {
      const result = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text, orientations: { mark: 'vertical', text: 'vertical' } });

      const [photo, first, second] = result.paths.map(spans);
      expect(photo?.meanY).toBeLessThan(400);
      expect(first?.meanY).toBeGreaterThan(400);
      expect(second?.meanY).toBeGreaterThan(400);
    });

    it('stands several rotated blocks side by side, the photo leftmost and the text rightmost', () => {
      const result = layoutArtwork({ area: AREA, photo: square, mark: wideMark, text, orientations: { photo: 'vertical', mark: 'vertical', text: 'vertical' } });

      const [left, middle, right] = result.paths.map(spans).sort((first, second) => first.meanX - second.meanX);
      const aspect = (block: { width: number; height: number } | undefined) => (block?.height ?? 0) / (block?.width ?? 1);
      expect(aspect(left)).toBeCloseTo(1, 1);
      expect(aspect(middle)).toBeCloseTo(400 / 40, 1);
      expect(aspect(right)).toBeCloseTo(100 / 40, 1);
    });

    it('keeps every combination of orientations inside the print area and free of NaN', () => {
      const modes = ['horizontal', 'vertical'] as const;
      for (const photo of modes) {
        for (const mark of modes) {
          for (const label of modes) {
            const result = layoutArtwork({
              area: AREA,
              photo: square,
              mark: wideMark,
              text,
              orientations: { photo, mark, text: label },
              scales: all(1.3),
            });

            expect(result.paths.join('')).not.toMatch(/NaN|Infinity/);
            expect(result.bounds?.minX).toBeGreaterThanOrEqual(AREA.x - 1e-6);
            expect(result.bounds?.maxX).toBeLessThanOrEqual(AREA.x + AREA.width + 1e-6);
            expect(result.bounds?.minY).toBeGreaterThanOrEqual(AREA.y - 1e-6);
            expect(result.bounds?.maxY).toBeLessThanOrEqual(AREA.y + AREA.height + 1e-6);
          }
        }
      }
    });

    it('carries the even-odd paths of a rotated photo along', () => {
      const evenOdd: VectorGraphic = { width: 100, height: 100, paths: [], evenOddPaths: ['M0 0L100 0L100 100Z'] };

      const result = layoutArtwork({ area: AREA, photo: evenOdd, mark: null, text: null, orientations: { photo: 'vertical' } });

      expect(result.paths).toEqual([]);
      expect(result.evenOddPaths).toHaveLength(1);
    });
  });
});
