<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Brain, Loader2, Send, Square, Zap } from 'lucide-vue-next';
import SafeHtml from '@/components/SafeHtml.vue';
import { renderMarkdown } from '@/utils/aiHelpers';
import type { PlanMessage, ParsedNetdisk } from './importDialogTypes';

const props = defineProps<{
  messages: PlanMessage[];
  isChatSending: boolean;
  currentStreamingText: string;
  currentReasoningText: string;
  parsedNetdisk: ParsedNetdisk | null;
  modelValue: string;
  isPlanJsonSynced: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'send', text?: string): void;
  (e: 'stop'): void;
}>();

const chatScrollContainer = ref<HTMLDivElement | null>(null);

const scrollToBottom = async () => {
  await nextTick();
  if (chatScrollContainer.value) {
    chatScrollContainer.value.scrollTop = chatScrollContainer.value.scrollHeight;
  }
};

watch(
  [() => props.messages, () => props.currentStreamingText, () => props.currentReasoningText],
  () => {
    scrollToBottom();
  },
  { deep: true, flush: 'post' },
);

const onSend = () => {
  emit('send');
};

const onSuggestionClick = (sug: string) => {
  emit('send', sug);
};
</script>

<template>
  <div
    class="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-white/[0.01] border rounded-2xl p-4"
    style="border-color: var(--border-base)"
  >
    <div
      class="flex items-center gap-1.5 pb-2 border-b mb-3"
      style="border-color: var(--border-base)"
    >
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      <span class="text-xs font-bold" style="color: var(--text-primary)"
        >与 AI 智能助理对话调优</span
      >
    </div>

    <!-- Chat Messages Scroll -->
    <div
      ref="chatScrollContainer"
      class="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin custom-scrollbar"
    >
      <div
        v-for="(msg, index) in messages"
        v-show="msg.role === 'user' || msg.content || msg.reasoning"
        :key="index"
        class="flex gap-2.5"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <!-- AI Avatar -->
        <div
          v-if="msg.role === 'assistant'"
          class="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shrink-0 shadow-md mt-0.5"
        >
          ✨
        </div>

        <div class="flex flex-col gap-1 max-w-[85%]">
          <!-- Thinking block (reasoning) -->
          <div v-if="msg.role === 'assistant' && msg.reasoning" class="mb-1">
            <button
              type="button"
              class="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer group"
              @click="msg.showReasoning = !msg.showReasoning"
            >
              <Brain class="w-3 h-3" />
              <span>{{ msg.showReasoning ? '收起' : '展开' }}思考过程</span>
              <span class="text-[9px] text-slate-400 font-normal"
                >({{ Math.round((msg.reasoning?.length || 0) * 0.45) }} tokens)</span
              >
            </button>
            <div
              v-if="msg.showReasoning"
              class="mt-1 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 text-[10px] text-indigo-500/80 dark:text-indigo-400/70 leading-relaxed whitespace-pre-wrap font-mono max-h-32 overflow-y-auto scrollbar-thin"
            >
              {{ msg.reasoning }}
            </div>
          </div>

          <!-- Main message bubble -->
          <div
            class="rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed"
            :class="
              msg.role === 'user'
                ? 'bg-accent text-white rounded-tr-none'
                : 'bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/30 dark:border-white/5'
            "
          >
            <!-- User: plain text -->
            <div v-if="msg.role === 'user'" class="whitespace-pre-line leading-relaxed">
              {{ msg.content }}
            </div>
            <!-- AI: rendered markdown -->
            <SafeHtml
              v-else
              class="ai-markdown leading-relaxed"
              :html="renderMarkdown(msg.content || '...')"
            />
          </div>

          <!-- Suggestion chips for the first greeting message -->
          <div
            v-if="
              msg.role === 'assistant' &&
              index === 0 &&
              msg.suggestions &&
              msg.suggestions.length &&
              !isChatSending
            "
            class="flex flex-wrap gap-1.5 mt-2 pl-0.5"
          >
            <button
              v-for="(sug, sIdx) in msg.suggestions"
              :key="sIdx"
              type="button"
              class="px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              style="
                border-color: var(--accent-color, #6366f1);
                color: var(--accent-color, #6366f1);
                background: transparent;
              "
              @mouseover="
                ($event.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'
              "
              @mouseleave="($event.currentTarget as HTMLElement).style.background = 'transparent'"
              @click="onSuggestionClick(sug)"
            >
              ⚡ {{ sug }}
            </button>
          </div>

          <!-- Live sync badge when JSON was parsed -->
          <div
            v-if="
              msg.role === 'assistant' &&
              index === messages.length - 1 &&
              isPlanJsonSynced &&
              !isChatSending
            "
            class="flex items-center gap-1 text-[9px] font-bold text-emerald-500 pl-1"
          >
            <Zap class="w-2.5 h-2.5" />
            <span>右侧规划已同步</span>
          </div>
        </div>

        <div
          v-if="msg.role === 'user'"
          class="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center text-accent text-xs font-black shrink-0 mt-0.5"
        >
          我
        </div>
      </div>

      <!-- Thinking/Loading indicator when waiting for first token -->
      <div
        v-if="isChatSending && !currentStreamingText && !currentReasoningText"
        class="flex gap-2.5"
      >
        <div
          class="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shrink-0 animate-pulse"
        >
          🧠
        </div>
        <div
          class="bg-slate-100 dark:bg-white/5 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-xs text-slate-400 flex items-center gap-1.5"
        >
          <Loader2 class="w-3.5 h-3.5 animate-spin text-accent" />
          <span>AI 正在思考并分析{{ parsedNetdisk ? '网盘资源' : '您的规划需求' }}...</span>
        </div>
      </div>

      <!-- Live reasoning streaming indicator -->
      <div
        v-if="isChatSending && currentReasoningText && !currentStreamingText"
        class="flex gap-2.5"
      >
        <div
          class="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shrink-0"
        >
          🧠
        </div>
        <div
          class="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-[10px] text-indigo-400 flex items-center gap-1.5 max-w-[80%]"
        >
          <Loader2 class="w-3 h-3 animate-spin text-indigo-500 shrink-0" />
          <span class="italic font-mono animate-pulse"
            >分析及规划思考中：{{ currentReasoningText.slice(-30) }}...</span
          >
        </div>
      </div>
    </div>

    <!-- Chat Input footer -->
    <div
      class="mt-3 pt-3 border-t flex items-center gap-2"
      style="border-color: var(--border-base)"
    >
      <input
        :value="modelValue"
        type="text"
        placeholder="输入您的调整指示，例如：“把阶段一和二合并”..."
        class="flex-1 px-4 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent"
        style="border-color: var(--border-base); color: var(--text-primary)"
        :disabled="isChatSending"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter="onSend"
      />

      <button
        v-if="isChatSending"
        type="button"
        class="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-all shrink-0"
        @click="emit('stop')"
      >
        <Square class="w-4 h-4 fill-current" />
      </button>
      <button
        v-else
        type="button"
        :disabled="!modelValue.trim()"
        class="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all shrink-0 disabled:opacity-50"
        style="background: var(--accent)"
        @click="onSend"
      >
        <Send class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
