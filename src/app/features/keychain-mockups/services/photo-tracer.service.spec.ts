import { TestBed } from '@angular/core/testing';
import type { RasterImage } from '../utils/trace-input';
import {
  NO_INK_ERROR,
  PHOTO_DECODER,
  POTRACE_LOADER,
  PhotoTracer,
  type PotraceRunner,
} from './photo-tracer.service';

function raster(width: number, height: number, ink: boolean): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  if (ink) {
    for (let y = 20; y < 60; y++) {
      for (let x = 20; x < 60; x++) {
        const offset = (y * width + x) * 4;
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
      }
    }
  }
  return { data, width, height };
}

describe('PhotoTracer', () => {
  let decode: ReturnType<typeof vi.fn>;
  let runner: ReturnType<typeof vi.fn<PotraceRunner>>;
  let loader: ReturnType<typeof vi.fn>;
  let tracer: PhotoTracer;
  const file = new File(['x'], 'bike.png', { type: 'image/png' });

  beforeEach(() => {
    decode = vi.fn().mockResolvedValue(raster(100, 100, true));
    runner = vi.fn<PotraceRunner>().mockResolvedValue(['M100 100 l50 0 0 50 z']);
    loader = vi.fn().mockResolvedValue(runner);
    TestBed.configureTestingModule({
      providers: [
        { provide: PHOTO_DECODER, useValue: decode },
        { provide: POTRACE_LOADER, useValue: loader },
      ],
    });
    tracer = TestBed.inject(PhotoTracer);
  });

  it('decodes the file, traces the cropped black-and-white bitmap and returns one absolute path', async () => {
    const result = await tracer.trace(file);

    expect(decode).toHaveBeenCalledWith(file);
    const bitmap = runner.mock.calls[0]?.[0] as RasterImage;
    expect(Math.max(bitmap.width, bitmap.height)).toBe(1200);
    expect(result.width).toBe(bitmap.width);
    expect(result.height).toBe(bitmap.height);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toMatch(/^M10 \d+(\.\d+)?L15 \d+(\.\d+)?L15 \d+(\.\d+)?Z$/);
  });

  it('flips the traced path against the bitmap height', async () => {
    const result = await tracer.trace(file);

    const y = Number(/^M10 ([\d.]+)/.exec(result.paths[0] ?? '')?.[1]);
    expect(y).toBeCloseTo(result.height - 10, 3);
  });

  it('fails with NO_INK when the photo has no dark pixels', async () => {
    decode.mockResolvedValue(raster(100, 100, false));

    await expect(tracer.trace(file)).rejects.toThrow(NO_INK_ERROR);
    expect(loader).not.toHaveBeenCalled();
  });

  it('fails with NO_INK when the tracer finds no shapes', async () => {
    runner.mockResolvedValue([]);

    await expect(tracer.trace(file)).rejects.toThrow(NO_INK_ERROR);
  });

  it('loads the trace engine only once across photos', async () => {
    await tracer.trace(file);
    await tracer.trace(file);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('retries loading the trace engine after a failure', async () => {
    loader.mockRejectedValueOnce(new Error('offline'));

    await expect(tracer.trace(file)).rejects.toThrow('offline');
    await expect(tracer.trace(file)).resolves.toBeTruthy();

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('runs traces one after another, because the engine may hold global state', async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    runner.mockImplementationOnce(async () => {
      order.push('first start');
      await new Promise<void>((resolve) => (releaseFirst = resolve));
      order.push('first end');
      return ['M100 100 l50 0 0 50 z'];
    });
    runner.mockImplementationOnce(async () => {
      order.push('second start');
      return ['M100 100 l50 0 0 50 z'];
    });

    const first = tracer.trace(file);
    const second = tracer.trace(file);
    await new Promise((resolve) => setTimeout(resolve));
    expect(order).toEqual(['first start']);
    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first start', 'first end', 'second start']);
  });

  it('keeps tracing after an earlier trace failed', async () => {
    decode.mockRejectedValueOnce(new Error('bad image'));

    const failed = tracer.trace(file);
    const next = tracer.trace(file);

    await expect(failed).rejects.toThrow('bad image');
    await expect(next).resolves.toBeTruthy();
  });

  it('propagates decoding failures', async () => {
    decode.mockRejectedValue(new Error('bad image'));

    await expect(tracer.trace(file)).rejects.toThrow('bad image');
  });

  it('propagates trace failures', async () => {
    runner.mockRejectedValue(new Error('wasm crashed'));

    await expect(tracer.trace(file)).rejects.toThrow('wasm crashed');
  });

  it('exposes the NO_INK marker', () => {
    expect(NO_INK_ERROR).toBe('NO_INK');
  });
});

describe('PhotoTracer default engine', () => {
  it('resolves the real decoder and potrace loader tokens', () => {
    TestBed.configureTestingModule({});

    expect(typeof TestBed.inject(PHOTO_DECODER)).toBe('function');
    expect(typeof TestBed.inject(POTRACE_LOADER)).toBe('function');
  });
});
