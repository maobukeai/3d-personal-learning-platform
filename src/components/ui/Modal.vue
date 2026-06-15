<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { X } from 'lucide-vue-next';
import Card from './Card.vue';

interface Props {
  show: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  closeOnOutsideClick?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  fullscreen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: 'md',
  closeOnOutsideClick: true,
  padding: 'lg',
  fullscreen: false,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const close = () => {
  emit('close');
};

const handleOutsideClick = (event: MouseEvent) => {
  if (props.closeOnOutsideClick && event.target === event.currentTarget) {
    close();
  }
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close();
  }
};

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
);

onUnmounted(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 scale-95"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center"
        :class="fullscreen ? 'p-0 overflow-hidden' : 'p-4 overflow-y-auto'"
      >
        <!-- Frosted Glass Backdrop Overlay -->
        <div
          class="fixed inset-0 bg-black/40 backdrop-blur-md dark:bg-black/60 transition-opacity duration-300"
          @click="handleOutsideClick"
        ></div>

        <!-- Modal Content Container -->
        <div
          class="relative z-10 transform transition-all duration-300"
          :class="[
            fullscreen ? 'w-screen h-screen max-w-none m-0' : 'w-full',
            !fullscreen &&
              (size === 'sm'
                ? 'max-w-md'
                : size === 'lg'
                  ? 'max-w-2xl'
                  : size === 'xl'
                    ? 'max-w-4xl'
                    : size === 'xxl'
                      ? 'max-w-6xl'
                      : 'max-w-lg'),
          ]"
        >
          <Card
            glass
            :padding="padding"
            class="shadow-[0_25px_60px_rgba(0,0,0,0.35)]"
            :class="fullscreen ? 'rounded-none h-screen w-screen border-none max-w-none' : ''"
          >
            <!-- Header -->
            <div
              v-if="title || $slots.header"
              class="flex items-center justify-between mb-5 pb-3 border-b border-strong/40"
            >
              <slot name="header">
                <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
                  {{ title }}
                </h3>
              </slot>

              <button
                type="button"
                class="rounded-full p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
                @click="close"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Body -->
            <div class="modal-body text-sm text-[var(--text-secondary)]">
              <slot></slot>
            </div>

            <!-- Footer -->
            <div
              v-if="$slots.footer"
              class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10"
            >
              <slot name="footer"></slot>
            </div>
          </Card>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
