import { TestBed } from '@angular/core/testing';
import type { KeychainMark } from '../models/keychain.model';
import { MarkLibrary } from './mark-library.service';

const MARK: KeychainMark = { id: 'bmw', label: 'BMW', variants: { icon: 'marks/bmw/icon.svg' } };
const COMBINED: KeychainMark = {
  id: 'honda',
  label: 'Honda',
  variants: { icon: 'marks/honda/icon.svg', text: 'marks/honda/text.svg', combined: 'marks/honda/combined.svg' },
};
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M0 0L10 0L10 10Z"/></svg>';

describe('MarkLibrary', () => {
  let service: MarkLibrary;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(SVG) });
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({});
    service = TestBed.inject(MarkLibrary);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the requested variant with the native fetch and a timeout, without going through HttpClient', async () => {
    await service.load(MARK, 'icon');

    expect(fetchMock).toHaveBeenCalledWith('marks/bmw/icon.svg', { signal: expect.any(AbortSignal) });
  });

  it('parses the SVG into a vector graphic', async () => {
    expect(await service.load(MARK, 'icon')).toEqual({ width: 100, height: 50, paths: ['M0 0L10 0L10 10Z'], evenOddPaths: [] });
  });

  it('fetches the right file for each variant of the same mark', async () => {
    await service.load(COMBINED, 'text');
    await service.load(COMBINED, 'combined');

    expect(fetchMock).toHaveBeenCalledWith('marks/honda/text.svg', expect.anything());
    expect(fetchMock).toHaveBeenCalledWith('marks/honda/combined.svg', expect.anything());
  });

  it('rejects a variant the mark does not have, without fetching anything', async () => {
    await expect(service.load(MARK, 'text')).rejects.toThrow('Mark bmw has no text variant');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads a variant only once, even for concurrent callers', async () => {
    await Promise.all([service.load(MARK, 'icon'), service.load(MARK, 'icon')]);
    await service.load(MARK, 'icon');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps separate cache entries per mark and per variant', async () => {
    await service.load(COMBINED, 'icon');
    await service.load(COMBINED, 'text');
    await service.load(COMBINED, 'combined');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects when the server answers with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    await expect(service.load(MARK, 'icon')).rejects.toThrow('Could not load mark bmw: 404');
  });

  it('rejects when the file is not a usable SVG', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('<svg') });

    await expect(service.load(MARK, 'icon')).rejects.toThrow('The mark is not a valid SVG');
  });

  it('does not cache a failure, so a later attempt retries', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(service.load(MARK, 'icon')).rejects.toThrow();
    await expect(service.load(MARK, 'icon')).resolves.toBeTruthy();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
