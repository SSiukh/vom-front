import type { GradientStop, StickerDocument, StickerGradient } from '../models/sticker.model';
import { formatNumber } from './path-data';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FILL = /^(#[0-9a-fA-F]{6}|url\(#[A-Za-z0-9_-]+\))$/;
const GRADIENT_ID = /^[A-Za-z0-9_-]+$/;
const PATH_DATA = /^[MLHVCQZ\d\s,.eE+-]+$/;

export function exportSvg(sticker: StickerDocument): string {
  if (!HEX_COLOR.test(sticker.background) || sticker.layers.some((layer) => !FILL.test(layer.fill))) {
    throw new Error('Sticker colours must be #rrggbb values');
  }
  if (sticker.layers.some((layer) => !PATH_DATA.test(layer.d))) {
    throw new Error('Sticker paths contain unsupported characters');
  }
  if (sticker.gradients.some((gradient) => !isValidGradient(gradient))) {
    throw new Error('Sticker gradients are invalid');
  }
  const width = formatNumber(sticker.width);
  const height = formatNumber(sticker.height);
  const radius = sticker.cornerRadius > 0 ? ` rx="${formatNumber(sticker.cornerRadius)}"` : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ...defs(sticker.gradients),
    `  <rect width="${width}" height="${height}"${radius} fill="${sticker.background}"/>`,
    '  <g id="art">',
    ...sticker.layers.map((layer) => `    <path d="${layer.d}" fill="${layer.fill}"/>`),
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

function isValidGradient(gradient: StickerGradient): boolean {
  const numbers =
    gradient.type === 'linear'
      ? [gradient.x1, gradient.y1, gradient.x2, gradient.y2]
      : [gradient.cx, gradient.cy, gradient.r, ...gradient.matrix];
  return (
    GRADIENT_ID.test(gradient.id) &&
    numbers.every(Number.isFinite) &&
    gradient.stops.every(
      (stop) =>
        HEX_COLOR.test(stop.color) && Number.isFinite(stop.offset) && Number.isFinite(stop.opacity) && stop.opacity >= 0 && stop.opacity <= 1,
    )
  );
}

function defs(gradients: readonly StickerGradient[]): string[] {
  if (gradients.length === 0) {
    return [];
  }
  return ['  <defs>', ...gradients.flatMap(gradientMarkup), '  </defs>'];
}

function gradientMarkup(gradient: StickerGradient): string[] {
  const stops = gradient.stops.map(stopMarkup);
  if (gradient.type === 'linear') {
    const box = [gradient.x1, gradient.y1, gradient.x2, gradient.y2].map(formatNumber);
    return [
      `    <linearGradient id="${gradient.id}" x1="${box[0]}" y1="${box[1]}" x2="${box[2]}" y2="${box[3]}">`,
      ...stops,
      '    </linearGradient>',
    ];
  }
  const matrix = gradient.matrix.map(formatNumber).join(' ');
  return [
    `    <radialGradient id="${gradient.id}" cx="${formatNumber(gradient.cx)}" cy="${formatNumber(gradient.cy)}" r="${formatNumber(gradient.r)}" gradientUnits="userSpaceOnUse" gradientTransform="matrix(${matrix})">`,
    ...stops,
    '    </radialGradient>',
  ];
}

function stopMarkup(stop: GradientStop): string {
  const opacity = stop.opacity === 1 ? '' : ` stop-opacity="${formatNumber(stop.opacity)}"`;
  return `      <stop offset="${formatNumber(stop.offset)}" stop-color="${stop.color}"${opacity}/>`;
}
