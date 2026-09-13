import { readJwtTimeClaimMs } from './jwt.util';
import { buildTestJwt } from './testing/build-test-jwt';

describe('readJwtTimeClaimMs', () => {
  it('reads exp and iat as milliseconds', () => {
    const token = buildTestJwt({ sub: 'u1', iat: 1_700_000_000, exp: 1_700_000_900 });

    expect(readJwtTimeClaimMs(token, 'iat')).toBe(1_700_000_000_000);
    expect(readJwtTimeClaimMs(token, 'exp')).toBe(1_700_000_900_000);
  });

  it('decodes base64url payloads that need padding and url-safe characters', () => {
    const token = buildTestJwt({ sub: '>>>???', jti: 'ab', exp: 1_700_000_900 });

    expect(readJwtTimeClaimMs(token, 'exp')).toBe(1_700_000_900_000);
  });

  it('returns null when the claim is missing or not a number', () => {
    const token = buildTestJwt({ sub: 'u1', exp: '1700000900' });

    expect(readJwtTimeClaimMs(token, 'exp')).toBeNull();
    expect(readJwtTimeClaimMs(token, 'iat')).toBeNull();
  });

  it('returns null for a token without a payload segment', () => {
    expect(readJwtTimeClaimMs('not-a-jwt', 'exp')).toBeNull();
  });

  it('returns null for a payload that is not valid base64 JSON', () => {
    expect(readJwtTimeClaimMs('header.%%%.signature', 'exp')).toBeNull();
    expect(readJwtTimeClaimMs(`header.${btoa('null')}.signature`, 'exp')).toBeNull();
  });
});
