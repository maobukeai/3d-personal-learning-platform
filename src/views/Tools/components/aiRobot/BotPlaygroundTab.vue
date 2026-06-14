<script setup lang="ts">
import {
  PlayCircle,
  Sparkles,
  RefreshCw,
  Bot,
  Copy,
  Gauge,
  CheckCircle,
  FileJson,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import type { AiBotIntegration, PayloadPreview } from '../../aiRobotAccessModel';

defineProps<{
  selectedIntegration: AiBotIntegration | null;
  scenarioOptions: Array<{ label: string; prompt: string; conversationId: string }>;
  playgroundUser: string;
  playgroundConversation: string;
  playgroundPrompt: string;
  isPlaygroundRunning: boolean;
  playgroundReply: string;
  playgroundQuality: {
    replyChars: number;
    inputChars: number;
    estimatedPushChunks: number;
    hasActionableStructure: boolean;
  } | null;
  playgroundSuggestions: string[];
  samplePayload: string;
  isPayloadPreviewing: boolean;
  payloadPreview: PayloadPreview | null;
}>();

const emit = defineEmits<{
  (e: 'update:playgroundUser', val: string): void;
  (e: 'update:playgroundConversation', val: string): void;
  (e: 'update:playgroundPrompt', val: string): void;
  (e: 'update:samplePayload', val: string): void;
  (e: 'run-playground'): void;
  (e: 'preview-payload'): void;
  (e: 'use-scenario', scenario: { label: string; prompt: string; conversationId: string }): void;
}>();

const copyText = async (value: string, label = '内容') => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    ElMessage.success(`${label}已复制`);
  } catch (_error) {
    ElMessage.warning('当前浏览器不支持自动复制');
  }
};
</script>

<template>
  <section class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
    <div class="tool-panel">
      <div class="panel-head">
        <div class="panel-title">
          <PlayCircle class="h-4 w-4 text-sky-500" />
          <span>沙盒模拟</span>
        </div>
        <span class="panel-caption">{{ selectedIntegration?.name || '未选择接入' }}</span>
      </div>
      <div class="space-y-3 p-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="scenario in scenarioOptions"
            :key="scenario.label"
            type="button"
            class="scenario-chip"
            @click="emit('use-scenario', scenario)"
          >
            <Sparkles class="h-3.5 w-3.5" />
            <span>{{ scenario.label }}</span>
          </button>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="field-label">模拟用户</label>
            <input
              :value="playgroundUser"
              class="form-input"
              @input="emit('update:playgroundUser', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div>
            <label class="field-label">模拟会话</label>
            <input
              :value="playgroundConversation"
              class="form-input"
              @input="
                emit('update:playgroundConversation', ($event.target as HTMLInputElement).value)
              "
            />
          </div>
        </div>

        <div>
          <label class="field-label">用户消息</label>
          <textarea
            :value="playgroundPrompt"
            class="form-textarea mt-2 min-h-[8rem]"
            @input="emit('update:playgroundPrompt', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </div>

        <button
          type="button"
          class="primary-btn"
          :disabled="isPlaygroundRunning || !selectedIntegration"
          @click="emit('run-playground')"
        >
          <RefreshCw v-if="isPlaygroundRunning" class="h-4 w-4 animate-spin" />
          <PlayCircle v-else class="h-4 w-4" />
          <span>{{ isPlaygroundRunning ? '模拟中' : '运行沙盒模拟' }}</span>
        </button>

        <div v-if="playgroundReply" class="playground-reply">
          <div class="flex items-center justify-between gap-3">
            <div class="panel-title">
              <Bot class="h-4 w-4 text-emerald-500" />
              <span>AI 回复</span>
            </div>
            <button type="button" class="mini-link" @click="copyText(playgroundReply, '沙盒回复')">
              <Copy class="h-3.5 w-3.5" />
              <span>复制</span>
            </button>
          </div>
          <p
            class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200"
          >
            {{ playgroundReply }}
          </p>
        </div>
      </div>
    </div>

    <aside class="space-y-3">
      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <Gauge class="h-4 w-4 text-amber-500" />
            <span>模拟质量</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 p-3">
          <div class="mini-metric">
            <span>输入字符</span>
            <strong>{{ playgroundQuality?.inputChars || 0 }}</strong>
          </div>
          <div class="mini-metric">
            <span>回复字符</span>
            <strong>{{ playgroundQuality?.replyChars || 0 }}</strong>
          </div>
          <div class="mini-metric">
            <span>推送分片</span>
            <strong>{{ playgroundQuality?.estimatedPushChunks || 0 }}</strong>
          </div>
          <div class="mini-metric">
            <span>结构化</span>
            <strong>{{ playgroundQuality?.hasActionableStructure ? '是' : '否' }}</strong>
          </div>
        </div>
        <div class="border-t border-slate-100 p-3 dark:border-slate-900">
          <div v-for="suggestion in playgroundSuggestions" :key="suggestion" class="action-row">
            <CheckCircle class="h-4 w-4 shrink-0 text-emerald-500" />
            <p>{{ suggestion }}</p>
          </div>
        </div>
      </div>

      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <FileJson class="h-4 w-4 text-rose-500" />
            <span>回调负载预览</span>
          </div>
        </div>
        <div class="space-y-3 p-3">
          <textarea
            :value="samplePayload"
            class="form-textarea min-h-[8rem] font-mono"
            @input="emit('update:samplePayload', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <button
            type="button"
            class="secondary-btn"
            :disabled="isPayloadPreviewing"
            @click="emit('preview-payload')"
          >
            <RefreshCw v-if="isPayloadPreviewing" class="h-4 w-4 animate-spin" />
            <FileJson v-else class="h-4 w-4" />
            <span>解析负载</span>
          </button>
          <div v-if="payloadPreview" class="payload-result">
            <p><strong>文本：</strong>{{ payloadPreview.incoming.text || '未识别' }}</p>
            <p><strong>发送人：</strong>{{ payloadPreview.incoming.externalUserId || '无' }}</p>
            <p>
              <strong>会话：</strong>{{ payloadPreview.incoming.externalConversationId || '无' }}
            </p>
            <p><strong>触发：</strong>{{ payloadPreview.shouldAnswer ? '会回复' : '会忽略' }}</p>
          </div>
        </div>
      </div>
    </aside>
  </section>
</template>
