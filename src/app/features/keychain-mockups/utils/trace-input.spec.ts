import { prepareTraceInput, type RasterImage } from './trace-input';

function image(
  width: number,
  height: number,
  ink: (x: number, y: number) => boolean,
  alpha = 255,
): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = ink(x, y) ? 0 : 255;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = alpha;
    }
  }
  return { data, width, height };
}

function inkPixels(result: RasterImage): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  count: number;
} {
  let minX = result.width;
  let maxX = -1;
  let minY = result.height;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      if (result.data[(y * result.width + x) * 4] === 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        count++;
      }
    }
  }
  return { minX, maxX, minY, maxY, count };
}

describe('prepareTraceInput', () => {
  it('returns null when the image has no dark pixels', () => {
    expect(prepareTraceInput(image(20, 20, () => false))).toBeNull();
  });

  it('crops to the ink with a small margin and scales the longest side to 1200 px', () => {
    const source = image(400, 300, (x, y) => x >= 100 && x < 200 && y >= 100 && y < 150);

    const result = prepareTraceInput(source);

    expect(result).not.toBeNull();
    expect(Math.max(result?.width ?? 0, result?.height ?? 0)).toBe(1200);
    expect((result?.width ?? 0) / (result?.height ?? 1)).toBeCloseTo(116 / 66, 2);
  });

  it('keeps the ink proportions and leaves a margin around it', () => {
    const source = image(400, 300, (x, y) => x >= 100 && x < 200 && y >= 100 && y < 150);

    const result = prepareTraceInput(source) as RasterImage;
    const ink = inkPixels(result);

    expect((ink.maxX - ink.minX + 1) / (ink.maxY - ink.minY + 1)).toBeCloseTo(2, 1);
    expect(ink.minX).toBeGreaterThan(50);
    expect(ink.minY).toBeGreaterThan(50);
    expect(result.width - 1 - ink.maxX).toBeGreaterThan(50);
    expect(result.height - 1 - ink.maxY).toBeGreaterThan(50);
  });

  it('outputs only opaque black and white pixels', () => {
    const result = prepareTraceInput(image(60, 60, (x) => x < 30)) as RasterImage;

    let valid = true;
    for (let offset = 0; offset < result.data.length; offset += 4) {
      const value = result.data[offset];
      const grey = result.data[offset + 1] === value && result.data[offset + 2] === value;
      if ((value !== 0 && value !== 255) || !grey || result.data[offset + 3] !== 255) {
        valid = false;
        break;
      }
    }
    expect(valid).toBe(true);
  });

  it('treats transparent pixels as white background', () => {
    expect(prepareTraceInput(image(20, 20, () => true, 0))).toBeNull();
  });

  it('uses the luminance threshold of 128', () => {
    const grey = (value: number): RasterImage => {
      const data = new Uint8ClampedArray([value, value, value, 255]);
      return { data, width: 1, height: 1 };
    };

    expect(prepareTraceInput(grey(127))).not.toBeNull();
    expect(prepareTraceInput(grey(128))).toBeNull();
  });

  it('handles an image that is entirely dark', () => {
    const result = prepareTraceInput(image(10, 10, () => true)) as RasterImage;

    expect(inkPixels(result).count).toBe(result.width * result.height);
  });

  it('scales a tall ink shape down by its height', () => {
    const source = image(300, 2000, (x, y) => x >= 100 && x < 150 && y >= 500 && y < 1500);

    const result = prepareTraceInput(source) as RasterImage;

    expect(result.height).toBe(1200);
    expect(result.width).toBeLessThan(200);
  });
});
