import { Injectable, inject } from '@angular/core';
import { IMAGE_LOADER } from '../../sticker-generator/services/mockup-renderer.service';
import type { InkBlend } from '../models/keychain.model';

export interface KeychainRenderRequest {
  imageUrl: string;
  paths: readonly string[];
  evenOddPaths: readonly string[];
  ink: string;
  blend: InkBlend;
  opacity: number;
  metalPaths?: readonly string[];
  metalEvenOddPaths?: readonly string[];
}

const METAL_INK = '#000000';

@Injectable({ providedIn: 'root' })
export class KeychainRenderer {
  private readonly loadImage = inject(IMAGE_LOADER);
  private readonly images = new Map<string, Promise<HTMLImageElement>>();

  async render(
    canvas: HTMLCanvasElement,
    request: KeychainRenderRequest,
    signal: AbortSignal,
  ): Promise<void> {
    const image = await this.image(request.imageUrl);
    if (signal.aborted) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is not available');
    }
    if (canvas.width !== image.naturalWidth) {
      canvas.width = image.naturalWidth;
    }
    if (canvas.height !== image.naturalHeight) {
      canvas.height = image.naturalHeight;
    }
    context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
    const metalPaths = request.metalPaths ?? [];
    const metalEvenOddPaths = request.metalEvenOddPaths ?? [];
    if (
      request.paths.length +
        request.evenOddPaths.length +
        metalPaths.length +
        metalEvenOddPaths.length ===
      0
    ) {
      return;
    }
    context.save();
    context.globalCompositeOperation = request.blend;
    context.fillStyle = request.ink;
    context.globalAlpha = request.opacity;
    for (const path of request.paths) {
      context.fill(new Path2D(path));
    }
    for (const path of request.evenOddPaths) {
      context.fill(new Path2D(path), 'evenodd');
    }
    context.fillStyle = METAL_INK;
    context.globalAlpha = 1;
    for (const path of metalPaths) {
      context.fill(new Path2D(path));
    }
    for (const path of metalEvenOddPaths) {
      context.fill(new Path2D(path), 'evenodd');
    }
    context.restore();
  }

  private image(url: string): Promise<HTMLImageElement> {
    const cached = this.images.get(url);
    if (cached) {
      return cached;
    }
    const pending = this.loadImage(url).catch((error: unknown) => {
      this.images.delete(url);
      throw error;
    });
    this.images.set(url, pending);
    return pending;
  }
}
