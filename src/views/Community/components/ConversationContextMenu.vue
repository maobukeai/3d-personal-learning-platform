<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import type { ChatConversation } from './chatTypes';

defineProps<{
  visible: boolean;
  x: number;
  y: number;
  conversation: ChatConversation | null;
}>();

const emit = defineEmits<{
  (e: 'delete', conversation: ChatConversation): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="visible"
    class="fixed z-[100] py-2 rounded-2xl shadow-2xl border border-strong/10 min-w-[160px] glass-panel backdrop-blur-xl overflow-hidden"
    :style="{
      left: x + 'px',
      top: y + 'px',
    }"
    @click.stop
  >
    <button
      type="button"
      class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-rose-500/10 text-rose-500 transition-all cursor-pointer font-bold"
      @click="conversation && emit('delete', conversation)"
    >
      <Trash2 class="w-4 h-4" /> {{ t('common.delete') }} {{ t('sidebar.messages') }}
    </button>
  </div>
</template>
