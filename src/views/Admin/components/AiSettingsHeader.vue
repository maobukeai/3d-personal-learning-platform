<script setup lang="ts">
import { Cpu } from 'lucide-vue-next';

const props = defineProps<{
  enabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void;
}>();

const toggle = (value: boolean | string | number) => {
  emit('update:enabled', Boolean(value));
};
</script>

<template>
  <div
    class="relative overflow-hidden rounded-3xl border p-6"
    style="
      background: linear-gradient(135deg, var(--bg-card) 0%, rgba(99, 102, 241, 0.04) 100%);
      border-color: var(--border-base);
    "
  >
    <div class="relative flex items-start justify-between gap-4">
      <div class="flex items-start gap-4">
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style="
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
          "
        >
          <Cpu class="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 class="text-base font-black mb-1" style="color: var(--text-primary)">
            {{ $t('admin.ai_intelligent_assistance_system') }}
          </h2>
          <p class="text-xs leading-relaxed max-w-lg" style="color: var(--text-secondary)">
            启用后，用户可以使用 AI 一键生成项目、AI 写作助手等智能功能。API Key
            仅保存在服务端，不会暴露给前台用户。
          </p>
        </div>
      </div>
      <div class="flex-shrink-0">
        <div class="flex flex-col items-center gap-1.5">
          <Switch
            :model-value="props.enabled"
            inline-prompt
            :active-text="$t('admin.opened')"
            :inactive-text="$t('admin.closed')"
            style="--el-switch-on-color: #6366f1; --el-switch-off-color: #94a3b8"
            @change="toggle"
          />
          <span
            class="text-[10px] font-bold px-2 py-0.5 rounded-full"
            :style="
              props.enabled
                ? 'background: rgba(99,102,241,0.12); color: #6366f1;'
                : 'background: var(--bg-app); color: var(--text-muted);'
            "
          >
            {{ props.enabled ? $t('admin.function_activated') : $t('admin.feature_not_enabled') }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="props.enabled"
      class="mt-4 pt-4 border-t flex flex-wrap gap-2"
      style="border-color: var(--border-base)"
    >
      <span
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
        style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
        >{{ $t('admin.one_click_generation_of') }}</span
      >
      <span
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
        style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
        >{{ $t('admin.ai_writing_assistant') }}</span
      >
      <span
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
        style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
        >{{ $t('admin.model_thinking_flow_display') }}</span
      >
      <span
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
        style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
        >{{ $t('admin.real_time_streaming_output') }}</span
      >
    </div>
  </div>
</template>
