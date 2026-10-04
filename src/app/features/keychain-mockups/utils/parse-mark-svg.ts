import type { VectorGraphic } from '../models/keychain.model';
import { transformPathData } from '../../sticker-generator/utils/path-data';

export function parseMarkSvg(text: string): VectorGraphic {
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = document.documentElement;
  if (document.querySelector('parsererror') || root.tagName.toLowerCase() !== 'svg') {
    throw new Error('The mark is not a valid SVG');
  }
  const box = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [minX, minY, width, height] = box;
  if (
    box.length !== 4 ||
    box.some((value) => !Number.isFinite(value)) ||
    (width ?? 0) <= 0 ||
    (height ?? 0) <= 0
  ) {
    throw new Error('The mark has no usable viewBox');
  }
  const nonZero: string[] = [];
  const evenOdd: string[] = [];
  for (const element of Array.from(root.querySelectorAll('path'))) {
    const data = (element.getAttribute('d') ?? '').trim();
    if (data === '' || element.closest('defs, clipPath, mask')) {
      continue;
    }
    const normalised = transformPathData(data, 1, -(minX ?? 0), -(minY ?? 0));
    const rule = element.closest('[fill-rule]')?.getAttribute('fill-rule');
    (rule === 'evenodd' ? evenOdd : nonZero).push(normalised);
  }
  if (nonZero.length + evenOdd.length === 0) {
    throw new Error('The mark has no paths');
  }
  return { width: width ?? 0, height: height ?? 0, paths: nonZero, evenOddPaths: evenOdd };
}
