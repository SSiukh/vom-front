import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { IS_CONNECTION_PROBE } from '../connection/connection-probe.token';
import { REQUEST_TIMEOUT_MS } from '../interceptors/request-timeout.interceptor';
import { PingApiService } from './ping-api.service';

describe('PingApiService', () => {
  let service: PingApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets /ping as a connection probe with a budget long enough for a cold start', () => {
    let result: unknown;
    service.ping().subscribe((value) => (result = value));

    const req = httpMock.expectOne(`${environment.apiUrl}/ping`);
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(IS_CONNECTION_PROBE)).toBe(true);
    expect(req.request.context.get(REQUEST_TIMEOUT_MS)).toBe(150_000);
    req.flush({ status: 'ok' });

    expect(result).toEqual({ status: 'ok' });
  });
});
