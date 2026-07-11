import { ref, type Ref } from 'vue';
import api from '@/utils/api';
import { useTempUpload } from './useTempUpload';
import { logError } from '@/utils/error'; // * * P4：资产大文件前端直传 + Webhook 状态轮询 composable * * 流程： * 1. 前端通过 presigned URL 直传文件到 R2（useTempUpload 负责 5MB 分片/单传） * 2. 后端通过 R2 Event Notification Webhook 感知文件落桶，入队 Draco 压缩 * 3. 前端通过 GET /api/assets/:id/status 兜底轮询（30s 间隔），防 Webhook 丢失
export function useAssetUpload() {
  const { uploadFile: rawUploadFile, cancelUpload } = useTempUpload();
  const progress = ref<number | null>(null);
  const processingStatus = ref<'idle' | 'pending' | 'running' | 'completed' | 'failed'>('idle');
  const hasMetadata = ref(false);
  let pollingTimer: ReturnType<typeof setInterval> | null = null; // * 上传资产文件到 R2（直传，零本地 IO）。成功返回 tempFilePath，失败返回 null。
  const uploadAssetFile = async (
    file: File,
    fieldname?: string,
    onBeforeUpload?: () => string | null | undefined,
  ): Promise<string | null> => {
    let resultPath: string | null = null;
    const onSuccess = (filePath: string) => {
      resultPath = filePath;
    };
    const ok = await rawUploadFile(
      file,
      progress as Ref<number | null>,
      onSuccess,
      onBeforeUpload,
      fieldname,
    );
    return ok && resultPath ? resultPath : null;
  }; // * 单次查询资产处理状态（不轮询）。
  const fetchAssetStatus = async (assetId: string): Promise<void> => {
    try {
      const res = await api.get(`/api/assets/${assetId}/status`);
      processingStatus.value = res.data.processingStatus;
      hasMetadata.value = res.data.hasMetadata;
    } catch (error) {
      logError(error, { operation: 'fetchAssetStatus', assetId });
    }
  }; // * 停止轮询。
  const stopPolling = (): void => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }; // * * 开始 30s 间隔轮询资产处理状态。 * @param assetId 资产 ID * @param onCompleted 可选回调，状态变为 completed/failed 时触发
  const pollAssetStatus = (
    assetId: string,
    onCompleted?: (status: 'completed' | 'failed') => void,
  ): void => {
    stopPolling(); // 立即查询一次 fetchAssetStatus(assetId); pollingTimer =
    setInterval(async () => {
      await fetchAssetStatus(assetId);
      if (processingStatus.value === 'completed' || processingStatus.value === 'failed') {
        stopPolling();
        onCompleted?.(processingStatus.value);
      }
    }, 30_000);
  };
  return {
    progress,
    processingStatus,
    hasMetadata,
    uploadAssetFile,
    cancelUpload,
    pollAssetStatus,
    stopPolling,
    fetchAssetStatus,
  };
}
