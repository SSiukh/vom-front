import { FULL_RES_SCALE } from '../data/keychain-config';
import type { KeychainArtwork } from '../models/keychain.model';
import { formatNumber, transformPathData } from '../../sticker-generator/utils/path-data';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const PATH_DATA = /^[MLHVCQZ\d\s,.eE+-]+$/;
const METAL_INK = '#000000';

export function exportArtworkSvg(artwork: KeychainArtwork, ink: string, opacity = 1): string {
  const { bounds } = artwork;
  const metalPaths = artwork.metalPaths ?? [];
  const metalEvenOddPaths = artwork.metalEvenOddPaths ?? [];
  if (
    !bounds ||
    artwork.paths.length +
      artwork.evenOddPaths.length +
      metalPaths.length +
      metalEvenOddPaths.length ===
      0
  ) {
    throw new Error('There is no artwork to export');
  }
  if (!HEX_COLOR.test(ink)) {
    throw new Error('The ink colour must be a #rrggbb value');
  }
  const move = (path: string): string =>
    transformPathData(
      path,
      FULL_RES_SCALE,
      -bounds.minX * FULL_RES_SCALE,
      -bounds.minY * FULL_RES_SCALE,
    );
  const paths = artwork.paths.map(move);
  const evenOddPaths = artwork.evenOddPaths.map(move);
  const moveMetal = metalPaths.map(move);
  const moveMetalEvenOdd = metalEvenOddPaths.map(move);
  if (
    [...paths, ...evenOddPaths, ...moveMetal, ...moveMetalEvenOdd].some(
      (path) => !PATH_DATA.test(path),
    )
  ) {
    throw new Error('The artwork paths contain unsupported characters');
  }
  const width = formatNumber((bounds.maxX - bounds.minX) * FULL_RES_SCALE);
  const height = formatNumber((bounds.maxY - bounds.minY) * FULL_RES_SCALE);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <g id="art" fill="${ink}"${opacity < 1 ? ` fill-opacity="${formatNumber(opacity)}"` : ''}>`,
    ...paths.map((path) => `    <path d="${path}"/>`),
    ...evenOddPaths.map((path) => `    <path d="${path}" fill-rule="evenodd"/>`),
    '  </g>',
    ...(moveMetal.length + moveMetalEvenOdd.length > 0
      ? [
          `  <g id="metal" fill="${METAL_INK}">`,
          ...moveMetal.map((path) => `    <path d="${path}"/>`),
          ...moveMetalEvenOdd.map((path) => `    <path d="${path}" fill-rule="evenodd"/>`),
          '  </g>',
        ]
      : []),
    '</svg>',
    '',
  ].join('\n');
}
