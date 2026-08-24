import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/auth`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts login credentials to /auth/login', () => {
    service.login({ login: 'admin', password: 'secret' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ login: 'admin', password: 'secret' });
    req.flush({ requiresTwoFa: false, accessToken: 'a', refreshToken: 'r' });
  });

  it('posts pendingToken and code to /auth/2fa/verify-login', () => {
    service.verifyLogin({ pendingToken: 'p', code: '123456' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/2fa/verify-login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ pendingToken: 'p', code: '123456' });
    req.flush({ accessToken: 'a', refreshToken: 'r' });
  });

  it('posts refreshToken to /auth/refresh', () => {
    service.refresh({ refreshToken: 'r' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/refresh`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'r' });
    req.flush({ accessToken: 'a', refreshToken: 'r2' });
  });

  it('posts an empty body to /auth/logout', () => {
    service.logout().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/logout`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('posts an empty body to /auth/2fa/setup', () => {
    service.setupTwoFa().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/2fa/setup`);
    expect(req.request.method).toBe('POST');
    req.flush({ qrCodeDataUrl: 'data:image/png;base64,x', secret: 's' });
  });

  it('posts code to /auth/2fa/confirm', () => {
    service.confirmTwoFa({ code: '123456' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/2fa/confirm`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({ recoveryCodes: ['a', 'b'] });
  });

  it('gets /auth/2fa/status', () => {
    service.getTwoFaStatus().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/2fa/status`);
    expect(req.request.method).toBe('GET');
    req.flush({ twoFaEnabled: true });
  });
});
