import { HttpRequest, type HttpHandlerFn, type HttpEvent } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, type Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { authTokenInterceptor } from './auth-token.interceptor';

describe('authTokenInterceptor', () => {
  const buildAuthServiceStub = (accessToken: string | null) =>
    ({ accessToken: () => accessToken }) as unknown as AuthService;

  it('attaches the Authorization header when an access token is present', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: buildAuthServiceStub('a-token') }],
    });

    const req = new HttpRequest('GET', '/orders');
    let capturedRequest!: HttpRequest<unknown>;
    const next: HttpHandlerFn = (r) => {
      capturedRequest = r;
      return of({} as HttpEvent<unknown>) as Observable<HttpEvent<unknown>>;
    };

    TestBed.runInInjectionContext(() => authTokenInterceptor(req, next));

    expect(capturedRequest.headers.get('Authorization')).toBe('Bearer a-token');
  });

  it('leaves the request untouched when there is no access token', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: buildAuthServiceStub(null) }],
    });

    const req = new HttpRequest('GET', '/orders');
    let capturedRequest!: HttpRequest<unknown>;
    const next: HttpHandlerFn = (r) => {
      capturedRequest = r;
      return of({} as HttpEvent<unknown>) as Observable<HttpEvent<unknown>>;
    };

    TestBed.runInInjectionContext(() => authTokenInterceptor(req, next));

    expect(capturedRequest.headers.has('Authorization')).toBe(false);
  });
});
