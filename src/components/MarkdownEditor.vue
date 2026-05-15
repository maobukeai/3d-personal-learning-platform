<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MdEditor, MdPreview } from 'md-editor-v3';
import { useI18n } from 'vue-i18n';
import 'md-editor-v3/lib/style.css';

const { locale } = useI18n();
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    height?: string;
    previewOnly?: boolean;
  }>(),
  {
    placeholder: '请输入内容，支持 Markdown 格式...',
    height: '500px',
    previewOnly: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const text = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val),
});

const editorId = ref(`md-editor-${Date.now()}`);

const editorLanguage = computed(() => {
  return locale.value === 'zh-CN' ? 'zh-CN' : 'en-US';
});

const isDark = ref(document.documentElement.classList.contains('dark'));
let observer: MutationObserver | null = null;

onMounted(() => {
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        isDark.value = document.documentElement.classList.contains('dark');
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});
</script>

<template>
  <div class="markdown-editor-wrapper" :class="{ 'is-dark': isDark }">
    <MdPreview
      v-if="previewOnly"
      :id="editorId"
      :model-value="modelValue"
      :theme="isDark ? 'dark' : 'light'"
      class="md-preview-custom"
    />
    <MdEditor
      v-else
      :id="editorId"
      v-model="text"
      :placeholder="placeholder"
      :style="{ height }"
      :theme="isDark ? 'dark' : 'light'"
      :language="editorLanguage"
      :preview="true"
      :toolbars-exclude="['github', 'htmlPreview', 'catalog']"
    />
  </div>
</template>

<style>
.markdown-editor-wrapper {
  --md-bk-color: var(--bg-card);
  --md-color: var(--text-primary);
}

.md-preview-custom {
  background: transparent !important;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary) !important;
  border: none !important;
}

.md-preview-custom .md-editor-preview-wrapper {
  padding: 0 !important;
  border: none !important;
}

.markdown-editor-wrapper .md-editor {
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid var(--border-base, #e5e7eb) !important;
  background-color: var(--bg-card) !important;
}

.markdown-editor-wrapper .md-editor-toolbar-wrapper {
  background-color: var(--bg-card) !important;
  border-bottom: 1px solid var(--border-base) !important;
}

.markdown-editor-wrapper .md-editor-content {
  background-color: var(--bg-card) !important;
}

.markdown-editor-wrapper .md-editor-input {
  background-color: var(--bg-app) !important;
  color: var(--text-primary) !important;
  font-size: 14px !important;
}

.markdown-editor-wrapper .md-editor-preview {
  background-color: var(--bg-card) !important;
  color: var(--text-primary) !important;
}

/* Dark mode specific adjustments */
.markdown-editor-wrapper.is-dark .md-editor {
  --md-bk-color: var(--bg-card);
}

.markdown-editor-wrapper.is-dark .md-editor-toolbar-item svg {
  fill: var(--text-secondary);
}

.markdown-editor-wrapper.is-dark .md-editor-toolbar-item:hover svg {
  fill: var(--accent);
}
</style>
