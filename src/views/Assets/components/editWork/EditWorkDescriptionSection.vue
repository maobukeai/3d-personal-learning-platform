<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useLabel } from '@/utils/i18n';
import type { WorkKind } from '../../myWorksModel';
import type { EditForm } from './types';
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
const form = defineModel<EditForm>('form', { required: true });
defineProps<{ workKind: WorkKind }>();
const label = useLabel();
function emitUpdate(patch: Partial<EditForm>) {
  form.value = { ...form.value, ...patch };
}
const description = computed({
  get: () => form.value.description,
  set: (v) => emitUpdate({ description: v }),
});
</script>
<template>
  <div>
    <div class="form-field editor-field text-left">
      <span
        class="block text-xs font-bold uppercase tracking-wider mb-1 ml-1 text-[var(--text-secondary)]"
      >
        {{ label('作品说明', 'Asset Description') }}
      </span>
      <MarkdownEditor
        v-model="description"
        placeholder="描述作品用途、制作说明、安装方式或更新内容"
        :height="workKind === 'plugin' || workKind === 'software' ? '400px' : '340px'"
        simple
      />
    </div>
  </div>
</template>
<style scoped>
.form-field {
  position: relative;
  display: grid;
  gap: 4px;
}
.form-field > span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}
.editor-field {
  width: 100%;
  min-width: 0;
}
.editor-field :deep(.md-editor-toolbar) {
  flex-wrap: wrap;
}
.editor-field :deep(.md-editor-toolbar-wrapper) {
  height: auto;
}
.editor-field :deep(.mdw),
.editor-field :deep(.md-editor) {
  width: 100%;
  min-width: 0;
}
</style>
