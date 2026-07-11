import { computed, ref, type ComputedRef } from 'vue';

export type OverlayType = 'modal' | 'drawer' | 'popover' | 'toast';

export interface OverlayEntry {
  id: symbol;
  type: OverlayType;
}

const Z_TOKENS: Record<OverlayType, { token: string; fallback: number }> = {
  modal: { token: '--z-modal', fallback: 1300 },
  drawer: { token: '--z-drawer', fallback: 1300 },
  popover: { token: '--z-dropdown', fallback: 1000 },
  toast: { token: '--z-toast', fallback: 1400 },
};

const overlayStack = ref<OverlayEntry[]>([]);

function readZToken(token: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function useOverlayManager() {
  const register = (type: OverlayType): symbol => {
    const id = Symbol(type);
    overlayStack.value = [...overlayStack.value, { id, type }];
    return id;
  };

  const unregister = (id: symbol): void => {
    overlayStack.value = overlayStack.value.filter((entry) => entry.id !== id);
  };

  const activeOverlays: ComputedRef<OverlayEntry[]> = computed(() => overlayStack.value);

  const isTopmost = (id: symbol): ComputedRef<boolean> =>
    computed(() => overlayStack.value[overlayStack.value.length - 1]?.id === id);

  const topZIndex: ComputedRef<number> = computed(() => {
    const stack = overlayStack.value;
    const top = stack[stack.length - 1];
    if (!top) return 0;
    const { token, fallback } = Z_TOKENS[top.type];
    return readZToken(token, fallback) + (stack.length - 1) * 10;
  });

  return { register, unregister, activeOverlays, isTopmost, topZIndex };
}
