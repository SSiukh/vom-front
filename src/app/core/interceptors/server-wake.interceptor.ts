import { HttpErrorResponse, HttpResponse, type HttpEvent, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TimeoutError, catchError, of, switchMap, tap, throwError, type Observable } from 'rxjs';
import { IS_CONNECTION_PROBE } from '../connection/connection-probe.token';
import { ServerConnectionService } from '../connection/server-connection.service';

const RETRYABLE_METHODS = ['GET', 'HEAD'];

const isConnectionFailure = (error: unknown): boolean =>
  error instanceof TimeoutError || (error instanceof HttpErrorResponse && error.status === 0);

export const serverWakeInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(IS_CONNECTION_PROBE)) {
    return next(req);
  }

  const connection = inject(ServerConnectionService);

  const send = (): Observable<HttpEvent<unknown>> =>
    next(req).pipe(
      tap({
        next: (event) => {
          if (event instanceof HttpResponse) {
            connection.markReachable();
          }
        },
        error: (error: unknown) => {
          if (isConnectionFailure(error)) {
            connection.markUnreachable();
          } else if (error instanceof HttpErrorResponse) {
            connection.markReachable();
          }
        },
      }),
    );

  const whenAwake = connection.mayBeAsleep() ? connection.ensureAwake() : of(undefined);

  return whenAwake.pipe(
    switchMap(() => send()),
    catchError((error: unknown) => {
      if (!isConnectionFailure(error) || !RETRYABLE_METHODS.includes(req.method)) {
        return throwError(() => error);
      }
      return connection.ensureAwake().pipe(switchMap(() => send()));
    }),
  );
};
