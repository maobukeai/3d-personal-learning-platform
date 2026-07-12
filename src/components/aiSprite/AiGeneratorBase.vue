<script setup lang="ts">
import { Sparkles, Wand2, X, AlertCircle } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';

interface Props {
  show: boolean;
  title: string;
  isGenerating: boolean;
  generatingText?: string;
  errorMsg?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  variant?: 'glass' | 'immersive' | 'solid';
}

withDefaults(defineProps<Props>(), {
  generatingText: 'AI 正在奋力生成中，请稍候...',
  subtitle: '基于先进的人工智能模型为您量身定制',
  errorMsg: '',
  size: 'lg',
  variant: 'glass',
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<template>
  <Modal :show="show" :size="size" :show-close="false" @close="emit('close')">
    <div class="relative p-6 max-h-[90vh] overflow-y-auto scrollbar-hide text-left">
      <!-- Close Button -->
      <button
        type="button"
        class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
        @click="emit('close')"
      >
        <X class="w-5 h-5" />
      </button>

      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="p-2.5 bg-accent/10 text-accent rounded-2xl animate-pulse">
          <Sparkles class="w-6 h-6" />
        </div>
        <div>
          <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {{ title }}
          </h3>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {{ subtitle }}
          </p>
        </div>
      </div>

      <!-- Error Message -->
      <div
        v-if="errorMsg"
        class="mb-4 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-start gap-2.5"
      >
        <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
        <div>{{ errorMsg }}</div>
      </div>

      <!-- Main Slot Area -->
      <slot></slot>

      <!-- Result Slot Area -->
      <slot name="result"></slot>

      <!-- Actions Slot Area -->
      <div class="mt-6 flex justify-end gap-2">
        <slot name="actions"></slot>
      </div>

      <!-- Loading Overlay -->
      <div
        v-if="isGenerating"
        class="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-4 z-50 transition-all duration-300"
      >
        <div class="p-4 bg-accent/10 text-accent rounded-3xl animate-bounce">
          <Wand2 class="w-8 h-8 animate-spin" style="animation-duration: 3s" />
        </div>
        <div class="text-xs font-bold text-slate-700 dark:text-slate-200 animate-pulse">
          {{ generatingText }}
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
