import {
  HttpContext,
  HttpErrorResponse,
  HttpRequest,
  HttpResponse,
  type HttpEvent,
  type HttpHandlerFn,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, TimeoutError, firstValueFrom, of, throwError, type Observable } from 'rxjs';
import { IS_CONNECTION_PROBE } from '../connection/connection-probe.token';
import { ServerConnectionService } from '../connection/server-connection.service';
import { serverWakeInterceptor } from './server-wake.interceptor';

describe('serverWakeInterceptor', () => {
  const okResponse = new HttpResponse({ status: 200 });

  const createEnsureAwake = () => vi.fn((): Observable<void> => of(undefined));

  let mayBeAsleep = false;
  let ensureAwake = createEnsureAwake();
  let markReachable = vi.fn();
  let markUnreachable = vi.fn();

  beforeEach(() => {
    mayBeAsleep = false;
    ensureAwake = createEnsureAwake();
    markReachable = vi.fn();
    markUnreachable = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ServerConnectionService,
          useValue: {
            mayBeAsleep: () => mayBeAsleep,
            ensureAwake,
            markReachable,
            markUnreachable,
          },
        },
      ],
    });
  });

  const intercept = (req: HttpRequest<unknown>, next: HttpHandlerFn) =>
    TestBed.runInInjectionContext(() => serverWakeInterceptor(req, next));

  const failingThen = (errors: unknown[]): { next: HttpHandlerFn; calls: () => number } => {
    let callCount = 0;
    return {
      next: () => {
        const error = errors[callCount];
        callCount += 1;
        return error === undefined
          ? of(okResponse as HttpEvent<unknown>)
          : (throwError(() => error) as Observable<HttpEvent<unknown>>);
      },
      calls: () => callCount,
    };
  };

  it('passes connection probes straight through without waiting for a wake-up', async () => {
    mayBeAsleep = true;
    const req = new HttpRequest('GET', '/ping', { context: new HttpContext().set(IS_CONNECTION_PROBE, true) });

    const result = await firstValueFrom(intercept(req, () => of(okResponse)));

    expect(result).toBe(okResponse);
    expect(ensureAwake).not.toHaveBeenCalled();
    expect(markReachable).not.toHaveBeenCalled();
  });

  it('sends immediately when the server is known to be awake', async () => {
    const result = await firstValueFrom(intercept(new HttpRequest('GET', '/orders'), () => of(okResponse)));

    expect(result).toBe(okResponse);
    expect(ensureAwake).not.toHaveBeenCalled();
    expect(markReachable).toHaveBeenCalledOnce();
  });

  it('holds any request, including a POST, until the server has woken up', () => {
    mayBeAsleep = true;
    const awake = new Subject<void>();
    ensureAwake.mockReturnValue(awake);
    const next = vi.fn(() => of(okResponse as HttpEvent<unknown>));

    intercept(new HttpRequest('POST', '/orders', {}), next).subscribe();
    expect(next).not.toHaveBeenCalled();

    awake.next();
    awake.complete();

    expect(next).toHaveBeenCalledOnce();
  });

  it('marks the server reachable on an HTTP error response and rethrows it untouched', async () => {
    const notFound = new HttpErrorResponse({ status: 404 });
    const { next, calls } = failingThen([notFound]);

    await expect(firstValueFrom(intercept(new HttpRequest('GET', '/orders/1'), next))).rejects.toBe(notFound);
    expect(calls()).toBe(1);
    expect(markReachable).toHaveBeenCalledOnce();
    expect(markUnreachable).not.toHaveBeenCalled();
  });

  it('retries a GET once after waking the server when it times out', async () => {
    const { next, calls } = failingThen([new TimeoutError()]);

    const result = await firstValueFrom(intercept(new HttpRequest('GET', '/auth/2fa/status'), next));

    expect(result).toBe(okResponse);
    expect(calls()).toBe(2);
    expect(markUnreachable).toHaveBeenCalledOnce();
    expect(ensureAwake).toHaveBeenCalledOnce();
  });

  it('retries a GET only once when the network keeps failing', async () => {
    const networkError = new HttpErrorResponse({ status: 0 });
    const { next, calls } = failingThen([networkError, networkError]);

    await expect(firstValueFrom(intercept(new HttpRequest('GET', '/orders'), next))).rejects.toBe(networkError);
    expect(calls()).toBe(2);
  });

  it('never retries a non-GET request, so nothing is created twice', async () => {
    const timeoutError = new TimeoutError();
    const { next, calls } = failingThen([timeoutError]);

    await expect(firstValueFrom(intercept(new HttpRequest('POST', '/orders', {}), next))).rejects.toBe(
      timeoutError,
    );
    expect(calls()).toBe(1);
    expect(markUnreachable).toHaveBeenCalledOnce();
    expect(ensureAwake).not.toHaveBeenCalled();
  });

  it('does not retry a GET that failed with a real server error', async () => {
    const serverError = new HttpErrorResponse({ status: 500 });
    const { next, calls } = failingThen([serverError]);

    await expect(firstValueFrom(intercept(new HttpRequest('GET', '/orders'), next))).rejects.toBe(serverError);
    expect(calls()).toBe(1);
    expect(ensureAwake).not.toHaveBeenCalled();
  });
});
