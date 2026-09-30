import { decodePhoto } from './decode-photo';

describe('decodePhoto', () => {
  let close: ReturnType<typeof vi.fn>;
  let context: {
    fillStyle: string;
    fillRect: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    getImageData: ReturnType<typeof vi.fn>;
  };
  let canvases: HTMLCanvasElement[];

  const stubBitmap = (width: number, height: number) => {
    close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }));
  };

  beforeEach(() => {
    canvases = [];
    context = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      })),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      canvases.push(this);
      return context as unknown as CanvasRenderingContext2D;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws the photo on a white canvas at its own size when it is small enough', async () => {
    stubBitmap(300, 200);

    const result = await decodePhoto(new File(['x'], 'a.png', { type: 'image/png' }));

    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
    expect(result.data).toHaveLength(300 * 200 * 4);
    expect(context.fillStyle).toBe('#ffffff');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 300, 200);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 300, 200);
  });

  it('scales a photo whose longest side exceeds 2400 px down, keeping its proportions', async () => {
    stubBitmap(4800, 3600);

    const result = await decodePhoto(new File(['x'], 'a.png', { type: 'image/png' }));

    expect(result.width).toBe(2400);
    expect(result.height).toBe(1800);
  });

  it('releases the bitmap', async () => {
    stubBitmap(10, 10);

    await decodePhoto(new File(['x'], 'a.png', { type: 'image/png' }));

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('releases the bitmap and fails when the canvas has no 2D context', async () => {
    stubBitmap(10, 10);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    await expect(decodePhoto(new File(['x'], 'a.png', { type: 'image/png' }))).rejects.toThrow('Canvas 2D context is not available');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('fails when the browser cannot decode the file', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad image')));

    await expect(decodePhoto(new File(['x'], 'a.png', { type: 'image/png' }))).rejects.toThrow('bad image');
  });
});
