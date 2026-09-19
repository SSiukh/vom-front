import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  MAX_MOCKUP_OUTPUT_WIDTH,
  MOCKUP_BACKGROUND_URL,
  MOCKUP_SHADOW_BLUR_RATIO,
  MOCKUP_SHADOW_COLOR,
  MOCKUP_SHADOW_OFFSET_RATIO,
} from '../data/mockup-config';
import type { MockupSticker } from '../models/mockup.model';
import { layoutMockup } from '../utils/layout-mockup';
import { exportSvg } from '../utils/svg-export';

export type ImageLoader = (url: string) => Promise<HTMLImageElement>;

export const IMAGE_LOADER = new InjectionToken<ImageLoader>('IMAGE_LOADER', {
  factory: () => (url) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load image ${url}`));
      image.src = url;
    }),
});

@Injectable({ providedIn: 'root' })
export class MockupRenderer {
  private readonly loadImage = inject(IMAGE_LOADER);
  private photo: Promise<HTMLImageElement> | null = null;

  async render(canvas: HTMLCanvasElement, stickers: readonly MockupSticker[], signal: AbortSignal): Promise<void> {
    const [photo, images] = await Promise.all([this.loadPhoto(), this.loadStickerImages(stickers)]);
    if (signal.aborted) {
      return;
    }
    const scale = Math.min(1, MAX_MOCKUP_OUTPUT_WIDTH / photo.naturalWidth);
    const width = Math.round(photo.naturalWidth * scale);
    const height = Math.round(photo.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is not available');
    }
    canvas.width = width;
    canvas.height = height;
    context.drawImage(photo, 0, 0, width, height);
    const placements = layoutMockup(
      width,
      height,
      stickers.map((sticker) => ({ width: sticker.presetWidth, height: sticker.presetHeight })),
    );
    placements.forEach((placement, index) => {
      const image = images[index];
      if (!image) {
        return;
      }
      context.save();
      context.shadowColor = MOCKUP_SHADOW_COLOR;
      context.shadowBlur = placement.height * MOCKUP_SHADOW_BLUR_RATIO;
      context.shadowOffsetY = placement.height * MOCKUP_SHADOW_OFFSET_RATIO;
      context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
      context.restore();
    });
  }

  toPng(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the PNG'))), 'image/png');
    });
  }

  private loadPhoto(): Promise<HTMLImageElement> {
    if (!this.photo) {
      const pending = this.loadImage(MOCKUP_BACKGROUND_URL).catch((error: unknown) => {
        this.photo = null;
        throw error;
      });
      this.photo = pending;
    }
    return this.photo;
  }

  private loadStickerImages(stickers: readonly MockupSticker[]): Promise<HTMLImageElement[]> {
    return Promise.all(
      stickers.map(async (sticker) => {
        const url = URL.createObjectURL(new Blob([exportSvg(sticker.document)], { type: 'image/svg+xml' }));
        try {
          return await this.loadImage(url);
        } finally {
          URL.revokeObjectURL(url);
        }
      }),
    );
  }
}
