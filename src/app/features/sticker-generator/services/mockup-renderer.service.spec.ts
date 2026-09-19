import { TestBed } from '@angular/core/testing';
import type { MockupSticker } from '../models/mockup.model';
import { IMAGE_LOADER, MockupRenderer, type ImageLoader } from './mockup-renderer.service';

function image(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  return { naturalWidth, naturalHeight } as HTMLImageElement;
}

const STICKER: MockupSticker = {
  id: 1,
  label: 'kolo',
  presetId: '18x4',
  presetWidth: 18,
  presetHeight: 4,
  fileName: 'sticker-kolo-18x4.svg',
  document: { width: 1000, height: 222.222, cornerRadius: 0, background: '#000000', artwork: '#ffffff', artPaths: ['M0 0L10 0L10 10Z'] },
};

interface FakeContext {
  drawImage: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
}

function fakeCanvas(context: FakeContext | null) {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(context),
    toBlob: vi.fn(),
  };
}

function fakeContext(): FakeContext {
  return {
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
  };
}

describe('MockupRenderer', () => {
  let renderer: MockupRenderer;
  let loadImage: ReturnType<typeof vi.fn<ImageLoader>>;
  let photo: HTMLImageElement;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    photo = image(1000, 2000);
    loadImage = vi.fn<ImageLoader>().mockImplementation((url) => Promise.resolve(url === 'mockup/background.jpg' ? photo : image(1, 1)));
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue('blob:s'), revokeObjectURL });
    TestBed.configureTestingModule({ providers: [{ provide: IMAGE_LOADER, useValue: loadImage }] });
    renderer = TestBed.inject(MockupRenderer);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sizes the canvas to the photo and draws it first', async () => {
    const context = fakeContext();
    const canvas = fakeCanvas(context);

    await renderer.render(canvas as unknown as HTMLCanvasElement, [], new AbortController().signal);

    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(2000);
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(context.drawImage).toHaveBeenCalledWith(photo, 0, 0, 1000, 2000);
  });

  it('caps the output at 2000 px wide keeping the photo proportions', async () => {
    photo = image(4000, 6000);
    const canvas = fakeCanvas(fakeContext());

    await renderer.render(canvas as unknown as HTMLCanvasElement, [], new AbortController().signal);

    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(3000);
  });

  it('never upscales a photo narrower than 2000 px', async () => {
    photo = image(1805, 2390);
    const canvas = fakeCanvas(fakeContext());

    await renderer.render(canvas as unknown as HTMLCanvasElement, [], new AbortController().signal);

    expect(canvas.width).toBe(1805);
    expect(canvas.height).toBe(2390);
  });

  it('draws each sticker at its layout position with a soft shadow, isolated by save/restore', async () => {
    const context = fakeContext();
    const shadows: number[][] = [];
    context.drawImage.mockImplementation(() => shadows.push([context.shadowBlur, context.shadowOffsetY]));
    const canvas = fakeCanvas(context);

    await renderer.render(canvas as unknown as HTMLCanvasElement, [STICKER], new AbortController().signal);

    expect(context.drawImage).toHaveBeenCalledTimes(2);
    const [, x, y, width, height] = context.drawImage.mock.lastCall as number[];
    expect([x, width]).toEqual([200, 600]);
    expect(y).toBeCloseTo(933.3333, 3);
    expect(height).toBeCloseTo(133.3333, 3);
    expect(context.save).toHaveBeenCalledTimes(1);
    expect(context.restore).toHaveBeenCalledTimes(1);
    expect(context.shadowColor).toBe('rgba(0, 0, 0, 0.45)');
    expect(shadows[1]?.[0]).toBeCloseTo(16, 3);
    expect(shadows[1]?.[1]).toBeCloseTo(6.6667, 3);
  });

  it('rasterises each sticker from its own SVG and releases the object URLs', async () => {
    await renderer.render(fakeCanvas(fakeContext()) as unknown as HTMLCanvasElement, [STICKER, STICKER], new AbortController().signal);

    expect(loadImage).toHaveBeenCalledWith('blob:s');
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:s');
  });

  it('loads the photo only once across renders', async () => {
    const canvas = fakeCanvas(fakeContext()) as unknown as HTMLCanvasElement;

    await renderer.render(canvas, [], new AbortController().signal);
    await renderer.render(canvas, [], new AbortController().signal);

    expect(loadImage.mock.calls.filter(([url]) => url === 'mockup/background.jpg')).toHaveLength(1);
  });

  it('retries the photo after a failed load', async () => {
    loadImage.mockRejectedValueOnce(new Error('404'));
    const canvas = fakeCanvas(fakeContext()) as unknown as HTMLCanvasElement;

    await expect(renderer.render(canvas, [], new AbortController().signal)).rejects.toThrow('404');
    await renderer.render(canvas, [], new AbortController().signal);

    expect(loadImage.mock.calls.filter(([url]) => url === 'mockup/background.jpg')).toHaveLength(2);
  });

  it('does not touch the canvas when the render was aborted meanwhile', async () => {
    const context = fakeContext();
    const canvas = fakeCanvas(context);
    const controller = new AbortController();
    const rendering = renderer.render(canvas as unknown as HTMLCanvasElement, [STICKER], controller.signal);
    controller.abort();

    await rendering;

    expect(context.drawImage).not.toHaveBeenCalled();
    expect(canvas.width).toBe(0);
  });

  it('fails when the canvas has no 2D context', async () => {
    await expect(renderer.render(fakeCanvas(null) as unknown as HTMLCanvasElement, [], new AbortController().signal)).rejects.toThrow(
      'Canvas 2D context is not available',
    );
  });

  describe('toPng', () => {
    it('resolves with the encoded PNG blob', async () => {
      const blob = new Blob(['png'], { type: 'image/png' });
      const canvas = fakeCanvas(null);
      canvas.toBlob.mockImplementation((callback: BlobCallback) => callback(blob));

      await expect(renderer.toPng(canvas as unknown as HTMLCanvasElement)).resolves.toBe(blob);
      expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    });

    it('rejects when the browser cannot encode the canvas', async () => {
      const canvas = fakeCanvas(null);
      canvas.toBlob.mockImplementation((callback: BlobCallback) => callback(null));

      await expect(renderer.toPng(canvas as unknown as HTMLCanvasElement)).rejects.toThrow('Could not encode the PNG');
    });
  });

  describe('default image loader', () => {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      static fail = false;
      set src(_: string) {
        queueMicrotask(() => (FakeImage.fail ? this.onerror?.() : this.onload?.()));
      }
    }

    beforeEach(() => {
      vi.stubGlobal('Image', FakeImage);
      TestBed.resetTestingModule();
    });

    it('resolves with the loaded image', async () => {
      FakeImage.fail = false;

      await expect(TestBed.inject(IMAGE_LOADER)('x.png')).resolves.toBeInstanceOf(FakeImage);
    });

    it('rejects when the image cannot be loaded', async () => {
      FakeImage.fail = true;

      await expect(TestBed.inject(IMAGE_LOADER)('x.png')).rejects.toThrow('Could not load image x.png');
    });
  });
});
