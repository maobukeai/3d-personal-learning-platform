<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, reactive, watch, computed } from 'vue';
import { Layout, Eye } from 'lucide-vue-next';
import SafeHtml from '@/components/SafeHtml.vue';

const props = defineProps<{
  settings: {
    EMAIL_VERIFY_SUBJECT: string;
    EMAIL_VERIFY_BODY: string;
  };
}>();

const emit = defineEmits<{
  (e: 'update:settings', val: typeof props.settings): void;
}>();

const localSettings = reactive({ ...props.settings });

watch(
  () => props.settings,
  (newVal) => {
    Object.assign(localSettings, newVal);
  },
  { deep: true }
);

watch(
  localSettings,
  (newVal) => {
    emit('update:settings', { ...props.settings, ...newVal });
  },
  { deep: true }
);

const showEmailPreview = ref(false);

const emailPreviewHtml = computed(() => {
  let html = localSettings.EMAIL_VERIFY_BODY || '';
  html = html.replace(
    /\{\{code\}\}/g,
    '<span style="background:#f4f4f4;padding:8px 16px;font-size:24px;font-weight:bold;letter-spacing:5px;text-align:center;display:inline-block;border-radius:8px;">836425</span>',
  );
  return html;
});
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <section
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <Layout class="w-5 h-5 text-indigo-600" />
          <h2 class="text-lg font-bold" style="color: var(--text-primary)">
            邮箱验证邮件模板
          </h2>
        </div>
        <button type="button" class="text-xs font-bold text-accent px-4 py-2 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors bg-transparent cursor-pointer" @click="showEmailPreview = !showEmailPreview">
          {{ showEmailPreview ? t('admin.close_preview') : $t('admin.preview_message') }}
        </button>
      </div>

      <div class="space-y-6">
        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
            >{{ $t('admin.email_subject_subject') }}</label
          >
          <input
            v-model="localSettings.EMAIL_VERIFY_SUBJECT"
            type="text"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="space-y-2">
          <label
            class="text-xs font-bold px-1 flex justify-between items-center"
            style="color: var(--text-secondary)"
          >
            <span>{{ $t('admin.text_content_html_supported') }}</span>
            <span v-pre class="text-[10px] opacity-60">{{ $t('admin.available_placeholders_code') }}</span>
          </label>
          <textarea
            v-model="localSettings.EMAIL_VERIFY_BODY"
            rows="8"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all resize-none font-mono text-sm"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          ></textarea>
        </div>
      </div>
    </section>

    <section
      v-if="showEmailPreview"
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 mb-6">
        <Eye class="w-5 h-5 text-accent" />
        <h2 class="text-lg font-bold" style="color: var(--text-primary)">{{ $t('admin.email_preview') }}</h2>
      </div>

      <div
        class="rounded-2xl border overflow-hidden"
        style="border-color: var(--border-base)"
      >
        <div
          class="px-6 py-3 border-b flex items-center gap-4"
          style="background-color: var(--bg-app); border-color: var(--border-base)"
        >
          <div class="space-y-1">
            <p class="text-[10px] font-bold" style="color: var(--text-muted)">{{ $t('admin.topic') }}</p>
            <p class="text-xs font-medium" style="color: var(--text-primary)">
              {{ localSettings.EMAIL_VERIFY_SUBJECT }}
            </p>
          </div>
        </div>
        <SafeHtml class="p-6 bg-white" :html="emailPreviewHtml" />
      </div>
    </section>
  </div>
</template>
