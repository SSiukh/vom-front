import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IS_CONNECTION_PROBE } from '../connection/connection-probe.token';
import type { PingResponse } from '../connection/ping-response.model';
import { REQUEST_TIMEOUT_MS } from '../interceptors/request-timeout.interceptor';

const PING_TIMEOUT_MS = 150_000;

@Injectable({ providedIn: 'root' })
export class PingApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/ping`;

  ping(): Observable<PingResponse> {
    return this.http.get<PingResponse>(this.url, {
      context: new HttpContext().set(IS_CONNECTION_PROBE, true).set(REQUEST_TIMEOUT_MS, PING_TIMEOUT_MS),
    });
  }
}
