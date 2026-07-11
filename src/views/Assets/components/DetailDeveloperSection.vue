<script setup lang="ts">
import {
  Key,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Zap,
  CheckCircle2,
  Activity,
  Edit3,
  Trash2,
  Trash,
  RefreshCw,
} from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import type { FeedbackItem } from '@/composables/useUnifiedDetail';
import type { PluginItem } from './detailTypes';
interface Props {
  plugin: PluginItem;
  canEdit: boolean;
  developerToken: string;
  feedbacks: FeedbackItem[];
  isFeedbacksLoading: boolean;
  isGeneratingToken: boolean;
  blenderIntegrationCode: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'generate-token'): void;
  (e: 'delete-feedback', feedbackId: string): void;
  (e: 'clear-feedbacks'): void;
  (e: 'copy-integration-code'): void;
  (e: 'edit', plugin: PluginItem): void;
}>();
const label = useLabel();
const isBlenderCodeExpanded = defineModel<boolean>('isBlenderCodeExpanded', { required: true });
</script>
<template>
  <div class="flex flex-col gap-6">
    <!-- Dev Integration Tokens -->
    <div class="flex flex-col gap-2.5 p-4 rounded-2xl bg-indigo-600/5 border border-indigo-500/10">
      <h4 class="text-xs font-bold text-indigo-800 dark:text-indigo-400 flex items-center gap-1">
        <Key class="w-3.5 h-3.5" />
        <span>{{ label('Blender 客户端联网 API Token', 'Client Integration API Token') }}</span>
      </h4>
      <p class="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
        {{
          label(
            '在 Blender 插件中调用本站 API 实现自动检查更新和报错日志反馈。请勿泄露您的 Token。',
            'Use this token in your Blender client plugin for update checks and error reporting.',
          )
        }}
      </p>
      <div class="flex gap-2 items-center mt-1">
        <input
          type="text"
          readonly
          :value="
            props.developerToken || label('未生成 Token，点击右侧生成', 'Token not generated yet')
          "
          class="flex-1 px-3 py-2 text-xs font-mono bg-black/20 border border-white/10 rounded-xl text-white outline-none select-all"
        />
        <Button
          variant="primary"
          size="sm"
          :loading="props.isGeneratingToken"
          @click="emit('generate-token')"
        >
          {{
            props.developerToken ? label('重新生成', 'Regenerate') : label('生成 Token', 'Generate')
          }}
        </Button>
      </div>
    </div>
    <!-- Blender Integration Code Guide -->
    <div
      v-if="props.developerToken"
      class="flex flex-col gap-3 p-4 rounded-2xl bg-slate-500/5 dark:bg-white/[0.02] border border-slate-500/15 dark:border-white/10"
    >
      <div
        class="flex items-center justify-between cursor-pointer select-none"
        @click="isBlenderCodeExpanded = !isBlenderCodeExpanded"
      >
        <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <BookOpen class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>{{
            label(
              'Blender 插件集成代码（复制即用）',
              'Blender Addon Integration Code (Ready to Use)',
            )
          }}</span>
          <ChevronDown
            v-if="!isBlenderCodeExpanded"
            class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform"
          />
          <ChevronUp
            v-else
            class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform"
          />
        </h4>
        <button
          v-if="isBlenderCodeExpanded"
          class="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl bg-slate-500/10 dark:bg-white/10 hover:bg-slate-500/20 dark:hover:bg-white/20 border border-slate-500/20 dark:border-white/15 text-slate-800 dark:text-slate-200 font-bold transition-colors cursor-pointer"
          @click.stop="emit('copy-integration-code')"
        >
          <Copy class="w-3 h-3" /> <span>{{ label('复制代码', 'Copy Code') }}</span>
        </button>
      </div>
      <div v-if="isBlenderCodeExpanded" class="flex flex-col gap-3 mt-1">
        <!-- Loop diagram -->
        <div
          class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-black/5 dark:bg-black/25 border border-black/5 dark:border-white/5 text-[10px] font-bold text-slate-800 dark:text-slate-200"
        >
          <span class="flex items-center gap-1"
            ><Zap class="w-3 h-3 text-emerald-500 dark:text-emerald-400" />{{
              label('Blender 插件', 'Blender Addon')
            }}</span
          >
          <span class="text-slate-500 dark:text-slate-400">→</span>
          <span>{{ label('检查更新', 'Check Updates') }}</span>
          <span class="text-slate-500 dark:text-slate-400">→</span>
          <span>{{ label('本平台', 'Platform') }}</span>
          <span class="text-slate-500 dark:text-slate-400">→</span>
          <span>{{ label('下发更新', 'Deliver Update') }}</span>
          <span class="text-slate-500 dark:text-slate-400">→</span>
          <span>{{ label('用户弹窗', 'User Notice') }}</span>
          <span class="text-slate-500 dark:text-slate-400">/</span>
          <span>{{ label('报错', 'Error') }}</span>
          <span class="text-slate-500 dark:text-slate-400">→</span>
          <span>{{ label('日志面板', 'Your Logs') }}</span>
        </div>
        <div class="relative">
          <pre
            class="font-mono text-[10px] text-slate-300 leading-relaxed p-3 rounded-xl bg-black/40 overflow-x-auto whitespace-pre border border-white/5 max-h-[220px] overflow-y-auto custom-scrollbar"
            >{{ props.blenderIntegrationCode }}</pre
          >
        </div>
        <p class="text-[10px] text-slate-800 dark:text-slate-200 font-bold leading-relaxed">
          {{
            label(
              '将上方代码粘贴到您的 Blender 插件 __init__.py 中，注册 register() 函数中调用 check_for_updates()，报错时调用 send_feedback()。',
              'Paste the code into your addon __init__.py. Call check_for_updates() inside register(), and send_feedback() when an exception occurs.',
            )
          }}
        </p>
      </div>
    </div>
    <!-- Current Active Version Status + Edit Entry -->
    <div class="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.01] border border-white/5">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <Zap class="w-3.5 h-3.5 text-teal-400" />
          <span>{{ label('当前主版本', 'Current Active Version') }}</span>
        </h4>
        <Button
          variant="secondary"
          size="sm"
          class="flex items-center gap-1.5"
          @click="emit('edit', props.plugin)"
        >
          <Edit3 class="w-3 h-3" /> <span>{{ label('编辑插件信息', 'Edit Plugin') }}</span>
        </Button>
      </div>
      <div
        class="flex items-center gap-3 px-3 py-3 rounded-xl bg-emerald-600/8 border border-emerald-500/20"
      >
        <div class="flex-1 flex items-center gap-3 min-w-0">
          <span
            class="px-2.5 py-1 rounded-lg text-sm font-extrabold font-mono bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
          >
            v{{ props.plugin.version }}
          </span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-xs font-semibold text-[var(--text-primary)] truncate">{{
              props.plugin.title
            }}</span>
            <span class="text-[10px] text-slate-500 dark:text-slate-300">
              {{
                label(
                  'Blender 客户端检查更新时将收到此版本号及下载地址',
                  'Blender clients receive this version on update check',
                )
              }}
            </span>
          </div>
        </div>
        <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
      </div>
      <p class="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
        {{
          label(
            '如需切换推送版本，请点击「编辑插件信息」修改版本号并重新上传对应文件，保存后将同步至所有 Blender 客户端。',
            'To change the pushed version, click "Edit activePlugin" to update the version number and file, then save. Changes sync to all Blender clients immediately.',
          )
        }}
      </p>
    </div>
    <!-- Client Feedback & Crash Telemetry -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <Activity class="w-3.5 h-3.5 text-rose-500" />
          <span>{{ label('Blender 客户端反馈与报错日志', 'Client Error & Telemetry Logs') }}</span>
        </h4>
        <button
          v-if="props.canEdit && props.feedbacks.length > 0"
          class="text-[10px] font-bold text-rose-500 hover:text-rose-400 cursor-pointer border-0 bg-transparent flex items-center gap-1"
          @click="emit('clear-feedbacks')"
        >
          <Trash2 class="w-3.5 h-3.5" /> <span>{{ label('清空日志', 'Clear Logs') }}</span>
        </button>
      </div>
      <div v-if="props.isFeedbacksLoading" class="flex justify-center py-6">
        <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
      </div>
      <div
        v-else-if="props.feedbacks.length === 0"
        class="text-center py-6 text-xs text-slate-500 dark:text-slate-400 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl font-semibold"
      >
        {{ label('暂无客户端日志反馈。', 'No client reports received yet.') }}
      </div>
      <div v-else class="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scrollbar">
        <div
          v-for="fb in props.feedbacks"
          :key="fb.id"
          class="p-3 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col gap-1.5 text-[11px]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span
                class="px-1.5 py-0.5 rounded text-[8px] font-bold"
                :class="
                  fb.feedbackType === 'BUG'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : fb.feedbackType === 'SUGGESTION'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                "
              >
                {{ fb.feedbackType }}
              </span>
              <span class="text-slate-700 dark:text-slate-200 font-mono"
                >v{{ fb.clientVersion }}</span
              >
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[9px] text-slate-500 dark:text-slate-300 font-mono">{{
                new Date(fb.createdAt).toLocaleString()
              }}</span>
              <button
                v-if="props.canEdit"
                class="text-[9px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer border-0 bg-transparent flex items-center"
                title="删除日志 / Delete entry"
                @click="emit('delete-feedback', fb.id)"
              >
                <Trash class="w-3 h-3" />
              </button>
            </div>
          </div>
          <pre
            class="font-mono text-[10px] text-slate-300 leading-normal p-2 rounded bg-black/30 overflow-x-auto whitespace-pre-wrap break-all border border-white/5"
            >{{ fb.content }}</pre
          >
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 99px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
