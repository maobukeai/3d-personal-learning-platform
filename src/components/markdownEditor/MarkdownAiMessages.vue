<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { Brain, Square } from 'lucide-vue-next';
import type { ChatMessage } from '@/composables/useMarkdownAi';
import MarkdownAiMessage from './MarkdownAiMessage.vue';
const props = defineProps<{
  messages: ChatMessage[];
  isGenerating: boolean;
  activeId: number | null;
  isDark: boolean;
  primaryApplyLabel: string;
  copiedId: number | null;
}>();
const emit = defineEmits<{
  (
    e: 'apply',
    payload: { mode: 'replace' | 'append' | 'copy'; content: string; msg: ChatMessage },
  ): void;
  (e: 'toggle-reasoning', msg: ChatMessage): void;
  (e: 'cancel'): void;
}>();
const messagesEnd = ref<HTMLElement | null>(null);
const scrollToEnd = () => {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth' });
  });
};
defineExpose({ scrollToEnd });
</script>
<template>
  <div class="aip__msgs">
    <div v-if="messages.length === 0" class="aip__empty">
      <Brain class="w-12 h-12 text-slate-200 dark:text-slate-700 stroke-[1.2] mb-3" />
      <p>准备就绪，选择策略点击“生成”启动 AI</p>
      <span>可以点击上方气泡快速润色、总结或翻译文档，支持微调输入</span>
    </div>
    <MarkdownAiMessage
      v-for="msg in messages"
      :key="msg.id"
      :msg="msg"
      :is-dark="isDark"
      :primary-apply-label="primaryApplyLabel"
      :copied-id="copiedId"
      @apply="emit('apply', $event)"
      @toggle-reasoning="emit('toggle-reasoning', $event)"
    />
    <!-- Streaming status bar at bottom of messages -->
    <div v-if="isGenerating" class="aip__status-bar">
      <div
        v-if="activeId && messages.find((m) => m.id === activeId)?.isStreaming"
        class="aip__thinking-bar"
      >
        <span class="aip__dots"><span></span><span></span><span></span></span>
        <span>AI 正在撰写建议中</span>
        <button type="button" class="aip__stop" @click="emit('cancel')">
          <Square class="w-2.5 h-2.5 fill-current" /> <span>停止生成</span>
        </button>
      </div>
      <div v-else class="aip__stop-bar">
        <button type="button" class="aip__stop" @click="emit('cancel')">
          <Square class="w-2.5 h-2.5 fill-current" /> <span>停止</span>
        </button>
      </div>
    </div>
    <div ref="messagesEnd" class="h-2"></div>
  </div>
</template>
<style scoped>
.aip__msgs {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 12px;
  user-select: text;
}
.aip__empty {
  margin: auto;
  text-align: center;
  padding: 24px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.aip__empty p {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.aip__empty span {
  font-size: 11.5px;
  color: var(--text-muted);
  max-width: 240px;
}
.aip__status-bar {
  flex-shrink: 0;
}
.aip__thinking-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-base);
  font-size: 11.5px;
  color: var(--text-muted);
}
.aip__stop-bar {
  display: flex;
  justify-content: flex-end;
}
.aip__dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.aip__dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  animation: dot-pulse 1.4s ease-in-out infinite;
}
.aip__dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.aip__dots span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes dot-pulse {
  0%,
  60%,
  100% {
    opacity: 0.2;
    transform: scale(0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1);
  }
}
.aip__stop {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.07);
  border-radius: 5px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.aip__stop:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.6);
}
</style>
