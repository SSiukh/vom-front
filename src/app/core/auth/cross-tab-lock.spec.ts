import { firstValueFrom, of, throwError } from 'rxjs';
import { runWithCrossTabLock } from './cross-tab-lock';

describe('runWithCrossTabLock', () => {
  const installLocks = (request: (name: string, callback: () => Promise<unknown>) => Promise<unknown>) => {
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
  };

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks');
  });

  it('runs the work directly when the Web Locks API is unavailable', () => {
    let result: string | undefined;

    runWithCrossTabLock('lock', () => of('done')).subscribe((value) => (result = value));

    expect(result).toBe('done');
  });

  it('does not start the work until subscribed', () => {
    const work = vi.fn(() => of('done'));

    const locked = runWithCrossTabLock('lock', work);

    expect(work).not.toHaveBeenCalled();
    locked.subscribe();
    expect(work).toHaveBeenCalledOnce();
  });

  it('runs the work only once the named lock is granted, and emits its result', async () => {
    let grant: (() => void) | undefined;
    const request = vi.fn(
      (_name: string, callback: () => Promise<unknown>) =>
        new Promise<unknown>((resolve, reject) => {
          grant = () => callback().then(resolve, reject);
        }),
    );
    installLocks(request);
    const work = vi.fn(() => of('done'));

    const result = firstValueFrom(runWithCrossTabLock('vom-lock', work));

    expect(request).toHaveBeenCalledWith('vom-lock', expect.any(Function));
    expect(work).not.toHaveBeenCalled();
    grant?.();

    await expect(result).resolves.toBe('done');
    expect(work).toHaveBeenCalledOnce();
  });

  it('propagates an error from the work, which also releases the lock', async () => {
    installLocks((_name, callback) => callback());
    const failure = new Error('refresh failed');

    await expect(firstValueFrom(runWithCrossTabLock('lock', () => throwError(() => failure)))).rejects.toBe(failure);
  });
});
