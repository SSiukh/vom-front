import { HttpContext, HttpRequest, type HttpEvent, type HttpHandlerFn } from '@angular/common/http';
import { Subject, TimeoutError, firstValueFrom, of } from 'rxjs';
import { REQUEST_TIMEOUT_MS, requestTimeoutInterceptor } from './request-timeout.interceptor';

describe('requestTimeoutInterceptor', () => {
  const successEvent = {} as HttpEvent<unknown>;

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through a request that resolves before the timeout', async () => {
    const req = new HttpRequest('GET', '/orders');
    const next: HttpHandlerFn = () => of(successEvent);

    const result = await firstValueFrom(requestTimeoutInterceptor(req, next));

    expect(result).toBe(successEvent);
  });

  it('throws a TimeoutError once the default 20s budget elapses with no response', async () => {
    vi.useFakeTimers();
    const req = new HttpRequest('GET', '/orders');
    const hung = new Subject<HttpEvent<unknown>>();
    const next: HttpHandlerFn = () => hung.asObservable();

    const result = firstValueFrom(requestTimeoutInterceptor(req, next));
    vi.advanceTimersByTime(19_999);
    await Promise.resolve();
    vi.advanceTimersByTime(1);

    await expect(result).rejects.toBeInstanceOf(TimeoutError);
  });

  it('does not time out a request that resolves just under the default budget', async () => {
    vi.useFakeTimers();
    const req = new HttpRequest('GET', '/orders');
    const hung = new Subject<HttpEvent<unknown>>();
    const next: HttpHandlerFn = () => hung.asObservable();

    const result = firstValueFrom(requestTimeoutInterceptor(req, next));
    vi.advanceTimersByTime(19_999);
    hung.next(successEvent);
    hung.complete();

    await expect(result).resolves.toBe(successEvent);
  });

  it('honors a longer per-request timeout set via the REQUEST_TIMEOUT_MS context token', async () => {
    vi.useFakeTimers();
    const req = new HttpRequest('PATCH', '/orders/sync-statuses', null, {
      context: new HttpContext().set(REQUEST_TIMEOUT_MS, 90_000),
    });
    const hung = new Subject<HttpEvent<unknown>>();
    const next: HttpHandlerFn = () => hung.asObservable();

    const result = firstValueFrom(requestTimeoutInterceptor(req, next));
    vi.advanceTimersByTime(25_000);
    await Promise.resolve();
    hung.next(successEvent);
    hung.complete();

    await expect(result).resolves.toBe(successEvent);
  });

  it('still times out a request with an overridden longer budget once that budget elapses', async () => {
    vi.useFakeTimers();
    const req = new HttpRequest('PATCH', '/orders/sync-statuses', null, {
      context: new HttpContext().set(REQUEST_TIMEOUT_MS, 90_000),
    });
    const hung = new Subject<HttpEvent<unknown>>();
    const next: HttpHandlerFn = () => hung.asObservable();

    const result = firstValueFrom(requestTimeoutInterceptor(req, next));
    vi.advanceTimersByTime(90_000);

    await expect(result).rejects.toBeInstanceOf(TimeoutError);
  });
});
