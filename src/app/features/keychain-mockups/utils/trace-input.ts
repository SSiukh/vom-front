import { TRACE_CROP_PADDING, TRACE_TARGET_SIDE, TRACE_THRESHOLD } from '../data/keychain-config';

export interface RasterImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function prepareTraceInput(image: RasterImage): RasterImage | null {
  const grey = toGrey(image);
  const box = inkBox(grey, image.width, image.height);
  if (!box) {
    return null;
  }
  const cropWidth = box.maxX - box.minX + 1;
  const cropHeight = box.maxY - box.minY + 1;
  const scale = TRACE_TARGET_SIDE / Math.max(cropWidth, cropHeight);
  const width = Math.max(1, Math.round(cropWidth * scale));
  const height = Math.max(1, Math.round(cropHeight * scale));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const sourceY = box.minY + Math.min(cropHeight - 1, (row + 0.5) / scale - 0.5);
    for (let column = 0; column < width; column++) {
      const sourceX = box.minX + Math.min(cropWidth - 1, (column + 0.5) / scale - 0.5);
      const value = sample(grey, image.width, image.height, sourceX, sourceY) < TRACE_THRESHOLD ? 0 : 255;
      const offset = (row * width + column) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { data, width, height };
}

function toGrey(image: RasterImage): Float32Array {
  const grey = new Float32Array(image.width * image.height);
  for (let index = 0; index < grey.length; index++) {
    const offset = index * 4;
    const luminance = 0.299 * (image.data[offset] ?? 0) + 0.587 * (image.data[offset + 1] ?? 0) + 0.114 * (image.data[offset + 2] ?? 0);
    const alpha = (image.data[offset + 3] ?? 255) / 255;
    grey[index] = luminance * alpha + 255 * (1 - alpha);
  }
  return grey;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function inkBox(grey: Float32Array, width: number, height: number): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if ((grey[row * width + column] ?? 255) < TRACE_THRESHOLD) {
        minX = Math.min(minX, column);
        maxX = Math.max(maxX, column);
        minY = Math.min(minY, row);
        maxY = Math.max(maxY, row);
      }
    }
  }
  if (maxX < 0) {
    return null;
  }
  return {
    minX: Math.max(0, minX - TRACE_CROP_PADDING),
    minY: Math.max(0, minY - TRACE_CROP_PADDING),
    maxX: Math.min(width - 1, maxX + TRACE_CROP_PADDING),
    maxY: Math.min(height - 1, maxY + TRACE_CROP_PADDING),
  };
}

function sample(grey: Float32Array, width: number, height: number, x: number, y: number): number {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const top = (grey[y0 * width + x0] ?? 255) * (1 - fx) + (grey[y0 * width + x1] ?? 255) * fx;
  const bottom = (grey[y1 * width + x0] ?? 255) * (1 - fx) + (grey[y1 * width + x1] ?? 255) * fx;
  return top * (1 - fy) + bottom * fy;
}
