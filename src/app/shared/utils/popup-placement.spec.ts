import { shouldOpenUpward } from './popup-placement';

describe('shouldOpenUpward', () => {
  const anchorAt = (top: number, bottom: number) => {
    const anchor = document.createElement('div');
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ top, bottom } as DOMRect);
    return anchor;
  };

  beforeEach(() => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
  });

  it('opens downward when the popup fits below the anchor', () => {
    expect(shouldOpenUpward(anchorAt(100, 130), 300)).toBe(false);
  });

  it('opens upward when there is no room below and more room above', () => {
    expect(shouldOpenUpward(anchorAt(700, 730), 300)).toBe(true);
  });

  it('stays downward when both sides have equal room', () => {
    expect(shouldOpenUpward(anchorAt(390, 410), 300)).toBe(false);
  });
});
