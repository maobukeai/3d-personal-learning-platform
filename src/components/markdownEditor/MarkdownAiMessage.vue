<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { Brain, Copy, Check } from 'lucide-vue-next';
import type { ChatMessage } from '@/composables/useMarkdownAi';
const MdPreview = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdPreview));
const props = defineProps<{
  msg: ChatMessage;
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
}>();
</script>
<template>
  <div class="aip__msg-wrapper">
    <!-- User block -->
    <div v-if="msg.role === 'user'" class="aip__msg aip__msg--user">
      <div class="aip__msg-meta">
        <span>{{ msg.actionIcon }}</span> <strong>{{ msg.actionLabel }}</strong>
        <span>• {{ msg.ctxSummary }}</span>
      </div>
      <p v-if="msg.promptText" class="aip__user-prompt">{{ msg.promptText }}</p>
    </div>
    <!-- Assistant block -->
    <div v-else class="aip__msg aip__msg--assist">
      <!-- Reasoning details (Thinking) -->
      <div v-if="msg.reasoning" class="aip__reasoning">
        <button type="button" class="aip__reasoning-toggle" @click="emit('toggle-reasoning', msg)">
          <Brain class="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>{{ msg.showReasoning ? '隐藏 AI 思考路径' : '展开 AI 思考路径' }}</span>
        </button>
        <div v-if="msg.showReasoning" class="aip__reasoning-content">{{ msg.reasoning }}</div>
      </div>
      <!-- Stream Text Body -->
      <div class="aip__msg-body">
        <pre
          v-if="msg.isStreaming && !msg.content"
          class="chat-ai__stream-text"
        >正在组织语言...<span class="aip__cursor">▋</span></pre>
        <pre
          v-else-if="msg.isStreaming"
          class="chat-ai__stream-text">{{ msg.content || ' ' }}<span class="aip__cursor">▋</span></pre>
        <MdPreview
          v-else
          :model-value="msg.content"
          :theme="isDark ? 'dark' : 'light'"
          class="aip__md-preview"
          preview-only
        />
        <!-- Errors -->
        <div v-if="msg.error" class="aip__msg-error">{{ msg.error }}</div>
        <!-- Footer action buttons -->
        <div v-if="!msg.isStreaming && msg.content" class="chat-ai__actions">
          <button
            type="button"
            class="ai-act-btn ai-act-btn--primary"
            :disabled="msg.applied"
            @click="emit('apply', { mode: 'replace', content: msg.content, msg })"
          >
            <span>{{ msg.applied ? '已应用' : primaryApplyLabel }}</span>
          </button>
          <button
            type="button"
            class="ai-act-btn ai-act-btn--secondary"
            @click="emit('apply', { mode: 'append', content: msg.content, msg })"
          >
            <span>追加尾部</span>
          </button>
          <button
            type="button"
            class="ai-act-btn ai-act-btn--ghost"
            @click="emit('apply', { mode: 'copy', content: msg.content, msg })"
          >
            <Check v-if="copiedId === msg.id" class="w-3 h-3 text-green-500" />
            <Copy v-else class="w-3 h-3" />
            <span>{{ copiedId === msg.id ? '已复制' : '复制' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.aip__msg-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.aip__msg {
  max-width: 90%;
  display: flex;
  flex-direction: column;
}
.aip__msg--user {
  align-self: flex-end;
  background: var(--accent-light);
  border: 1px solid var(--accent-light-border, var(--border-base));
  border-radius: 10px 10px 2px 10px;
  padding: 7px 10px;
  font-size: 12.5px;
}
.aip__msg-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-secondary);
}
.aip__user-prompt {
  margin-top: 3px;
  color: var(--text-primary);
  font-size: 12.5px;
  line-height: 1.4;
  word-break: break-all;
}
.aip__msg--assist {
  align-self: flex-start;
  width: 100%;
}
.aip__reasoning {
  margin-bottom: 6px;
}
.aip__reasoning-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}
.aip__reasoning-toggle:hover {
  color: var(--text-primary);
}
.aip__reasoning-content {
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-subtle);
  border-left: 3px solid #8b5cf6;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.45;
  white-space: pre-wrap;
}
.aip__msg-body {
  background: var(--bg-subtle);
  border: 1px solid var(--border-base);
  border-radius: 10px 10px 10px 2px;
  padding: 8px 10px;
}
.chat-ai__stream-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
}
.aip__cursor {
  display: inline-block;
  color: var(--accent);
  font-weight: bold;
  animation: aip-blink 0.8s infinite;
}
@keyframes aip-blink {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}
.aip__msg-error {
  margin-top: 5px;
  font-size: 11.5px;
  color: #ef4444;
}
.chat-ai__actions {
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px solid var(--border-base);
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
}
.ai-act-btn {
  flex: 1;
  padding: 5px 6px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.14s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1.5px solid transparent;
}
.ai-act-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.ai-act-btn--primary {
  background: var(--accent);
  color: #fff;
}
.ai-act-btn--primary:not(:disabled):hover {
  background: var(--accent-hover);
}
.ai-act-btn--secondary {
  background: var(--bg-app);
  border-color: var(--border-base);
  color: var(--text-primary);
}
.ai-act-btn--secondary:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.ai-act-btn--ghost {
  background: transparent;
  border-color: var(--border-base);
  color: var(--text-muted);
}
.ai-act-btn--ghost:hover {
  color: var(--text-primary);
  background: var(--bg-subtle);
}
@media (max-width: 767px) {
  .chat-ai__actions {
    flex-wrap: wrap;
  }
  .ai-act-btn {
    min-width: calc(50% - 4px);
  }
}
</style>
