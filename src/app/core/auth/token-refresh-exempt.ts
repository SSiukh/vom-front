const TOKEN_REFRESH_EXEMPT_PATHS = ['/auth/login', '/auth/2fa/verify-login', '/auth/refresh'];

export const isTokenRefreshExempt = (url: string): boolean =>
  TOKEN_REFRESH_EXEMPT_PATHS.some((path) => url.includes(path));
