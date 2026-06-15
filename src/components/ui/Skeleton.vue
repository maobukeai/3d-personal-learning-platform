<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  width?: string;
  height?: string;
  circle?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '1rem',
  circle: false,
});

const style = computed(() => ({
  width: props.width,
  height: props.height,
}));
</script>

<template>
  <div
    class="skeleton-loader relative overflow-hidden bg-slate-200 dark:bg-slate-800"
    :class="circle ? 'rounded-full' : 'rounded-md'"
    :style="style"
  >
    <!-- Shimmer reflection effect -->
    <div class="shimmer-effect absolute inset-0"></div>
  </div>
</template>

<style scoped>
.skeleton-loader {
  position: relative;
}

.shimmer-effect {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.08) 20%,
    rgba(255, 255, 255, 0.18) 60%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: shimmer-animation 1.6s infinite ease-in-out;
}

.dark .shimmer-effect {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.03) 20%,
    rgba(255, 255, 255, 0.08) 60%,
    transparent 100%
  );
}

@keyframes shimmer-animation {
  100% {
    transform: translateX(100%);
  }
}
</style>
