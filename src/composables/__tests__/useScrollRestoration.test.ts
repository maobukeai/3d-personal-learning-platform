import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useScrollRestoration } from '../useScrollRestoration';

describe('useScrollRestoration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('should save and restore scroll position for container ref', async () => {
    const mockEl = {
      scrollTop: 350,
      scrollTo: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;

    const containerRef = ref<HTMLElement | null>(mockEl);
    const { saveScroll, restoreScroll, getSavedScroll } = useScrollRestoration(containerRef, {
      key: 'test_view_key',
    });

    saveScroll();
    expect(getSavedScroll()).toBe(350);

    await restoreScroll();
    expect(mockEl.scrollTo).toHaveBeenCalledWith({
      top: 350,
      behavior: 'instant',
    });
  });

  it('should support clearing saved scroll position', () => {
    const mockEl = {
      scrollTop: 500,
      scrollTo: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;

    const containerRef = ref<HTMLElement | null>(mockEl);
    const { saveScroll, clearSavedScroll, getSavedScroll } = useScrollRestoration(containerRef, {
      key: 'test_clear_key',
    });

    saveScroll();
    expect(getSavedScroll()).toBe(500);

    clearSavedScroll();
    expect(getSavedScroll()).toBe(0);
  });
});
