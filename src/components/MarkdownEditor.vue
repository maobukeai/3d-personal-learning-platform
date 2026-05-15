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
    autoFocus?: boolean;
    autoHeight?: boolean;
  }>(),
  {
    placeholder: '请输入内容，支持 Markdown 格式...',
    height: '500px',
    previewOnly: false,
    autoFocus: false,
    autoHeight: false,
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
  <div class="markdown-editor-wrapper" :class="{ 'is-dark': isDark, 'h-full': height === '100%' }">
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
      :auto-focus="autoFocus"
      :autoHeight="autoHeight"
      :toolbars-exclude="['github', 'htmlPreview', 'catalog']"
    />
  </div>
</template>

<style>
.markdown-editor-wrapper {
  --md-bk-color: var(--bg-card);
  --md-color: var(--text-primary);
  width: 100%;
}

.markdown-editor-wrapper.h-full {
  display: flex;
  flex-direction: column;
}

.md-preview-custom {
  background: transparent !important;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-primary) !important;
  border: none !important;
}

.md-preview-custom .md-editor-preview-wrapper {
  padding: 0 !important;
  border: none !important;
}

.markdown-editor-wrapper .md-editor {
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--border-base, #e5e7eb) !important;
  background-color: var(--bg-card) !important;
  transition: border-color 0.2s ease;
}

.markdown-editor-wrapper .md-editor:focus-within {
  border-color: var(--accent) !important;
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
  font-size: 15px !important;
  line-height: 1.6 !important;
}

.markdown-editor-wrapper .md-editor-preview {
  background-color: var(--bg-card) !important;
  color: var(--text-primary) !important;
}

/* Scrollbar styling for the editor */
.markdown-editor-wrapper .md-editor-content-wrapper::-webkit-scrollbar {
  width: 6px;
}

.markdown-editor-wrapper .md-editor-content-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.markdown-editor-wrapper .md-editor-content-wrapper::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
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

/* Modern Paper Theme styles */
.markdown-editor-wrapper.modern-paper-theme .md-editor {
  border: none !important;
  background-color: transparent !important;
}

.markdown-editor-wrapper.modern-paper-theme .md-editor-content {
  background-color: transparent !important;
}
</style>

