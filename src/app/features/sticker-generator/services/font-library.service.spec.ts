import { TestBed } from '@angular/core/testing';
import type { OpentypeFont } from 'opentype.js';
import type { StickerFont } from '../models/sticker.model';
import { FONT_PARSER_LOADER, FontLibraryService, type FontParser } from './font-library.service';

const FONT: StickerFont = { id: 'test', label: 'Test', url: 'fonts/test.ttf' };

function fakeFont(): OpentypeFont {
  return {
    unitsPerEm: 1000,
    tables: { os2: { sCapHeight: 700 } },
    charToGlyph: () => ({
      index: 3,
      advanceWidth: 600,
      getPath: () => ({ commands: [] }),
      getBoundingBox: () => ({ x1: 0, y1: 0, x2: 0, y2: 0 }),
    }),
    charToGlyphIndex: () => 3,
    getKerningValue: () => 0,
  };
}

describe('FontLibraryService', () => {
  let service: FontLibraryService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let parse: ReturnType<typeof vi.fn<FontParser>>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    vi.stubGlobal('fetch', fetchMock);
    parse = vi.fn<FontParser>().mockReturnValue(fakeFont());
    TestBed.configureTestingModule({
      providers: [{ provide: FONT_PARSER_LOADER, useValue: () => Promise.resolve(parse) }],
    });
    service = TestBed.inject(FontLibraryService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the font file with the native fetch, not HttpClient', async () => {
    await service.load(FONT);

    expect(fetchMock).toHaveBeenCalledWith('fonts/test.ttf', { signal: expect.any(AbortSignal) });
  });

  it('parses the downloaded bytes and returns a glyph source for the font', async () => {
    const source = await service.load(FONT);

    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0]?.[0]).toBeInstanceOf(ArrayBuffer);
    expect(source.unitsPerEm).toBe(1000);
    expect(source.capHeight).toBe(700);
    expect(source.hasGlyph('a')).toBe(true);
  });

  it('downloads and parses a font only once, even for concurrent callers', async () => {
    const [first, second] = await Promise.all([service.load(FONT), service.load(FONT)]);
    const third = await service.load(FONT);

    expect(first).toBe(second);
    expect(third).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('keeps separate cache entries per font id', async () => {
    await service.load(FONT);
    await service.load({ ...FONT, id: 'other', url: 'fonts/other.ttf' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects when the server answers with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    await expect(service.load(FONT)).rejects.toThrow('Font request failed with status 404');
  });

  it('rejects when the font bytes cannot be parsed', async () => {
    parse.mockImplementation(() => {
      throw new Error('bad font');
    });

    await expect(service.load(FONT)).rejects.toThrow('bad font');
  });

  it('does not cache a failure, so a later attempt retries', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(service.load(FONT)).rejects.toThrow();
    await expect(service.load(FONT)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('FONT_PARSER_LOADER', () => {
  it('lazily resolves the real opentype.js parse function by default', async () => {
    TestBed.configureTestingModule({});

    const parser = await TestBed.inject(FONT_PARSER_LOADER)();

    expect(typeof parser).toBe('function');
  });
});
