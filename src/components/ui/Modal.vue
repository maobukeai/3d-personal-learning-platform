<script setup lang="ts">
import { computed, onUnmounted, ref, useSlots, watch } from 'vue';
import type { CSSProperties } from 'vue';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'radix-vue';
import { X } from 'lucide-vue-next';
import { useOverlayManager } from '@/composables/useOverlayManager';

/**
 * Modal — Industrial Craft Workbench dialog primitive (radix-vue Dialog).
 *
 * Variants:
 *  - glass (default): standard business dialog with physical glass texture.
 *  - immersive: glass surface — ONLY for 3D preview / command palette.
 *  - solid: opaque surface (--surface-solid), 12px radius, no transparency.
 *
 * Structure: Header (title, optional description, close) → Body (only
 * scrollable area) → Footer (fixed action area).
 */
type ModalVariant = 'glass' | 'immersive' | 'solid';
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen' | 'presentation';
type ModalPadding = 'none' | 'sm' | 'md' | 'lg';
type InitialFocus = 'auto' | 'first' | 'title';

interface Props {
  show: boolean;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'fullscreen' | 'presentation';
  /** Surface variant. */
  variant?: 'glass' | 'immersive' | 'solid';
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  padding?: ModalPadding;
  /**
   * Initial focus strategy on open.
   *  - 'auto'  : radix default (first focusable in content)
   *  - 'first' : first focusable element inside the body (default — skips
   *              the close button so short forms land on the first field)
   *  - 'title' : the dialog title (for long content / non-form dialogs)
   */
  initialFocus?: InitialFocus;
  /** @deprecated Use size="fullscreen" instead. */
  fullscreen?: boolean;
  /** Override z-index. */
  zIndex?: number;
  /** Whether to show the built-in close button. */
  showClose?: boolean;
  /** Optional class applied to the dialog surface for product-specific sizing. */
  contentClass?: string;
  /** Optional inline style applied to the dialog surface. */
  surfaceStyle?: CSSProperties;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  size: 'md',
  variant: 'glass',
  closeOnOutsideClick: true,
  closeOnEscape: true,
  padding: 'lg',
  initialFocus: 'first',
  fullscreen: false,
  showClose: true,
  contentClass: '',
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const slots = useSlots();

const close = () => emit('close');

const onOpenChange = (open: boolean) => {
  if (!open) close();
};

const onInteractOutside = (event: Event) => {
  if (!props.closeOnOutsideClick) {
    event.preventDefault();
  }
};

const onEscapeKeyDown = (event: KeyboardEvent) => {
  if (!props.closeOnEscape) {
    event.preventDefault();
  }
};

// ── Overlay Stack Management ─────────────────────────────────────────
const { register, unregister, activeOverlays } = useOverlayManager();
const overlayId = ref<symbol | null>(null);

watch(
  () => props.show,
  (show) => {
    if (show) {
      if (!overlayId.value) {
        overlayId.value = register('modal');
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
  // Nested overlay layering base
  return 1300 + idx * 10;
});

const overlayStyle = computed(() => {
  const z = calculatedZIndex.value;
  return z ? { zIndex: z } : {};
});

const contentStyle = computed(() => {
  const z = calculatedZIndex.value;
  return z ? { zIndex: z + 1 } : {};
});

// ── Variant resolution ──────────────────────────────────────────────
const resolvedVariant = computed<ModalVariant>(() => {
  return props.variant === 'immersive' ? 'immersive' : 'glass';
});

const isFullscreen = computed(() => props.fullscreen || props.size === 'fullscreen');

const resolvedSize = computed<ModalSize>(() => {
  if (isFullscreen.value) return 'fullscreen';
  if (props.size === 'xxl') return 'xl'; // backward-compat alias
  return (props.size ?? 'md') as ModalSize;
});

const sizeMaxWidth = computed<string | undefined>(() => {
  switch (resolvedSize.value) {
    case 'sm':
      return '440px';
    case 'lg':
      return '840px';
    case 'xl':
      return '1280px';
    case 'presentation':
      return '1440px';
    case 'fullscreen':
      return undefined;
    case 'md':
    default:
      return '580px';
  }
});

// ── a11y title / description visibility ─────────────────────────────
const showVisibleTitle = computed(() => !!props.title && !slots.header);
const showSrOnlyTitle = computed(() => !showVisibleTitle.value);
const srOnlyTitleText = computed(() => props.title || 'Dialog');

const showVisibleDescription = computed(() => !!props.description && !slots.header);
const showSrOnlyDescription = computed(() => !showVisibleDescription.value);
const srOnlyDescriptionText = computed(() => props.description || 'Dialog content');

// ── Class / style bindings ──────────────────────────────────────────
const surfaceClasses = computed(() => {
  const classes = [
    'modal-surface',
    `modal-surface--${resolvedVariant.value}`,
    `modal-surface--pad-${props.padding}`,
    props.contentClass,
  ];
  if (isFullscreen.value) classes.push('modal-surface--fullscreen');
  return classes;
});

const surfaceStyle = computed(() => {
  const s: CSSProperties = {};
  if (sizeMaxWidth.value) s.maxWidth = sizeMaxWidth.value;
  return { ...s, ...props.surfaceStyle };
});

const contentClasses = computed(() => {
  const classes = ['modal-content'];
  if (isFullscreen.value) classes.push('modal-content--fullscreen');
  return classes;
});

// ── Focus management ────────────────────────────────────────────────
const titleRef = ref<HTMLElement | null>(null);
const bodyRef = ref<HTMLElement | null>(null);

const onOpenAutoFocus = (event: Event) => {
  if (props.initialFocus === 'auto') return;

  if (props.initialFocus === 'title') {
    if (titleRef.value) {
      event.preventDefault();
      titleRef.value.focus();
    }
    return;
  }

  const body = bodyRef.value;
  if (body) {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = body.querySelector<HTMLElement>(selector);
    if (focusable) {
      event.preventDefault();
      focusable.focus();
    }
  }
};
</script>

<template>
  <DialogRoot :open="show" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="modal-overlay" :style="overlayStyle" />

      <DialogContent
        :class="contentClasses"
        :style="contentStyle"
        :aria-modal="true"
        @interact-outside="onInteractOutside"
        @escape-key-down="onEscapeKeyDown"
        @open-auto-focus="onOpenAutoFocus"
      >
        <div :class="surfaceClasses" :style="surfaceStyle">
          <!-- Screen-reader-only DialogTitle (renders when no visible title) -->
          <DialogTitle v-if="showSrOnlyTitle" as-child>
            <span class="sr-only">{{ srOnlyTitleText }}</span>
          </DialogTitle>

          <!-- Screen-reader-only DialogDescription (renders when no visible description) -->
          <DialogDescription v-if="showSrOnlyDescription" as-child>
            <span class="sr-only">{{ srOnlyDescriptionText }}</span>
          </DialogDescription>

          <!-- Header: title, optional description, close button -->
          <header v-if="title || description || slots.header" class="modal-header">
            <slot name="header">
              <div class="modal-header-text">
                <DialogTitle v-if="title" as-child>
                  <h2 ref="titleRef" tabindex="-1" class="modal-title">
                    {{ title }}
                  </h2>
                </DialogTitle>
                <DialogDescription v-if="description" as-child>
                  <p class="modal-description">{{ description }}</p>
                </DialogDescription>
              </div>
            </slot>

            <DialogClose v-if="showClose" as-child>
              <button type="button" class="modal-close" aria-label="Close">
                <X :size="20" />
              </button>
            </DialogClose>
          </header>

          <!-- Floating close button when there is no header -->
          <DialogClose v-else-if="showClose" as-child>
            <button type="button" class="modal-close modal-close--floating" aria-label="Close">
              <X :size="20" />
            </button>
          </DialogClose>

          <!-- Body: the only scrollable area -->
          <div ref="bodyRef" class="modal-body">
            <slot />
          </div>

          <!-- Footer: fixed action area -->
          <footer v-if="slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
