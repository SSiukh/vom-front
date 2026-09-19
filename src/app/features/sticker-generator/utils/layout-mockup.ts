import { MOCKUP_GAP_WIDTH_RATIO, MOCKUP_MAX_BLOCK_HEIGHT_FRACTION, MOCKUP_WIDTH_FRACTION } from '../data/mockup-config';
import type { MockupPlacement, MockupSize } from '../models/mockup.model';

export function layoutMockup(photoWidth: number, photoHeight: number, sizes: readonly MockupSize[]): MockupPlacement[] {
  if (sizes.length === 0) {
    return [];
  }
  const fullWidth = photoWidth * MOCKUP_WIDTH_FRACTION;
  const fullGap = fullWidth * MOCKUP_GAP_WIDTH_RATIO;
  const fullHeights = sizes.map((size) => (fullWidth * size.height) / size.width);
  const blockHeight = fullHeights.reduce((sum, height) => sum + height, 0) + fullGap * (sizes.length - 1);
  const shrink = Math.min(1, (photoHeight * MOCKUP_MAX_BLOCK_HEIGHT_FRACTION) / blockHeight);
  const width = fullWidth * shrink;
  const gap = fullGap * shrink;
  let y = (photoHeight - blockHeight * shrink) / 2;
  return fullHeights.map((fullHeight) => {
    const placement = { x: (photoWidth - width) / 2, y, width, height: fullHeight * shrink };
    y += placement.height + gap;
    return placement;
  });
}
