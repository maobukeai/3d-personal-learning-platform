import { ref, computed } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

export type PublishCategory = 'asset' | 'material' | 'plugin' | 'software';

export interface PublishFormData {
  title: string;
  description: string;
  tags: string;
  downloadType: 'local' | 'external';
  externalUrl: string;
  extractionCode: string;
  assetCategory: string;
  materialCategory: string;
  pluginCategory: string;
  pluginVersion: string;
  pluginCompatibility: string;
  pluginInstallGuide: string;
  bilibiliUrl: string;
  resolution: string;
  isProcedural: boolean;
  file: File | null;
  thumbnail: File | null;
}

export function usePublishWork(onPublished?: () => void) {
  const isPublishing = ref(false);
  const publishCategory = ref<PublishCategory>('asset');
  const assetCategories = ref<{ id: string; name: string }[]>([]);

  const formData = ref<PublishFormData>({
    title: '',
    description: '',
    tags: '',
    downloadType: 'local',
    externalUrl: '',
    extractionCode: '',
    assetCategory: '',
    materialCategory: '通用',
    pluginCategory: '插件',
    pluginVersion: '1.0.0',
    pluginCompatibility: 'Blender 4.x',
    pluginInstallGuide: '',
    bilibiliUrl: '',
    resolution: '4K',
    isProcedural: false,
    file: null,
    thumbnail: null,
  });

  const fetchAssetCategories = async () => {
    try {
      const res = await api.get<{ id: string; name: string }[]>('/api/admin/asset-categories');
      assetCategories.value = res.data;
      if (res.data.length > 0 && !formData.value.assetCategory) {
        formData.value.assetCategory = res.data[0].id;
      }
    } catch {
      /* non-critical */
    }
  };

  const validateForm = (): boolean => {
    if (!formData.value.title.trim()) {
      ElMessage.warning('请输入标题');
      return false;
    }
    if (formData.value.downloadType === 'external' && !formData.value.externalUrl.trim()) {
      ElMessage.warning('请输入网盘/外链下载地址');
      return false;
    }
    return true;
  };

  const submitPublish = async (emitClose: () => void) => {
    if (!validateForm()) return;
    isPublishing.value = true;
    try {
      const payload = new FormData();
      payload.append('title', formData.value.title.trim());
      payload.append('description', formData.value.description);
      payload.append('tags', formData.value.tags);
      payload.append('downloadType', formData.value.downloadType);

      if (formData.value.downloadType === 'external') {
        payload.append('externalUrl', formData.value.externalUrl);
        payload.append('extractionCode', formData.value.extractionCode);
      }

      if (formData.value.file) {
        payload.append('file', formData.value.file);
      }
      if (formData.value.thumbnail) {
        payload.append('thumbnail', formData.value.thumbnail);
      }

      let endpoint = '/api/assets';
      if (publishCategory.value === 'material') endpoint = '/api/materials';
      if (publishCategory.value === 'plugin' || publishCategory.value === 'software')
        endpoint = '/api/plugins';

      await api.post(endpoint, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      ElMessage.success('发布提交成功！已进入队列或审核中');
      emitClose();
      if (onPublished) onPublished();
    } catch (err) {
      ElMessage.error(getApiErrorMessage(err, '发布失败'));
    } finally {
      isPublishing.value = false;
    }
  };

  return {
    isPublishing,
    publishCategory,
    assetCategories,
    formData,
    fetchAssetCategories,
    validateForm,
    submitPublish,
  };
}
