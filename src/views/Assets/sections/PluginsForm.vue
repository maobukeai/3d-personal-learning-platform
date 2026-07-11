<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref } from 'vue';
import { defineAsyncComponent } from 'vue';
import { toast } from '@/utils/feedbackAdapter';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { useLabel } from '@/utils/i18n';
import { normalizePluginWork, type UnifiedWork } from '../myWorksModel';
import type { EditFormType, PluginItem } from '../pluginsSchema';
import { createDefaultEditForm } from '../pluginsSchema';
import ResourceSearchDialog from '../components/ResourceSearchDialog.vue';
const PublishWorkDialog = defineAsyncComponent(() => import('@/components/PublishWorkDialog.vue'));
const EditWorkDialog = defineAsyncComponent(() => import('../components/EditWorkDialog.vue'));
interface Props {
  isUploadDialogOpen: boolean;
  initialPublishData: any;
  pluginCategories: string[];
  isSearchOpen: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:isUploadDialogOpen', value: boolean): void;
  (e: 'update:isSearchOpen', value: boolean): void;
  (e: 'published'): void;
  (e: 'saved'): void;
}>();
const label = useLabel();
const isEditDialogOpen = ref(false);
const isSaving = ref(false);
const selectedWork = ref<UnifiedWork | null>(null);
const editForm = ref<EditFormType>(createDefaultEditForm());
const openEdit = (plugin: PluginItem) => {
  const work = normalizePluginWork(plugin as any);
  selectedWork.value = work;
  const rawPlugin = work.raw as any;
  const fileUrl = rawPlugin.fileUrl || '';
  const isExternal =
    fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
      ? !fileUrl.includes('/uploads/')
      : false;
  let extUrl = '';
  let extCode = '';
  if (isExternal) {
    const match = fileUrl.match(/(.*?)(?:\s+提取码[:：]\s*(\w+)|提取码[:：]\s*(\w+)|$)/i);
    if (match) {
      extUrl = match[1].trim();
      extCode = (match[2] || match[3] || '').trim();
    } else {
      extUrl = fileUrl.trim();
    }
  }
  editForm.value = {
    ...createDefaultEditForm(),
    title: work.title,
    description: work.description || '',
    tags: work.tags.join(', '),
    pluginCategory: rawPlugin.category || '',
    pluginVersion: rawPlugin.version || '1.0.0',
    pluginCompatibility: rawPlugin.compatibility || '',
    originality: rawPlugin.originality || 'ORIGINAL',
    originalAuthor: rawPlugin.originalAuthor || '',
    originalLink: rawPlugin.originalLink || '',
    license: rawPlugin.license || 'CC_BY',
    isFree: rawPlugin.isFree !== false,
    linkedCourseId: rawPlugin.linkedCourseId || '',
    linkedLessonId: rawPlugin.linkedLessonId || '',
    installGuide: rawPlugin.installGuide || '',
    downloadType: isExternal ? 'external' : 'local',
    externalUrl: extUrl,
    extractionCode: extCode,
  };
  isEditDialogOpen.value = true;
};
const handleSaveEdit = async () => {
  if (!selectedWork.value || !editForm.value.title.trim()) {
    toast.warning(label('请填写作品名称', 'Please fill in the work name'));
    return;
  }
  if (editForm.value.downloadType === 'external' && !editForm.value.externalUrl.trim()) {
    toast.warning('请填写网盘链接或外部下载链接');
    return;
  }
  isSaving.value = true;
  try {
    const work = selectedWork.value;
    const formData = new FormData();
    formData.append('title', editForm.value.title);
    formData.append('description', editForm.value.description);
    formData.append('category', editForm.value.pluginCategory);
    formData.append('version', editForm.value.pluginVersion);
    formData.append('compatibility', editForm.value.pluginCompatibility);
    formData.append('tags', editForm.value.tags);
    formData.append('installGuide', editForm.value.installGuide || '');
    formData.append('originality', editForm.value.originality || 'ORIGINAL');
    formData.append('originalAuthor', editForm.value.originalAuthor || '');
    formData.append('originalLink', editForm.value.originalLink || '');
    formData.append('license', editForm.value.license || 'CC_BY');
    formData.append('isFree', String(editForm.value.isFree !== false));
    formData.append('linkedCourseId', editForm.value.linkedCourseId || '');
    formData.append('linkedLessonId', editForm.value.linkedLessonId || '');
    if (editForm.value.downloadType === 'local') {
      if (editForm.value.tempPluginPath) {
        formData.append('tempPluginPath', editForm.value.tempPluginPath);
      } else if (editForm.value.file) {
        formData.append('plugin_file', editForm.value.file);
      }
    } else {
      let finalUrl = editForm.value.externalUrl.trim();
      if (editForm.value.extractionCode?.trim()) {
        finalUrl += ` 提取码: ${editForm.value.extractionCode.trim()}`;
      }
      formData.append('externalUrl', finalUrl);
    }
    if (editForm.value.tempPreviewPath) {
      formData.append('tempPreviewPath', editForm.value.tempPreviewPath);
    } else if (editForm.value.thumbnail) {
      formData.append('plugin_preview', editForm.value.thumbnail);
    }
    if (editForm.value.fileSize !== undefined) {
      formData.append('fileSize', String(editForm.value.fileSize));
    }
    if (editForm.value.packageFilesList) {
      formData.append('packageFilesList', editForm.value.packageFilesList);
    }
    await api.put(`/api/plugins/${work.id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    toast.success(label('保存成功', 'Saved successfully'));
    isEditDialogOpen.value = false;
    emit('saved');
  } catch (error) {
    toast.error(getApiErrorMessage(error, label('保存失败', 'Save failed')));
  } finally {
    isSaving.value = false;
  }
};
defineExpose({ openEdit });
</script>
<template>
  <PublishWorkDialog
    v-if="isUploadDialogOpen"
    :model-value="isUploadDialogOpen"
    default-category="plugin"
    :initial-data="initialPublishData"
    @update:model-value="emit('update:isUploadDialogOpen', $event)"
    @published="emit('published')"
  />
  <EditWorkDialog
    v-if="isEditDialogOpen"
    v-model:show="isEditDialogOpen"
    v-model:form="editForm"
    :work="selectedWork"
    :is-saving="isSaving"
    :asset-categories="[]"
    :material-categories="[]"
    :plugin-categories="pluginCategories"
    @save="handleSaveEdit"
  />
  <ResourceSearchDialog
    :model-value="isSearchOpen"
    @update:model-value="emit('update:isSearchOpen', $event)"
    @success="emit('published')"
  />
</template>
