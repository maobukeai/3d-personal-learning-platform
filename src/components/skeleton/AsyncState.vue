<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import SkeletonGrid from '@/components/SkeletonGrid.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from './ErrorState.vue';
type AsyncStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';
interface Props {
  status: AsyncStatus;
  error?: string;
  loadingDelay?: number;
  skeletonCount?: number;
}
const props = withDefaults(defineProps<Props>(), {
  error: '',
  loadingDelay: 200,
  skeletonCount: 3,
});
const emit = defineEmits<{ (e: 'retry'): void; (e: 'refresh'): void }>(); // Debounce the loading UI so brief loads (< loadingDelay ms) don't flash.
const showLoading = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
const clearTimer = () => {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
};
watch(
  () => props.status,
  (next) => {
    if (next === 'loading') {
      showLoading.value = false;
      clearTimer();
      if (props.loadingDelay <= 0) {
        showLoading.value = true;
      } else {
        timer = setTimeout(() => {
          showLoading.value = true;
        }, props.loadingDelay);
      }
    } else {
      clearTimer();
      showLoading.value = false;
    }
  },
  { immediate: true },
);
onBeforeUnmount(clearTimer);
</script>
<template>
  <div class="async-state" role="status" aria-live="polite" :aria-busy="props.status === 'loading'">
    <!-- Loading (delayed to prevent flash) -->
    <template v-if="props.status === 'loading' && showLoading">
      <slot name="loading"> <SkeletonGrid :count="props.skeletonCount" :columns="3" /> </slot>
    </template>
    <!-- Success -->
    <template v-else-if="props.status === 'success'"> <slot /> </template>
    <!-- Empty -->
    <template v-else-if="props.status === 'empty'">
      <slot name="empty">
        <EmptyState title="Nothing here yet" description="Check back later or try refreshing." />
      </slot>
    </template>
    <!-- Error -->
    <template v-else-if="props.status === 'error'">
      <slot name="error">
        <ErrorState :message="props.error || undefined" @retry="emit('retry')" />
      </slot>
    </template>
  </div>
</template>
