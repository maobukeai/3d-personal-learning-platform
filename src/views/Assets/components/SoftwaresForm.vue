<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineAsyncComponent, ref } from 'vue';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { toast } from '@/utils/feedbackAdapter';
import { useLabel } from '@/utils/i18n';
import { normalizeSoftwareWork } from '../myWorksModel';
import type { UnifiedWork } from '../myWorksModel';
import { createDefaultEditForm, type EditFormType } from '../softwaresSchema';
const PublishWorkDialog = defineAsyncComponent(() => import('@/components/PublishWorkDialog.vue'));
const EditWorkDialog = defineAsyncComponent(() => import('./EditWorkDialog.vue'));
defineProps<{ isUploadDialogOpen: boolean; initialPublishData: any; pluginCategories: string[] }>();
const emit = defineEmits<{
  (e: 'update:isUploadDialogOpen', value: boolean): void;
  (e: 'published'): void;
  (e: 'saved'): void;
}>();
const label =
  useLabel(); /* ------------------------------------------------------------------ * * Edit dialog state + handlers (owned here, triggered via openEdit) * ------------------------------------------------------------------ */
const isEditDialogOpen = ref(false);
const isSaving = ref(false);
const selectedWork = ref<UnifiedWork | null>(null);
const editForm =
  ref<EditFormType>(
    createDefaultEditForm(),
  ); /** Populate the edit form from a software item and open the EditWorkDialog. * Called by the container when the detail modal emits `@edit`. */
const openEdit = (software: any) => {
  const work = normalizeSoftwareWork(software);
  selectedWork.value = work;
  const rawSoftware = work.raw as any;
  const fileUrl = rawSoftware.fileUrl || '';
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
    pluginCategory: rawSoftware.category || '',
    pluginVersion: rawSoftware.version || '1.0.0',
    pluginCompatibility: rawSoftware.compatibility || '',
    originality: rawSoftware.originality || 'ORIGINAL',
    originalAuthor: rawSoftware.originalAuthor || '',
    originalLink: rawSoftware.originalLink || '',
    license: rawSoftware.license || 'CC_BY',
    isFree: rawSoftware.isFree !== false,
    linkedCourseId: rawSoftware.linkedCourseId || '',
    linkedLessonId: rawSoftware.linkedLessonId || '',
    installGuide: rawSoftware.installGuide || '',
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
    toast.warning(
      label(
        '请填写网盘链接或外部下载链接',
        'Please enter a cloud drive link or external download URL',
      ),
    );
    return;
  }
  isSaving.value = true;
  try {
    const work = selectedWork.value;
    const formData = new FormData();
    const f = editForm.value;
    formData.append('title', f.title);
    formData.append('description', f.description);
    formData.append('category', f.pluginCategory);
    formData.append('version', f.pluginVersion);
    formData.append('compatibility', f.pluginCompatibility);
    formData.append('tags', f.tags);
    formData.append('installGuide', f.installGuide || '');
    formData.append('originality', f.originality || 'ORIGINAL');
    formData.append('originalAuthor', f.originalAuthor || '');
    formData.append('originalLink', f.originalLink || '');
    formData.append('license', f.license || 'CC_BY');
    formData.append('isFree', String(f.isFree !== false));
    formData.append('linkedCourseId', f.linkedCourseId || '');
    formData.append('linkedLessonId', f.linkedLessonId || '');
    if (f.downloadType === 'local') {
      if (f.tempSoftwarePath) formData.append('tempSoftwarePath', f.tempSoftwarePath);
      else if (f.file) formData.append('plugin_file', f.file);
    } else {
      let finalUrl = f.externalUrl.trim();
      if (f.extractionCode?.trim()) finalUrl += ` 提取码: ${f.extractionCode.trim()}`;
      formData.append('externalUrl', finalUrl);
    }
    if (f.tempPreviewPath) formData.append('tempPreviewPath', f.tempPreviewPath);
    else if (f.thumbnail) formData.append('plugin_preview', f.thumbnail);
    if (f.fileSize !== undefined) formData.append('fileSize', String(f.fileSize));
    if (f.packageFilesList) formData.append('packageFilesList', f.packageFilesList);
    await api.put(`/api/softwares/${work.id}`, formData, {
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
  <!-- Create / publish dialog -->
  <PublishWorkDialog
    v-if="isUploadDialogOpen"
    :model-value="isUploadDialogOpen"
    default-category="software"
    :initial-data="initialPublishData"
    @update:model-value="emit('update:isUploadDialogOpen', $event)"
    @published="emit('published')"
  />
  <!-- Edit dialog -->
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
</template>
