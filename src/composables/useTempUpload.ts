import { type Ref } from 'vue';
import api from '@/utils/api';
import { logError, getApiErrorMessage } from '@/utils/error';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';

export function useTempUpload() {
  const { t } = useI18n();

  const cancelUpload = async (filePath: string) => {
    try {
      await api.post('/api/resources/upload-temp-cancel', { filePath });
    } catch (error) {
      // Silent fail
    }
  };

  const uploadFile = async (
    file: File,
    progressRef: Ref<number | null>,
    onSuccess: (filePath: string) => void,
    onBeforeUpload?: () => string | null | undefined
  ): Promise<boolean> => {
    const prevPath = onBeforeUpload ? onBeforeUpload() : null;
    if (prevPath) {
      cancelUpload(prevPath);
    }

    progressRef.value = 0;

    const formData = new FormData();
    formData.append('temp', file);

    try {
      const response = await api.post('/api/resources/upload-temp', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            progressRef.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          }
        }
      });
      onSuccess(response.data.filePath);
      return true;
    } catch (error) {
      logError(error, { operation: 'Temp file upload' });
      ElMessage.error(t('publishDialog.uploadFailed') || '文件上传失败');
      progressRef.value = null;
      return false;
    }
  };

  return {
    uploadFile,
    cancelUpload,
  };
}
