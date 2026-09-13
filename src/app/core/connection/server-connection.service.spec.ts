import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, TimeoutError, defer, throwError, type Observable } from 'rxjs';
import { PingApiService } from '../api/ping-api.service';
import type { PingResponse } from './ping-response.model';
import { ServerConnectionService } from './server-connection.service';

describe('ServerConnectionService', () => {
  let pings: Subject<PingResponse>[];
  let pingImpl: () => Observable<PingResponse>;
  let service: ServerConnectionService;

  const answerPing = (index = pings.length - 1) => {
    pings[index].next({ status: 'ok' });
    pings[index].complete();
  };

  beforeEach(() => {
    pings = [];
    pingImpl = () => {
      const ping = new Subject<PingResponse>();
      pings.push(ping);
      return ping;
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PingApiService, useValue: { ping: () => pingImpl() } }],
    });
    service = TestBed.inject(ServerConnectionService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('sleep tracking', () => {
    it('treats the server as possibly asleep until something has reached it', () => {
      expect(service.mayBeAsleep()).toBe(true);

      service.markReachable();

      expect(service.mayBeAsleep()).toBe(false);
    });

    it('treats the server as possibly asleep again after a connection failure', () => {
      service.markReachable();
      service.markUnreachable();

      expect(service.mayBeAsleep()).toBe(true);
    });

    it('treats the server as possibly asleep after ten quiet minutes', () => {
      const start = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(start);
      service.markReachable();

      vi.spyOn(Date, 'now').mockReturnValue(start + 10 * 60_000 - 1);
      expect(service.mayBeAsleep()).toBe(false);

      vi.spyOn(Date, 'now').mockReturnValue(start + 10 * 60_000 + 1);
      expect(service.mayBeAsleep()).toBe(true);
    });
  });

  describe('ensureAwake', () => {
    it('shares one in-flight ping across concurrent callers and marks the server reachable', () => {
      let resolved = 0;
      service.ensureAwake().subscribe(() => (resolved += 1));
      service.ensureAwake().subscribe(() => (resolved += 1));

      expect(pings.length).toBe(1);
      answerPing();

      expect(resolved).toBe(2);
      expect(service.mayBeAsleep()).toBe(false);
    });

    it('starts a new ping once the previous one has finished', () => {
      service.ensureAwake().subscribe();
      answerPing();
      service.ensureAwake().subscribe();

      expect(pings.length).toBe(2);
    });

    it('shows the waking notice only when the ping takes longer than 1.5s', () => {
      vi.useFakeTimers();
      service.ensureAwake().subscribe();

      vi.advanceTimersByTime(1_400);
      expect(service.waking()).toBe(false);

      vi.advanceTimersByTime(200);
      expect(service.waking()).toBe(true);

      answerPing();
      expect(service.waking()).toBe(false);
    });

    it('never shows the waking notice for a fast ping', () => {
      vi.useFakeTimers();
      service.ensureAwake().subscribe();
      answerPing();

      vi.advanceTimersByTime(5_000);

      expect(service.waking()).toBe(false);
    });

    it('retries a fast ping failure twice, three seconds apart, before giving up', () => {
      vi.useFakeTimers();
      let attempts = 0;
      pingImpl = () =>
        defer(() => {
          attempts += 1;
          return throwError(() => new HttpErrorResponse({ status: 0 }));
        });
      let resolved = false;
      service.ensureAwake().subscribe(() => (resolved = true));

      expect(attempts).toBe(1);
      vi.advanceTimersByTime(3_000);
      expect(attempts).toBe(2);
      vi.advanceTimersByTime(3_000);
      expect(attempts).toBe(3);

      expect(resolved).toBe(true);
      expect(service.mayBeAsleep()).toBe(true);
      expect(service.waking()).toBe(false);
    });

    it('does not retry a ping that already timed out, and still resolves', () => {
      let attempts = 0;
      pingImpl = () =>
        defer(() => {
          attempts += 1;
          return throwError(() => new TimeoutError());
        });
      let resolved = false;

      service.ensureAwake().subscribe(() => (resolved = true));

      expect(attempts).toBe(1);
      expect(resolved).toBe(true);
    });
  });

  describe('startMonitoring', () => {
    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(TestBed.inject(DOCUMENT), 'visibilityState', { value: state, configurable: true });
      TestBed.inject(DOCUMENT).dispatchEvent(new Event('visibilitychange'));
    };

    afterEach(() => {
      Reflect.deleteProperty(TestBed.inject(DOCUMENT), 'visibilityState');
    });

    it('pings right away at startup', () => {
      service.startMonitoring();

      expect(pings.length).toBe(1);
    });

    it('pings again when the tab becomes visible and the server may have gone to sleep', () => {
      service.startMonitoring();
      answerPing();
      service.markUnreachable();

      setVisibility('visible');

      expect(pings.length).toBe(2);
    });

    it('does not ping when the tab becomes visible while the server is known to be awake', () => {
      service.startMonitoring();
      answerPing();

      setVisibility('visible');

      expect(pings.length).toBe(1);
    });

    it('does not ping when the tab is hidden', () => {
      service.startMonitoring();
      answerPing();
      service.markUnreachable();

      setVisibility('hidden');

      expect(pings.length).toBe(1);
    });

    it('clears a blocked navigation once any navigation succeeds', async () => {
      service.startMonitoring();
      service.reportBlockedNavigation('/orders');

      await TestBed.inject(Router).navigateByUrl('/');

      expect(service.blockedUrl()).toBeNull();
    });
  });

  describe('blocked navigation', () => {
    it('remembers the url a navigation was blocked on', () => {
      service.reportBlockedNavigation('/orders?page=2');

      expect(service.blockedUrl()).toBe('/orders?page=2');
    });

    it('retries the blocked url and clears the notice', () => {
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      service.reportBlockedNavigation('/orders?page=2');

      service.retryBlockedNavigation();

      expect(navigateSpy).toHaveBeenCalledWith('/orders?page=2');
      expect(service.blockedUrl()).toBeNull();
    });

    it('does nothing when there is no blocked navigation to retry', () => {
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      service.retryBlockedNavigation();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
