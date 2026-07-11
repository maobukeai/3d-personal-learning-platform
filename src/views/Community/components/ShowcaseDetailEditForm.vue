<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { RefreshCw, Save } from 'lucide-vue-next';
import type { ShowcaseType } from './showcaseTypes';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
interface ApprovedResource {
  id: string;
  title: string;
}
interface EditFormData {
  title: string;
  description: string;
  tags: string;
  type: ShowcaseType;
  videoUrl: string;
  isVideo: boolean;
  linkedAssetIds: string[];
  linkedMaterialIds: string[];
  linkedPluginIds: string[];
}
interface StatusMeta {
  label: string;
  tone: string;
  hint: string;
}
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
defineProps<{
  myApprovedAssets: ApprovedResource[];
  myApprovedMaterials: ApprovedResource[];
  myApprovedPlugins: ApprovedResource[];
  editThumbnail: File | null;
  editImages: File[];
  isSaving: boolean;
  detailStatusMeta: StatusMeta;
}>();
const editForm = defineModel<EditFormData>('editForm', { required: true });
defineEmits<{
  (e: 'save'): void;
  (e: 'cancel'): void;
  (e: 'thumbnail-change', event: Event): void;
  (e: 'images-change', event: Event): void;
}>();
</script>
<template>
  <div class="lg:col-span-12">
    <div class="detail-edit-form bg-white/[0.01] p-5 rounded-2xl border border-white/5">
      <label>
        <span>标题</span> <input v-model="editForm.title" type="text" placeholder="作品标题" />
      </label>
      <label>
        <span>标签</span>
        <input v-model="editForm.tags" type="text" placeholder="Render, Cycles, Retro" />
      </label>
      <label>
        <span>嵌入已发布3D模型</span>
        <Select
          v-model="editForm.linkedAssetIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择想展示在帖子里的已发布3D模型(可多选)"
          class="w-full custom-select-v2 mt-1"
        >
          <SelectOption
            v-for="asset in myApprovedAssets"
            :key="asset.id"
            :label="asset.title"
            :value="asset.id"
          />
        </Select>
      </label>
      <label class="mt-2 block">
        <span>嵌入已发布材质</span>
        <Select
          v-model="editForm.linkedMaterialIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择想展示在帖子里的已发布材质(可多选)"
          class="w-full custom-select-v2 mt-1"
        >
          <SelectOption
            v-for="mat in myApprovedMaterials"
            :key="mat.id"
            :label="mat.title"
            :value="mat.id"
          />
        </Select>
      </label>
      <label class="mt-2 block">
        <span>嵌入已发布插件</span>
        <Select
          v-model="editForm.linkedPluginIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择想展示在帖子里的已发布插件(可多选)"
          class="w-full custom-select-v2 mt-1"
        >
          <SelectOption
            v-for="plugin in myApprovedPlugins"
            :key="plugin.id"
            :label="plugin.title"
            :value="plugin.id"
          />
        </Select>
      </label>
      <label>
        <span>作品说明</span>
        <MarkdownEditor v-model="editForm.description" height="240px" simple />
      </label>
      <div class="detail-file-row mobile-row">
        <label>
          <span>替换封面</span>
          <input type="file" accept="image/*" @change="$emit('thumbnail-change', $event)" />
          <small>{{ editThumbnail?.name || '保持当前封面' }}</small>
        </label>
        <label>
          <span>补充图集</span>
          <input type="file" accept="image/*" multiple @change="$emit('images-change', $event)" />
          <small>{{
            editImages.length ? `已选择 ${editImages.length} 张` : '可一次追加多张'
          }}</small>
        </label>
      </div>
      <div class="detail-edit-actions mobile-row">
        <button type="button" class="primary" :disabled="isSaving" @click="$emit('save')">
          <RefreshCw v-if="isSaving" class="w-4 h-4 animate-spin" /> <Save v-else class="w-4 h-4" />
          {{ isSaving ? '保存中' : '保存修改' }}
        </button>
        <button type="button" @click="$emit('cancel')">取消</button>
      </div>
      <p class="detail-status-hint">{{ detailStatusMeta.hint }}</p>
    </div>
  </div>
</template>
<style scoped>
.detail-edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}
.detail-edit-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-edit-form label span {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}
.detail-edit-form input[type='text'] {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}
.detail-edit-form input[type='text']:focus {
  border-color: #6366f1;
  background: rgba(255, 255, 255, 0.05);
}
</style>
