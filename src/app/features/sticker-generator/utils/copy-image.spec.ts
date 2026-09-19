import { copyPngToClipboard } from './copy-image';

describe('copyPngToClipboard', () => {
  let write: ReturnType<typeof vi.fn>;
  let items: { data: Record<string, Promise<Blob>> }[];

  beforeEach(() => {
    items = [];
    write = vi.fn().mockResolvedValue(undefined);
    class FakeClipboardItem {
      constructor(public data: Record<string, Promise<Blob>>) {
        items.push(this);
      }
    }
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('writes one image/png clipboard item holding the given blob promise', async () => {
    const png = Promise.resolve(new Blob(['png'], { type: 'image/png' }));
    const createPng = vi.fn(() => png);

    await copyPngToClipboard(createPng);

    expect(createPng).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]?.data ?? {})).toEqual(['image/png']);
    expect(items[0]?.data['image/png']).toBe(png);
    expect(write.mock.calls[0]?.[0]).toEqual([items[0]]);
  });

  it('propagates a clipboard failure', async () => {
    write.mockRejectedValue(new Error('denied'));

    await expect(copyPngToClipboard(() => Promise.resolve(new Blob()))).rejects.toThrow('denied');
  });

  it('fails clearly when ClipboardItem is unavailable', async () => {
    vi.stubGlobal('ClipboardItem', undefined);

    await expect(copyPngToClipboard(() => Promise.resolve(new Blob()))).rejects.toThrow('Copying images is not supported in this browser');
    expect(write).not.toHaveBeenCalled();
  });

  it('does not start encoding the image when copying is unsupported', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    const createPng = vi.fn(() => Promise.resolve(new Blob()));

    await expect(copyPngToClipboard(createPng)).rejects.toThrow();
    expect(createPng).not.toHaveBeenCalled();
  });

  it('fails clearly when the async clipboard is unavailable', async () => {
    Reflect.deleteProperty(navigator, 'clipboard');

    await expect(copyPngToClipboard(() => Promise.resolve(new Blob()))).rejects.toThrow('Copying images is not supported in this browser');
  });
});
