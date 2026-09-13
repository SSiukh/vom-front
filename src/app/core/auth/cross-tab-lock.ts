import { Observable, defer, from, lastValueFrom } from 'rxjs';

export const runWithCrossTabLock = <T>(lockName: string, work: () => Observable<T>): Observable<T> =>
  defer(() => {
    const locks: LockManager | undefined = navigator.locks;
    if (!locks) {
      return work();
    }
    return from(locks.request(lockName, () => lastValueFrom(work())));
  });
