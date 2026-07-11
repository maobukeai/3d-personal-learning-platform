<script setup lang="ts">
import { type Component } from 'vue';
import { Clock, Eye, EyeOff, FileCheck2, Send, Sparkles, Trash2 } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Modal from '@/components/ui/Modal.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';

interface QuickAction {
  label: string;
  meta: string;
  route: string;
  icon: Component;
  tone: string;
}

interface BroadcastForm {
  title: string;
  content: string;
  link: string;
}

interface BroadcastHistoryItem {
  id: string;
  title: string;
  content: string;
  link?: string | null;
  createdAt: string;
  isOffline?: boolean;
}

interface Props {
  quickActions: QuickAction[];
  showBroadcastModal: boolean;
  broadcastTab: 'send' | 'history';
  isBroadcasting: boolean;
  isHistoryLoading: boolean;
  broadcastHistory: BroadcastHistoryItem[];
  broadcastForm: BroadcastForm;
  aiPrompt: string;
  isAiGenerating: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits([
  'openQuickAction',
  'update:showBroadcastModal',
  'update:broadcastTab',
  'update:broadcastForm',
  'update:aiPrompt',
  'aiGenerate',
  'sendBroadcast',
  'deleteBroadcast',
  'toggleBroadcastOffline',
]);

const updateForm = (patch: Partial<BroadcastForm>) => {
  emit('update:broadcastForm', { ...props.broadcastForm, ...patch });
};
</script>

<template>
  <div class="space-y-3">
    <!-- Horizontal Operations Quick Launch Panel -->
    <Card padding="sm">
      <template #header>
        <div class="flex items-center gap-2">
          <FileCheck2 class="h-4 w-4 text-[var(--accent)]" />
          <h2 class="panel-title text-xs font-bold text-[var(--text-primary)]">常用运营工具</h2>
        </div>
      </template>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mobile-grid">
        <button
          v-for="action in quickActions"
          :key="action.label"
          type="button"
          class="group border border-base rounded-lg p-2 flex items-center gap-2.5 bg-subtle text-left transition-all hover:border-[var(--accent)] hover:bg-hover cursor-pointer"
          @click="emit('openQuickAction', action)"
        >
          <span
            :class="action.tone"
            class="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg transition-transform group-hover:scale-105"
          >
            <component :is="action.icon" class="h-3.5 w-3.5" />
          </span>
          <div class="min-w-0 flex-1">
            <span
              class="group-hover:text-[var(--accent)] transition-colors text-[11px] font-black block truncate text-[var(--text-primary)]"
            >
              {{ action.label }}
            </span>
            <span class="text-[9px] text-slate-400 block truncate mt-0.5">{{ action.meta }}</span>
          </div>
        </button>
      </div>
    </Card>

    <Modal
      :show="showBroadcastModal"
      title="全站广播"
      size="lg"
      @close="emit('update:showBroadcastModal', false)"
    >
      <div class="space-y-4">
        <p class="text-xs text-[var(--text-secondary)] -mt-2">
          向所有用户发送系统通知，重要活动和维护公告都从这里发布。
        </p>

        <SegmentedControl
          :model-value="broadcastTab"
          :options="[
            { value: 'send', label: '发布广播', icon: Send },
            { value: 'history', label: '历史记录', icon: Clock },
          ]"
          full-width
          @update:model-value="emit('update:broadcastTab', $event as 'send' | 'history')"
        />

        <div v-if="broadcastTab === 'send'" class="space-y-3.5">
          <!-- AI Generator Assistant -->
          <div
            class="p-3.5 rounded-2xl border border-base bg-accent/5 dark:bg-accent/10 space-y-2.5"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-[11px] font-black text-accent flex items-center gap-1.5 uppercase tracking-wider"
              >
                <Sparkles class="w-3.5 h-3.5 animate-pulse text-accent" /> AI 辅助生成公告
              </span>
              <span class="text-[10px] text-slate-400 dark:text-slate-500"
                >输入大致需求即可一键排版</span
              >
            </div>
            <div class="flex gap-2">
              <input
                :value="aiPrompt"
                type="text"
                placeholder="例如：下周六凌晨2-4点进行系统维护，期间无法登录"
                class="flex-1 px-3 py-2 text-xs rounded-xl border border-base bg-card text-[var(--text-primary)] focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                :disabled="isAiGenerating"
                @input="emit('update:aiPrompt', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('aiGenerate')"
              />
              <Button
                variant="primary"
                size="sm"
                class="shrink-0 text-xs py-2 rounded-xl"
                :loading="isAiGenerating"
                @click="emit('aiGenerate')"
              >
                生成
              </Button>
            </div>
          </div>
          <Input
            :model-value="broadcastForm.title"
            label="标题"
            placeholder="例如：端午活动上线通知"
            required
            @update:model-value="updateForm({ title: $event })"
          />

          <div class="space-y-1.5">
            <label class="field-label text-xs font-bold text-[var(--text-secondary)] ml-1 uppercase"
              >内容 <span class="text-red-500">*</span></label
            >
            <textarea
              :value="broadcastForm.content"
              class="w-full text-sm font-medium rounded-xl border border-base bg-card text-[var(--text-primary)] focus:border-accent focus:ring-2 focus:ring-accent/20 p-3 outline-none resize-none transition-all duration-300"
              rows="10"
              placeholder="写清楚影响范围、操作指引 and 跳转入口"
              @input="updateForm({ content: ($event.target as HTMLTextAreaElement).value })"
            ></textarea>
          </div>

          <Input
            :model-value="broadcastForm.link"
            label="跳转链接"
            placeholder="/academy 或 https://..."
            @update:model-value="updateForm({ link: $event })"
          />

          <Button
            variant="primary"
            full-width
            class="justify-center"
            :loading="isBroadcasting"
            :icon="Send"
            @click="emit('sendBroadcast')"
          >
            {{ isBroadcasting ? '发送中' : '立即发布' }}
          </Button>
        </div>

        <div v-else class="max-h-[460px] space-y-2 overflow-y-auto pr-1">
          <div
            v-if="isHistoryLoading"
            class="empty-line py-6 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
          >
            正在加载广播历史...
          </div>
          <article
            v-for="broadcast in broadcastHistory"
            v-else
            :key="broadcast.id"
            class="broadcast-row flex items-start justify-between gap-3 p-3 border border-base bg-subtle/30 rounded-xl transition-all duration-200"
            :class="broadcast.isOffline ? 'opacity-65 bg-subtle/10' : ''"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span
                  v-if="broadcast.isOffline"
                  class="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 shrink-0"
                >
                  已下架
                </span>
                <span
                  v-else
                  class="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0"
                >
                  展示中
                </span>
                <p class="truncate text-xs font-black text-[var(--text-primary)]">
                  {{ broadcast.title }}
                </p>
              </div>
              <p class="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                {{ broadcast.content }}
              </p>
              <small class="block text-[10px] text-slate-400 mt-1.5"
                >{{ new Date(broadcast.createdAt).toLocaleString('zh-CN') }}
                <span v-if="broadcast.link">· {{ broadcast.link }}</span></small
              >
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <Button
                :variant="broadcast.isOffline ? 'secondary' : 'outline'"
                size="sm"
                class="h-8 w-8 !p-0"
                :title="broadcast.isOffline ? '发布公告' : '下架公告'"
                :icon="broadcast.isOffline ? Eye : EyeOff"
                @click="emit('toggleBroadcastOffline', broadcast.id)"
              />
              <Button
                variant="danger"
                size="sm"
                class="h-8 w-8 !p-0"
                title="撤回广播"
                :icon="Trash2"
                @click="emit('deleteBroadcast', broadcast.id)"
              />
            </div>
          </article>
          <div
            v-if="!isHistoryLoading && broadcastHistory.length === 0"
            class="empty-line py-6 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
          >
            暂无广播记录
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>
