<script setup lang="ts">
import { computed, useAttrs, ref, watch, onUnmounted } from 'vue';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'radix-vue';
import { X } from 'lucide-vue-next';
import { cn } from '@/utils/cn';
import { useOverlayManager } from '@/composables/useOverlayManager';

/**
 * Drawer — radix-vue Dialog primitive (focus trap, body scroll lock,
 * Escape close) with direction-aware rounding, fullscreen support, and an
 * unified glass or solid surface.
 */
defineOptions({ inheritAttrs: false });

type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | number | (string & {});

interface Props {
  modelValue: boolean;
  direction?: 'rtl' | 'ltr' | 'ttb' | 'btt';
  /**
   * Panel size. Enum maps to px (ltr/rtl → width; ttb/btt → height):
   * sm 320 / md 480 / lg 640 / xl 800. A number is treated as px.
   */
  size?: DrawerSize;
  withHeader?: boolean;
  title?: string;
  beforeClose?: (done: () => void) => void;
  /** Occupy the entire viewport (0 rounding, no size constraint). */
  fullscreen?: boolean;
  /** Surface variant. 'glass' applies the frosted-glass surface, 'solid' is opaque. */
  variant?: 'glass' | 'immersive' | 'solid';
  /** Explicit z-index for the panel (overlay sits one layer below). */
  zIndex?: number;
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'rtl',
  size: 'md',
  withHeader: true,
  title: '',
  beforeClose: undefined,
  fullscreen: false,
  variant: 'glass',
  zIndex: undefined,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const attrs = useAttrs();

const close = () => {
  if (typeof props.beforeClose === 'function') {
    props.beforeClose(() => {
      emit('update:modelValue', false);
    });
  } else {
    emit('update:modelValue', false);
  }
};

const onOpenChange = (open: boolean) => {
  if (!open) close();
};

// ── Overlay Stack Management ─────────────────────────────────────────
const { register, unregister, activeOverlays } = useOverlayManager();
const overlayId = ref<symbol | null>(null);

watch(
  () => props.modelValue,
  (show) => {
    if (show) {
      if (!overlayId.value) {
        overlayId.value = register('drawer');
      }
    } else {
      if (overlayId.value) {
        unregister(overlayId.value);
        overlayId.value = null;
      }
    }
  },
  { immediate: true },
);

watch(
  () => activeOverlays.value.length,
  (len) => {
    if (typeof document === 'undefined') return;
    const app = document.getElementById('app');
    if (!app) return;
    if (len > 0) {
      app.setAttribute('inert', '');
      app.setAttribute('aria-hidden', 'true');
    } else {
      app.removeAttribute('inert');
      app.removeAttribute('aria-hidden');
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (overlayId.value) {
    unregister(overlayId.value);
    overlayId.value = null;
  }
  if (typeof document !== 'undefined') {
    const app = document.getElementById('app');
    if (app && activeOverlays.value.length === 0) {
      app.removeAttribute('inert');
      app.removeAttribute('aria-hidden');
    }
  }
});

const stackIndex = computed(() => {
  if (!overlayId.value) return -1;
  return activeOverlays.value.findIndex((entry) => entry.id === overlayId.value);
});

const calculatedZIndex = computed(() => {
  if (props.zIndex != null) return props.zIndex;
  const idx = stackIndex.value;
  if (idx <= 0) return undefined;
  return 1300 + idx * 10;
});

const panelZIndex = computed(() => {
  const z = calculatedZIndex.value;
  return z ? z + 1 : 'var(--z-drawer-content)';
});

const overlayZIndex = computed(() => {
  const z = calculatedZIndex.value;
  return z ? z : 'var(--z-drawer-backdrop)';
});

// ── Size and Position mappings ──────────────────────────────────────
const SIZE_MAP: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: '320px',
  md: '480px',
  lg: '640px',
  xl: '800px',
};

const sizeValue = computed<string | undefined>(() => {
  const s = props.size;
  if (typeof s === 'number') return `${s}px`;
  if (typeof s === 'string') {
    return SIZE_MAP[s as keyof typeof SIZE_MAP] ?? s;
  }
  return undefined;
});

const sizeStyle = computed<Record<string, string | undefined>>(() => {
  if (props.fullscreen) return {};
  const val = sizeValue.value;
  if (!val) return {};
  if (props.direction === 'rtl' || props.direction === 'ltr') {
    return { width: val };
  }
  return { height: val };
});

const positionClass = computed(() => {
  if (props.fullscreen) return 'fixed inset-0 rounded-none';
  switch (props.direction) {
    case 'ltr':
      return 'fixed top-0 left-0 h-full rounded-l-none rounded-r-[16px]';
    case 'ttb':
      return 'fixed top-0 inset-x-0 rounded-t-none rounded-b-[16px]';
    case 'btt':
      return 'fixed bottom-0 inset-x-0 rounded-b-none rounded-t-[16px]';
    case 'rtl':
    default:
      return 'fixed top-0 right-0 h-full rounded-r-none rounded-l-[16px]';
  }
});

// Inline border-radius guarantees direction rounding overrides both the
// `surface-solid` utility and global `.modal-surface--glass` borders.
const radiusStyle = computed<Record<string, string>>(() => {
  if (props.fullscreen) return { borderRadius: '0' };
  switch (props.direction) {
    case 'ltr':
      return { borderRadius: '0 16px 16px 0' };
    case 'rtl':
      return { borderRadius: '16px 0 0 16px' };
    case 'ttb':
      return { borderRadius: '0 0 16px 16px' };
    case 'btt':
      return { borderRadius: '16px 16px 0 0' };
    default:
      return { borderRadius: '0 16px 16px 0' };
  }
});

const slideAnimation = computed(() => {
  switch (props.direction) {
    case 'ltr':
      return 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left';
    case 'ttb':
      return 'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top';
    case 'btt':
      return 'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom';
    case 'rtl':
    default:
      return 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right';
  }
});

const surfaceClass = computed(() => {
  if (props.variant === 'immersive') {
    return 'modal-surface--immersive';
  }
  if (props.variant === 'glass') {
    return 'modal-surface--glass';
  }
  return 'surface-solid shadow-card';
});
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay
        class="modal-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        :style="{ zIndex: overlayZIndex }"
      />

      <!-- Drawer Panel -->
      <DialogContent
        v-bind="attrs"
        :aria-modal="true"
        :class="
          cn(
            positionClass,
            slideAnimation,
            surfaceClass,
            'flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out transition-all duration-300 ease-out',
          )
        "
        :style="[sizeStyle, radiusStyle, { zIndex: panelZIndex }]"
      >
        <!-- Visually Hidden fallback Title / Description for Radix validation -->
        <DialogTitle v-if="!withHeader || (!title && !$slots.header)" as-child>
          <span class="sr-only">Drawer Dialog</span>
        </DialogTitle>
        <DialogDescription as-child>
          <span class="sr-only">{{ title || 'Drawer Content Description' }}</span>
        </DialogDescription>
        <!-- Header -->
        <div
          v-if="withHeader"
          class="flex items-center justify-between px-5 py-4 border-b border-strong/40"
        >
          <slot name="header">
            <DialogTitle as-child>
              <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
                {{ title }}
              </h3>
            </DialogTitle>
          </slot>
          <button
            type="button"
            aria-label="Close drawer"
            class="rounded-full p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            @click="close"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="drawer-body flex-1 overflow-y-auto text-sm text-[var(--text-secondary)]">
          <slot></slot>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
