import { HttpContextToken, type HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs';

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

export const REQUEST_TIMEOUT_MS = new HttpContextToken<number>(() => DEFAULT_REQUEST_TIMEOUT_MS);

export const requestTimeoutInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(timeout(req.context.get(REQUEST_TIMEOUT_MS)));
