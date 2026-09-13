import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  Observable,
  TimeoutError,
  catchError,
  defer,
  exhaustMap,
  filter,
  finalize,
  fromEvent,
  map,
  of,
  retry,
  shareReplay,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { PingApiService } from '../api/ping-api.service';

const SLEEP_SUSPECT_AFTER_MS = 10 * 60_000;
const WAKING_NOTICE_DELAY_MS = 1_500;
const PING_RETRY_COUNT = 2;
const PING_RETRY_DELAY_MS = 3_000;

@Injectable({ providedIn: 'root' })
export class ServerConnectionService {
  private readonly pingApi = inject(PingApiService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly wakingSignal = signal(false);
  private readonly blockedUrlSignal = signal<string | null>(null);
  private lastReachedAt: number | null = null;
  private wakeInFlight: Observable<void> | null = null;

  readonly waking = this.wakingSignal.asReadonly();
  readonly blockedUrl = this.blockedUrlSignal.asReadonly();

  startMonitoring(): void {
    this.ensureAwake().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    fromEvent(this.document, 'visibilitychange')
      .pipe(
        filter(() => this.document.visibilityState === 'visible' && this.mayBeAsleep()),
        exhaustMap(() => this.ensureAwake()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.blockedUrlSignal.set(null));
  }

  mayBeAsleep(): boolean {
    return this.lastReachedAt === null || Date.now() - this.lastReachedAt > SLEEP_SUSPECT_AFTER_MS;
  }

  markReachable(): void {
    this.lastReachedAt = Date.now();
  }

  markUnreachable(): void {
    this.lastReachedAt = null;
  }

  ensureAwake(): Observable<void> {
    this.wakeInFlight ??= defer(() => {
      const noticeTimer = setTimeout(() => this.wakingSignal.set(true), WAKING_NOTICE_DELAY_MS);
      return this.pingApi.ping().pipe(
        retry({
          count: PING_RETRY_COUNT,
          delay: (error: unknown) =>
            error instanceof TimeoutError ? throwError(() => error) : timer(PING_RETRY_DELAY_MS),
        }),
        tap(() => this.markReachable()),
        map(() => undefined),
        catchError(() => of(undefined)),
        finalize(() => {
          clearTimeout(noticeTimer);
          this.wakingSignal.set(false);
          this.wakeInFlight = null;
        }),
      );
    }).pipe(shareReplay(1));
    return this.wakeInFlight;
  }

  reportBlockedNavigation(url: string): void {
    this.blockedUrlSignal.set(url);
  }

  retryBlockedNavigation(): void {
    const url = this.blockedUrlSignal();
    if (url === null) {
      return;
    }
    this.blockedUrlSignal.set(null);
    this.router.navigateByUrl(url);
  }
}
