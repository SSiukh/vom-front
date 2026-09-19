import { downloadFile } from './download-file';

describe('downloadFile', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickedAnchors: HTMLAnchorElement[];

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL = vi.fn().mockReturnValue('blob:sticker');
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    clickedAnchors = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchors.push(this);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('wraps the content in a Blob of the given type', () => {
    downloadFile('a.svg', '<svg/>', 'image/svg+xml');

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/svg+xml');
    expect(blob.size).toBe('<svg/>'.length);
  });

  it('clicks an anchor that points at the blob URL with the file name', () => {
    downloadFile('a.svg', '<svg/>', 'image/svg+xml');

    expect(clickedAnchors).toHaveLength(1);
    expect(clickedAnchors[0]?.getAttribute('href')).toBe('blob:sticker');
    expect(clickedAnchors[0]?.download).toBe('a.svg');
  });

  it('removes the anchor from the document afterwards', () => {
    downloadFile('a.svg', '<svg/>', 'image/svg+xml');

    expect(document.querySelector('a[download="a.svg"]')).toBeNull();
  });

  it('revokes the blob URL after the click has been handled', () => {
    downloadFile('a.svg', '<svg/>', 'image/svg+xml');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:sticker');
  });

  it('accepts a Blob as content', () => {
    downloadFile('a.png', new Blob(['png'], { type: 'image/png' }), 'image/png');

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(3);
  });
});
