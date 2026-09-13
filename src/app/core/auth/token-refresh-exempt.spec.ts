import { isTokenRefreshExempt } from './token-refresh-exempt';

describe('isTokenRefreshExempt', () => {
  it('exempts the endpoints that issue or rotate tokens', () => {
    expect(isTokenRefreshExempt('https://api.test/auth/login')).toBe(true);
    expect(isTokenRefreshExempt('https://api.test/auth/2fa/verify-login')).toBe(true);
    expect(isTokenRefreshExempt('https://api.test/auth/refresh')).toBe(true);
  });

  it('does not exempt regular or other auth endpoints', () => {
    expect(isTokenRefreshExempt('https://api.test/orders')).toBe(false);
    expect(isTokenRefreshExempt('https://api.test/auth/2fa/status')).toBe(false);
    expect(isTokenRefreshExempt('https://api.test/auth/logout')).toBe(false);
  });
});
