import type { StickerDocument } from '../models/sticker.model';
import { formatNumber } from './path-data';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const PATH_DATA = /^[MLHVCQZ\d\s,.eE+-]+$/;

export function exportSvg(sticker: StickerDocument): string {
  if (!HEX_COLOR.test(sticker.background) || !HEX_COLOR.test(sticker.artwork)) {
    throw new Error('Sticker colours must be #rrggbb values');
  }
  if (sticker.artPaths.some((path) => !PATH_DATA.test(path))) {
    throw new Error('Sticker paths contain unsupported characters');
  }
  const width = formatNumber(sticker.width);
  const height = formatNumber(sticker.height);
  const radius = sticker.cornerRadius > 0 ? ` rx="${formatNumber(sticker.cornerRadius)}"` : '';
  const paths = sticker.artPaths.map((path) => `    <path d="${path}"/>`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <rect width="${width}" height="${height}"${radius} fill="${sticker.background}"/>`,
    `  <g id="art" fill="${sticker.artwork}">`,
    ...paths,
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}
