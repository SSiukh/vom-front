import type { ParamMap } from '@angular/router';

export function queryParamString(params: ParamMap, key: string): string | null {
  return params.get(key);
}

export function queryParamNumber(params: ParamMap, key: string, fallback: number): number {
  const raw = params.get(key);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
