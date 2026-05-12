<script setup lang="ts">
import { ref, computed } from 'vue'
import { MdEditor, MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  height?: string
  previewOnly?: boolean
}>(), {
  placeholder: '请输入内容，支持 Markdown 格式...',
  height: '400px',
  previewOnly: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const text = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val)
})

const editorId = ref(`md-editor-${Date.now()}`)
</script>

<template>
  <div class="markdown-editor-wrapper">
    <MdPreview
      v-if="previewOnly"
      :id="editorId"
      :model-value="modelValue"
      class="md-preview-custom"
    />
    <MdEditor
      v-else
      v-model="text"
      :id="editorId"
      :placeholder="placeholder"
      :style="{ height }"
      language="zh-CN"
      :preview="true"
      :toolbarsExclude="['github', 'htmlPreview', 'catalog']"
    />
  </div>
</template>

<style>
.md-preview-custom {
  background: transparent !important;
  font-size: 14px;
  line-height: 1.8;
}

.md-preview-custom .md-editor-preview-wrapper {
  padding: 0 !important;
}

.markdown-editor-wrapper .md-editor {
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid var(--border-base, #e5e7eb);
}

.markdown-editor-wrapper .md-editor--dark {
  --md-bk-color: var(--bg-app, #1e1e1e);
}

.markdown-editor-wrapper .md-editor-toolbar-wrapper {
  background-color: var(--bg-card, #fff) !important;
}

.markdown-editor-wrapper .md-editor-content {
  background-color: var(--bg-card, #fff) !important;
}

.markdown-editor-wrapper .md-editor-input {
  background-color: var(--bg-app, #f9fafb) !important;
  color: var(--text-primary, #111827) !important;
  font-size: 14px !important;
}

.markdown-editor-wrapper .md-editor-preview {
  background-color: var(--bg-card, #fff) !important;
  color: var(--text-primary, #111827) !important;
}
</style>
