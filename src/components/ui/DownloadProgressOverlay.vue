<script setup lang="ts">
import { Loader2, X } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';

interface Props {
  isDownloading: boolean;
  progress: number;
  speedStr: string;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'cancel'): void;
}>();

const label = useLabel();
</script>

<template>
  <!-- Downloading Progress Dialog Overlay -->
  <Teleport to="body">
    <div
      v-if="isDownloading"
      class="fixed bottom-6 right-6 z-[99999] w-[340px] p-5 rounded-2xl shadow-2xl border glass-panel backdrop-blur-xl flex flex-col gap-4 overflow-hidden"
      style="border-color: var(--border-base); background-color: var(--bg-card)"
    >
      <!-- Background glow -->
      <div
        class="absolute -top-12 -right-12 w-24 h-24 bg-accent/20 rounded-full blur-xl pointer-events-none"
      ></div>

      <div class="flex items-center justify-between">
        <span class="text-sm font-bold flex items-center gap-2" style="color: var(--text-primary)">
          <Loader2 class="w-4 h-4 animate-spin text-accent" />
          {{ label('正在下载...', 'Downloading...') }}
        </span>
        <button
          type="button"
          class="p-1 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 transition-all cursor-pointer flex items-center justify-center shrink-0"
          title="取消下载 / Cancel download"
          @click="emit('cancel')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        <div
          class="flex justify-between items-center text-xs font-mono text-[var(--text-secondary)]"
        >
          <span v-if="speedStr" class="font-medium text-emerald-400">{{ speedStr }}</span>
          <span v-else class="text-[var(--text-muted)]">{{
            label('正在建立连接...', 'Connecting...')
          }}</span>
          <span class="font-black text-accent">{{ progress }}%</span>
        </div>

        <!-- Progress Bar -->
        <div
          class="w-full bg-slate-100 dark:bg-slate-800/50 rounded-full h-2 overflow-hidden border border-white/5"
        >
          <div
            class="bg-accent h-2 rounded-full transition-all duration-300 shadow-[0_0_8px_var(--color-accent)]"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
      </div>

      <div class="text-[10px] text-[var(--text-muted)] leading-relaxed text-center">
        {{
          label(
            '采用多线程并发下载算法以获取最高网速。',
            'Multi-threaded chunked downloader is active for maximum speed.',
          )
        }}
      </div>
    </div>
  </Teleport>
</template>
