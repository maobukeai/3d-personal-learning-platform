<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
const MdEditor = defineAsyncComponent(() => import('md-editor-v3/lib/es/MdEditor.mjs'));
const MdPreview = defineAsyncComponent(() => import('md-editor-v3/lib/es/MdPreview.mjs'));
import type { ToolbarNames } from 'md-editor-v3';
import { useI18n } from 'vue-i18n';
import api, { getAssetUrl } from '@/utils/api';
import { ElMessage } from 'element-plus';

const { locale } = useI18n();
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    height?: string;
    previewOnly?: boolean;
    autoFocus?: boolean;
    autoHeight?: boolean;
    preview?: boolean;
    htmlPreview?: boolean;
    uploadUrl?: string;
    uploadField?: string;
  }>(),
  {
    placeholder: '\u8bf7\u8f93\u5165\u5185\u5bb9\uff0c\u652f\u6301 Markdown \u683c\u5f0f...',
    height: '500px',
    previewOnly: false,
    autoFocus: false,
    autoHeight: false,
    preview: true,
    htmlPreview: false,
    uploadUrl: '',
    uploadField: 'file',
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

const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

const toolbars = computed<ToolbarNames[]>(() => {
  if (isMobile.value) {
    return [
      'bold',
      'italic',
      'title',
      'quote',
      'unorderedList',
      'orderedList',
      'code',
      'link',
      'image',
      'table',
      'revoke',
      'next'
    ];
  }
  return [
    'bold',
    'underline',
    'italic',
    '-',
    'strikeThrough',
    'title',
    'sub',
    'sup',
    'quote',
    'unorderedList',
    'orderedList',
    'task',
    '-',
    'codeRow',
    'code',
    'link',
    'image',
    'table',
    'mermaid',
    'katex',
    '-',
    'revoke',
    'next',
    'save'
  ];
});

const isDark = ref(document.documentElement.classList.contains('dark'));
let observer: MutationObserver | null = null;

const handleUploadImg = async (files: FileList, callback: (urls: string[]) => void) => {
  if (!props.uploadUrl) {
    ElMessage.warning('\u5f53\u524d\u7f16\u8f91\u5668\u672a\u914d\u7f6e\u56fe\u7247\u4e0a\u4f20\u670d\u52a1');
    return;
  }

  try {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append(props.uploadField || 'image', file);

      const { data } = await api.post(props.uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (data && data.url) {
        urls.push(data.url);
      } else {
        throw new Error('\u670d\u52a1\u5668\u54cd\u5e94\u4e2d\u672a\u5305\u542b\u6587\u4ef6\u94fe\u63a5');
      }
    }
    callback(urls);
    ElMessage.success('\u56fe\u7247\u4e0a\u4f20\u6210\u529f');
  } catch (e) {
    console.error('Image upload failed:', e);
    ElMessage.error(getApiErrorMessage(e, '\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5'));
  }
};

onMounted(() => {
  import('md-editor-v3/lib/style.css');
  checkMobile();
  window.addEventListener('resize', checkMobile);

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
  window.removeEventListener('resize', checkMobile);
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
      :transform-img-url="getAssetUrl"
      class="md-preview-custom"
    />
    <MdEditor
      v-else
      :id="editorId"
      :key="String(props.preview)"
      v-model="text"
      :placeholder="placeholder"
      :style="{ height }"
      :theme="isDark ? 'dark' : 'light'"
      :language="editorLanguage"
      :preview="props.preview"
      :html-preview="props.htmlPreview"
      :auto-focus="autoFocus"
      :auto-height="autoHeight"
      :toolbars="toolbars"
      :transform-img-url="getAssetUrl"
      @on-upload-img="handleUploadImg"
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

/* Ensure no border/background/shadow in preview-only mode */
.markdown-editor-wrapper .md-editor.md-preview-custom {
  border: none !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

/* Premium image layout constraints across all markdown renders to prevent giant stretching and center them */
.markdown-editor-wrapper img {
  max-width: 90% !important;
  max-height: 55vh !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
  border-radius: 12px !important;
  margin: 24px auto !important;
  display: block !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06) !important;
  border: 1px solid rgba(0, 0, 0, 0.05) !important;
  transition: transform 0.3s ease, box-shadow 0.3s ease !important;
}

.markdown-editor-wrapper img:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1) !important;
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

/* Mobile responsive compact toolbar */
@media (max-width: 767px) {
  .markdown-editor-wrapper .md-editor-toolbar-wrapper {
    padding: 4px 6px !important;
    overflow-x: hidden !important;
  }
  .markdown-editor-wrapper .md-editor-toolbar {
    display: flex !important;
    justify-content: space-between !important;
    flex-wrap: nowrap !important;
    overflow-x: hidden !important;
    width: 100% !important;
  }
  .markdown-editor-wrapper .md-editor-toolbar-item {
    min-width: 26px !important;
    height: 26px !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
  }
  .markdown-editor-wrapper .md-editor-toolbar-item svg {
    width: 14px !important;
    height: 14px !important;
  }
}
</style>
