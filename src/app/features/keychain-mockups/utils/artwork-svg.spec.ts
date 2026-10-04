import type { KeychainArtwork } from '../models/keychain.model';
import { exportArtworkSvg } from './artwork-svg';

const artwork: KeychainArtwork = {
  paths: ['M120 300L170 300L170 350Z', 'M130 400L160 400L160 420Z'],
  evenOddPaths: [],
  bounds: { minX: 100, minY: 250, maxX: 200, maxY: 450 },
};

const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');

describe('exportArtworkSvg', () => {
  it('is a well-formed SVG whose size is the tight artwork box at full photo resolution (x2)', () => {
    const doc = parse(exportArtworkSvg(artwork, '#111111'));
    const root = doc.documentElement;

    expect(doc.querySelector('parsererror')).toBeNull();
    expect(root.getAttribute('width')).toBe('200');
    expect(root.getAttribute('height')).toBe('400');
    expect(root.getAttribute('viewBox')).toBe('0 0 200 400');
  });

  it('moves the artwork to the origin and doubles the coordinates', () => {
    const paths = Array.from(
      parse(exportArtworkSvg(artwork, '#111111')).querySelectorAll('path'),
    ).map((path) => path.getAttribute('d'));

    expect(paths).toEqual(['M40 100L140 100L140 200Z', 'M60 300L120 300L120 340Z']);
  });

  it('fills every path with the ink colour through one group', () => {
    const doc = parse(exportArtworkSvg(artwork, '#ff8800'));

    expect(doc.querySelector('g#art')?.getAttribute('fill')).toBe('#ff8800');
    expect(doc.querySelectorAll('g#art path')).toHaveLength(2);
  });

  it('contains only svg, g and path elements and no NaN', () => {
    const svg = exportArtworkSvg(artwork, '#111111');
    const tags = new Set(
      Array.from(parse(svg).querySelectorAll('*')).map((element) => element.tagName),
    );

    expect(Array.from(tags).sort()).toEqual(['g', 'path', 'svg']);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('ends with a trailing newline', () => {
    expect(exportArtworkSvg(artwork, '#111111').endsWith('</svg>\n')).toBe(true);
  });

  it('marks even-odd paths with fill-rule="evenodd" and leaves the others on the default rule', () => {
    const doc = parse(
      exportArtworkSvg(
        {
          ...artwork,
          paths: ['M120 300L170 300L170 350Z'],
          evenOddPaths: ['M130 400L160 400L160 420Z'],
        },
        '#111111',
      ),
    );
    const paths = Array.from(doc.querySelectorAll('g#art path'));

    expect(paths.map((path) => path.getAttribute('fill-rule'))).toEqual([null, 'evenodd']);
    expect(paths[1]?.getAttribute('d')).toBe('M60 300L120 300L120 340Z');
  });

  it('exports an artwork made only of even-odd paths', () => {
    const svg = exportArtworkSvg(
      { ...artwork, paths: [], evenOddPaths: ['M120 300L170 300L170 350Z'] },
      '#111111',
    );

    expect(parse(svg).querySelectorAll('g#art path')).toHaveLength(1);
  });

  it('rejects unsafe even-odd path data too', () => {
    expect(() =>
      exportArtworkSvg({ ...artwork, evenOddPaths: ['M0 0"/><script>'] }, '#111111'),
    ).toThrow();
  });

  it('refuses to export an empty artwork', () => {
    expect(() =>
      exportArtworkSvg({ paths: [], evenOddPaths: [], bounds: null }, '#111111'),
    ).toThrow('There is no artwork to export');
    expect(() =>
      exportArtworkSvg({ paths: [], evenOddPaths: [], bounds: artwork.bounds }, '#111111'),
    ).toThrow('There is no artwork to export');
  });

  it('writes the ink opacity on the group only when the ink is translucent', () => {
    const artwork = {
      paths: ['M0 0L10 0L10 10Z'],
      evenOddPaths: [],
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    };

    expect(exportArtworkSvg(artwork, '#9d906c', 0.8)).toContain(
      '<g id="art" fill="#9d906c" fill-opacity="0.8">',
    );
    expect(exportArtworkSvg(artwork, '#000000')).not.toContain('fill-opacity');
  });

  it('rejects an ink colour that is not #rrggbb', () => {
    expect(() => exportArtworkSvg(artwork, 'red')).toThrow(
      'The ink colour must be a #rrggbb value',
    );
    expect(() => exportArtworkSvg(artwork, '#111" onload="x')).toThrow(
      'The ink colour must be a #rrggbb value',
    );
  });

  it('rejects path data that could break out of the attribute', () => {
    expect(() => exportArtworkSvg({ ...artwork, paths: ['M0 0"/><script>'] }, '#111111')).toThrow();
  });
});
