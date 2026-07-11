<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import Input from '@/components/ui/Input.vue';
import type { UnifiedWork } from '../../myWorksModel';
import type { EditForm } from './types';
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
const form = defineModel<EditForm>('form', { required: true });
defineProps<{ work: UnifiedWork }>();
function emitUpdate(patch: Partial<EditForm>) {
  form.value = { ...form.value, ...patch };
}
const title = computed({ get: () => form.value.title, set: (v) => emitUpdate({ title: v }) });
const tags = computed({ get: () => form.value.tags, set: (v) => emitUpdate({ tags: v }) });
const showcaseType = computed({
  get: () => form.value.showcaseType,
  set: (v) => emitUpdate({ showcaseType: v }),
});
const videoUrl = computed({
  get: () => form.value.videoUrl,
  set: (v) => emitUpdate({ videoUrl: v }),
});
const description = computed({
  get: () => form.value.description,
  set: (v) => emitUpdate({ description: v }),
});
</script>
<template>
  <div class="edit-grid">
    <div class="col-span-2"><Input v-model="title" type="text" label="作品名称" required /></div>
    <template v-if="work.kind === 'showcase'">
      <label class="form-field flex flex-col col-span-2 sm:col-span-1">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >展示类型</span
        >
        <Select v-model="showcaseType" size="large" class="w-full custom-dialog-input">
          <SelectOption value="IMAGE" label="图片作品" />
          <SelectOption value="VIDEO" label="视频作品" />
          <SelectOption value="MODEL" label="模型展示" />
          <SelectOption value="TEXT" label="图文作品" /> <SelectOption value="OTHER" label="其他" />
        </Select>
      </label>
      <div v-if="showcaseType === 'VIDEO'" class="col-span-2 sm:col-span-1">
        <Input v-model="videoUrl" type="text" label="视频链接" />
      </div>
    </template>
    <div class="col-span-2">
      <Input v-model="tags" type="text" label="标签" placeholder="用逗号分隔多个标签" />
    </div>
    <label class="form-field wide editor-field col-span-2">
      <span
        class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
        >作品说明</span
      >
      <MarkdownEditor
        v-model="description"
        height="280px"
        placeholder="描述作品用途、制作说明、安装方式 or 更新内容"
        simple
      />
    </label>
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
.form-field select {
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 0 10px;
  font-size: 12px;
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
@media (max-width: 680px) {
  .edit-grid {
    grid-template-columns: 1fr;
  }
}
</style>
