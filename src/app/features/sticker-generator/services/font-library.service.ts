import { Injectable, InjectionToken, inject } from '@angular/core';
import type { OpentypeFont } from 'opentype.js';
import type { GlyphSource } from '../models/glyph-source.model';
import type { StickerFont } from '../models/sticker.model';
import { createGlyphSource } from '../utils/opentype-glyph-source';

const FONT_FETCH_TIMEOUT_MS = 60_000;

export type FontParser = (buffer: ArrayBuffer) => OpentypeFont;

export const FONT_PARSER_LOADER = new InjectionToken<() => Promise<FontParser>>('FONT_PARSER_LOADER', {
  providedIn: 'root',
  factory: () => async () => (await import('opentype.js/dist/opentype.mjs')).parse,
});

@Injectable({ providedIn: 'root' })
export class FontLibraryService {
  private readonly loadParser = inject(FONT_PARSER_LOADER);
  private readonly cache = new Map<string, Promise<GlyphSource>>();

  load(font: StickerFont): Promise<GlyphSource> {
    const cached = this.cache.get(font.id);
    if (cached) {
      return cached;
    }
    const pending = this.fetchGlyphSource(font).catch((error: unknown) => {
      this.cache.delete(font.id);
      throw error;
    });
    this.cache.set(font.id, pending);
    return pending;
  }

  private async fetchGlyphSource(font: StickerFont): Promise<GlyphSource> {
    const response = await fetch(font.url, { signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`Font request failed with status ${response.status}`);
    }
    const [buffer, parse] = await Promise.all([response.arrayBuffer(), this.loadParser()]);
    return createGlyphSource(parse(buffer));
  }
}
