import { TestBed } from '@angular/core/testing';
import {
  IMAGE_LOADER,
  type ImageLoader,
} from '../../sticker-generator/services/mockup-renderer.service';
import { KeychainRenderer } from './keychain-renderer.service';

interface FakeContext {
  drawImage: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  globalCompositeOperation: string;
  fillStyle: string;
}

describe('KeychainRenderer', () => {
  let renderer: KeychainRenderer;
  let loadImage: ReturnType<typeof vi.fn<ImageLoader>>;
  let image: HTMLImageElement;
  let operations: string[];
  let context: FakeContext;
  let canvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn> };

  const asCanvas = () => canvas as unknown as HTMLCanvasElement;
  const run = (
    paths: string[],
    ink = '#111111',
    signal = new AbortController().signal,
    evenOddPaths: string[] = [],
    blend: 'multiply' | 'source-over' = 'multiply',
  ) =>
    renderer.render(
      asCanvas(),
      { imageUrl: 'keychains/metal-white.jpg', paths, evenOddPaths, ink, blend },
      signal,
    );

  beforeEach(() => {
    image = { naturalWidth: 1512, naturalHeight: 2016 } as HTMLImageElement;
    loadImage = vi.fn<ImageLoader>().mockResolvedValue(image);
    operations = [];
    const state = { globalCompositeOperation: '', fillStyle: '' };
    context = {
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fill: vi.fn(() => operations.push(`${state.globalCompositeOperation}|${state.fillStyle}`)),
      get globalCompositeOperation() {
        return state.globalCompositeOperation;
      },
      set globalCompositeOperation(value: string) {
        state.globalCompositeOperation = value;
      },
      get fillStyle() {
        return state.fillStyle;
      },
      set fillStyle(value: string) {
        state.fillStyle = value;
      },
    };
    canvas = { width: 0, height: 0, getContext: vi.fn().mockReturnValue(context) };
    vi.stubGlobal(
      'Path2D',
      class {
        constructor(public d: string) {}
      },
    );
    TestBed.configureTestingModule({ providers: [{ provide: IMAGE_LOADER, useValue: loadImage }] });
    renderer = TestBed.inject(KeychainRenderer);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sizes the canvas to the base photo and draws it first', async () => {
    await run([]);

    expect(canvas.width).toBe(1512);
    expect(canvas.height).toBe(2016);
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 1512, 2016);
    expect(loadImage).toHaveBeenCalledWith('keychains/metal-white.jpg');
  });

  it('does not resize (and so clear) the canvas when it already has the photo size', async () => {
    let assignments = 0;
    let width = 1512;
    let height = 2016;
    Object.defineProperty(canvas, 'width', {
      get: () => width,
      set: (value: number) => {
        assignments++;
        width = value;
      },
    });
    Object.defineProperty(canvas, 'height', {
      get: () => height,
      set: (value: number) => {
        assignments++;
        height = value;
      },
    });

    await run(['M0 0L1 1Z']);

    expect(assignments).toBe(0);
    expect(context.drawImage).toHaveBeenCalledTimes(1);
  });

  it('resizes the canvas when the photo has another size', async () => {
    canvas.width = 100;
    canvas.height = 100;

    await run([]);

    expect([canvas.width, canvas.height]).toEqual([1512, 2016]);
  });

  it('draws only the photo when there is no artwork', async () => {
    await run([]);

    expect(context.fill).not.toHaveBeenCalled();
    expect(context.save).not.toHaveBeenCalled();
  });

  it('fills every artwork path with the ink colour, multiplied over the photo for dark ink', async () => {
    await run(['M0 0L1 1Z', 'M2 2L3 3Z'], '#111111');

    expect(operations).toEqual(['multiply|#111111', 'multiply|#111111']);
    expect((context.fill.mock.calls[0]?.[0] as { d: string }).d).toBe('M0 0L1 1Z');
    expect((context.fill.mock.calls[1]?.[0] as { d: string }).d).toBe('M2 2L3 3Z');
  });

  it('fills the even-odd paths with the even-odd rule so their holes stay open', async () => {
    await run(['M0 0L1 1Z'], '#111111', new AbortController().signal, ['M5 5L6 6Z']);

    expect(context.fill.mock.calls[0]).toHaveLength(1);
    expect((context.fill.mock.calls[1]?.[0] as { d: string }).d).toBe('M5 5L6 6Z');
    expect(context.fill.mock.calls[1]?.[1]).toBe('evenodd');
  });

  it('draws even-odd artwork even when there are no ordinary paths', async () => {
    await run([], '#111111', new AbortController().signal, ['M5 5L6 6Z']);

    expect(context.fill).toHaveBeenCalledTimes(1);
  });

  it('draws over the photo normally when the type asks for it, so the ink stays visible on dark keychains', async () => {
    await run(['M0 0L1 1Z'], '#ffffff', new AbortController().signal, [], 'source-over');

    expect(operations).toEqual(['source-over|#ffffff']);
  });

  it('follows the requested blend mode whatever the ink colour is', async () => {
    await run(['M0 0L1 1Z'], '#6f4a2b', new AbortController().signal, [], 'source-over');
    await run(['M0 0L1 1Z'], '#ffffff', new AbortController().signal, [], 'multiply');

    expect(operations).toEqual(['source-over|#6f4a2b', 'multiply|#ffffff']);
  });

  it('isolates the blend mode with save and restore', async () => {
    await run(['M0 0L1 1Z']);

    expect(context.save).toHaveBeenCalledTimes(1);
    expect(context.restore).toHaveBeenCalledTimes(1);
  });

  it('loads a base photo only once across renders and retries after a failure', async () => {
    await run([]);
    await run([]);
    expect(loadImage).toHaveBeenCalledTimes(1);

    loadImage.mockRejectedValueOnce(new Error('404'));
    await expect(
      renderer.render(
        asCanvas(),
        {
          imageUrl: 'keychains/other.jpg',
          paths: [],
          evenOddPaths: [],
          ink: '#111111',
          blend: 'multiply' as const,
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('404');
    await renderer.render(
      asCanvas(),
      {
        imageUrl: 'keychains/other.jpg',
        paths: [],
        evenOddPaths: [],
        ink: '#111111',
        blend: 'multiply' as const,
      },
      new AbortController().signal,
    );

    expect(loadImage.mock.calls.filter(([url]) => url === 'keychains/other.jpg')).toHaveLength(2);
  });

  it('does not touch the canvas when the render was aborted meanwhile', async () => {
    const controller = new AbortController();
    const rendering = run(['M0 0L1 1Z'], '#111111', controller.signal);
    controller.abort();

    await rendering;

    expect(context.drawImage).not.toHaveBeenCalled();
    expect(canvas.width).toBe(0);
  });

  it('fails when the canvas has no 2D context', async () => {
    canvas.getContext.mockReturnValue(null);

    await expect(run([])).rejects.toThrow('Canvas 2D context is not available');
  });
});
