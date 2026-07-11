import { type Ref } from 'vue';
import api from '@/utils/api';
import { logError, getApiErrorMessage } from '@/utils/error';
import { ElMessage } from '@/utils/feedbackBridge';
import { useI18n } from 'vue-i18n';
import axios from 'axios';

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
    onBeforeUpload?: () => string | null | undefined,
    fieldname?: string,
  ): Promise<boolean> => {
    const prevPath = onBeforeUpload ? onBeforeUpload() : null;
    if (prevPath) {
      cancelUpload(prevPath);
    }

    progressRef.value = 0;
    const filename = file.name;
    const mimetype = file.type || 'application/octet-stream';
    const size = file.size;

    let activeMultipart: { key: string; uploadId: string } | null = null;

    try {
      // S3 upload threshold (5MB)
      const multipartThreshold = 5 * 1024 * 1024;

      if (size >= multipartThreshold) {
        // 1. S3 Multipart Upload
        const initRes = await api.post('/api/resources/multipart/initiate', {
          filename,
          mimetype,
          size,
          fieldname,
        });

        if (initRes.data.isDirect) {
          const { uploadId, key } = initRes.data;
          activeMultipart = { key, uploadId };

          const chunkSize = 5 * 1024 * 1024;
          const totalChunks = Math.ceil(size / chunkSize);
          const partNumbers = Array.from({ length: totalChunks }, (_, i) => i + 1);

          const partsRes = await api.post('/api/resources/multipart/presign-parts', {
            key,
            uploadId,
            partNumbers,
            fieldname,
          });

          const urls = partsRes.data.urls;
          const loadedParts = new Array(totalChunks).fill(0);
          const completedParts: { ETag: string; PartNumber: number }[] = [];

          const uploadChunk = async (partNum: number) => {
            const start = (partNum - 1) * chunkSize;
            const end = Math.min(start + chunkSize, size);
            const chunk = file.slice(start, end);
            const presignedUrl = urls[partNum];

            const res = await axios.put(presignedUrl, chunk, {
              headers: {
                'Content-Type': mimetype,
              },
              onUploadProgress: (progressEvent) => {
                loadedParts[partNum - 1] = progressEvent.loaded || 0;
                const totalLoaded = loadedParts.reduce((sum, val) => sum + val, 0);
                const percent = Math.min(Math.round((totalLoaded * 100) / size), 99);
                progressRef.value = percent;
              },
            });

            const etag = res.headers.etag || res.headers.ETag || '';
            completedParts.push({
              ETag: etag.replace(/"/g, ''),
              PartNumber: partNum,
            });
          };

          // Limit concurrency to 3 parallel uploads
          const queue = [...partNumbers];
          const workers: Promise<void>[] = [];
          const executeWorker = async () => {
            while (queue.length > 0) {
              const partNum = queue.shift();
              if (partNum !== undefined) {
                await uploadChunk(partNum);
              }
            }
          };

          for (let w = 0; w < Math.min(3, totalChunks); w++) {
            workers.push(executeWorker());
          }
          await Promise.all(workers);

          const completeRes = await api.post('/api/resources/multipart/complete', {
            key,
            uploadId,
            parts: completedParts,
            filename,
            mimetype,
            size,
            fieldname,
          });

          activeMultipart = null;
          progressRef.value = 100;
          onSuccess(completeRes.data.filePath);
          return true;
        }
      } else {
        // 2. S3 Single PUT Upload
        const presignedRes = await api.post('/api/resources/presigned-url', {
          filename,
          mimetype,
          size,
          fieldname,
        });

        if (presignedRes.data.isDirect) {
          const { uploadUrl, key } = presignedRes.data;

          await axios.put(uploadUrl, file, {
            headers: {
              'Content-Type': mimetype,
            },
            onUploadProgress: (progressEvent) => {
              const loaded = progressEvent.loaded || 0;
              if (progressEvent.total) {
                const percent = Math.min(Math.round((loaded * 100) / progressEvent.total), 99);
                progressRef.value = percent;
              }
            },
          });

          const completeRes = await api.post('/api/resources/complete-single', {
            filename,
            key,
            size,
            mimetype,
            fieldname,
          });

          progressRef.value = 100;
          onSuccess(completeRes.data.filePath);
          return true;
        }
      }
    } catch (directUploadError) {
      logError(directUploadError, { operation: 'Direct cloud file upload' });
      if (activeMultipart) {
        try {
          await api.post('/api/resources/multipart/abort', {
            key: activeMultipart.key,
            uploadId: activeMultipart.uploadId,
            fieldname,
          });
        } catch (abortErr) {
          // Silent fail
        }
      }
      console.warn('Direct upload failed or not configured, falling back to standard upload.');
    }

    // 3. Fallback path: Multer upload to backend server
    const formData = new FormData();
    formData.append('temp', file);

    try {
      const response = await api.post('/api/resources/upload-temp', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            progressRef.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          }
        },
      });
      onSuccess(response.data.filePath);
      return true;
    } catch (error) {
      logError(error, { operation: 'Temp file upload fallback' });
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
