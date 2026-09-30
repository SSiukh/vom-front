import { TRACE_MAX_DECODE_SIDE } from '../data/keychain-config';
import type { RasterImage } from './trace-input';

export async function decodePhoto(file: File): Promise<RasterImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, TRACE_MAX_DECODE_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is not available');
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return { data, width, height };
  } finally {
    bitmap.close();
  }
}
