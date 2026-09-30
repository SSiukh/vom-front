import { Injectable } from '@angular/core';
import { FETCH_TIMEOUT_MS } from '../data/keychain-config';
import type { KeychainMark, MarkVariantKind, VectorGraphic } from '../models/keychain.model';
import { parseMarkSvg } from '../utils/parse-mark-svg';

@Injectable({ providedIn: 'root' })
export class MarkLibrary {
  private readonly cache = new Map<string, Promise<VectorGraphic>>();

  load(mark: KeychainMark, variant: MarkVariantKind): Promise<VectorGraphic> {
    const url = mark.variants[variant];
    if (!url) {
      return Promise.reject(new Error(`Mark ${mark.id} has no ${variant} variant`));
    }
    const key = `${mark.id}:${variant}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const pending = this.fetchMark(url, mark.id).catch((error: unknown) => {
      this.cache.delete(key);
      throw error;
    });
    this.cache.set(key, pending);
    return pending;
  }

  private async fetchMark(url: string, id: string): Promise<VectorGraphic> {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`Could not load mark ${id}: ${response.status}`);
    }
    return parseMarkSvg(await response.text());
  }
}
