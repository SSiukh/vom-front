import { Injectable, InjectionToken, inject } from '@angular/core';
import type { VectorGraphic } from '../models/keychain.model';
import { decodePhoto } from '../utils/decode-photo';
import { potraceToPathData } from '../utils/potrace-path';
import { prepareTraceInput, type RasterImage } from '../utils/trace-input';

export type PhotoDecoder = (file: File) => Promise<RasterImage>;
export type PotraceRunner = (image: RasterImage) => Promise<string[]>;

export const PHOTO_DECODER = new InjectionToken<PhotoDecoder>('PHOTO_DECODER', { factory: () => decodePhoto });

export const POTRACE_LOADER = new InjectionToken<() => Promise<PotraceRunner>>('POTRACE_LOADER', {
  factory: () => async () => {
    const engine = await import('esm-potrace-wasm');
    await engine.init();
    return (image) =>
      engine.potrace(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), {
        extractcolors: false,
        pathonly: true,
      });
  },
});

export const NO_INK_ERROR = 'NO_INK';

@Injectable({ providedIn: 'root' })
export class PhotoTracer {
  private readonly decode = inject(PHOTO_DECODER);
  private readonly loadPotrace = inject(POTRACE_LOADER);
  private runner: Promise<PotraceRunner> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  trace(file: File): Promise<VectorGraphic> {
    const run = this.queue.then(() => this.traceNow(file));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async traceNow(file: File): Promise<VectorGraphic> {
    const prepared = prepareTraceInput(await this.decode(file));
    if (!prepared) {
      throw new Error(NO_INK_ERROR);
    }
    const parts = await (await this.potrace())(prepared);
    const path = potraceToPathData(parts, prepared.height);
    if (!path) {
      throw new Error(NO_INK_ERROR);
    }
    return { width: prepared.width, height: prepared.height, paths: [path] };
  }

  private potrace(): Promise<PotraceRunner> {
    if (!this.runner) {
      const pending = this.loadPotrace().catch((error: unknown) => {
        this.runner = null;
        throw error;
      });
      this.runner = pending;
    }
    return this.runner;
  }
}
