type JwtTimeClaim = 'exp' | 'iat';

export const readJwtTimeClaimMs = (token: string, claim: JwtTimeClaim): number | null => {
  const payloadSegment = token.split('.')[1];
  if (!payloadSegment) {
    return null;
  }

  try {
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as Partial<Record<JwtTimeClaim, unknown>>;
    const value = payload[claim];
    return typeof value === 'number' && Number.isFinite(value) ? value * 1000 : null;
  } catch {
    return null;
  }
};
