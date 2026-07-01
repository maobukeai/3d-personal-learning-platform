import { ref } from 'vue';
import axios from 'axios';
import { logError } from '@/utils/error';
import { downloadFileMultiThreaded } from '@/utils/downloadHelper';

/**
 * Options passed to {@link useMultiThreadDownload} `runDownload`.
 */
export interface DownloadOptions {
  /** Public URL of the file to download. */
  url: string;
  /** Suggested name for the downloaded file. */
  filename: string;
  /** Optional total size in bytes used to drive progress before headers resolve. */
  totalSizeOverrideBytes?: number;
  /** Invoked after a successful download (e.g. record the download on the backend). */
  onSuccess?: () => Promise<void> | void;
  /** Invoked for non-cancellation errors so the caller can show a resource-specific message. */
  onError?: (err: any) => void;
}

/**
 * Shared multi-threaded download state machine.
 *
 * Extracted from the duplicated `isDownloading` / `downloadProgress` /
 * `downloadSpeedStr` / `cancelDownload` / `downloadAbortController` block that
 * previously appeared verbatim in AssetDetailModal, MaterialDetailPanel, and
 * PluginDetailModal.
 *
 * The composable owns the reactive download state, the `AbortController`, and
 * the generic execution flow (cancel previous → set state →
 * `downloadFileMultiThreaded` → handle cancel/error → reset). Resource-specific
 * concerns (URL/filename resolution, backend recording, user-facing error
 * messages) are delegated to the caller via {@link DownloadOptions}.
 *
 * Cancellation errors (`axios.isCancel`, `CanceledError`, `AbortError`,
 * `'canceled'`) are swallowed silently. All other errors are reported through
 * `logError` and forwarded to `onError`.
 *
 * @returns `{ isDownloading, downloadProgress, downloadSpeedStr, cancelDownload, runDownload }`
 *          - `isDownloading`: reactive flag, true while a download is in flight
 *          - `downloadProgress`: reactive 0-100 percent value (starts at 1 for
 *            instant UI feedback)
 *          - `downloadSpeedStr`: reactive human-readable speed string
 *          - `cancelDownload()`: abort the current download and reset state
 *          - `runDownload(options)`: execute a new download, cancelling any
 *            in-flight one first
 */
export function useMultiThreadDownload() {
  const isDownloading = ref(false);
  const downloadProgress = ref(0);
  const downloadSpeedStr = ref('');
  let downloadAbortController: AbortController | null = null;

  const cancelDownload = () => {
    if (downloadAbortController) {
      downloadAbortController.abort();
      downloadAbortController = null;
    }
    isDownloading.value = false;
    downloadProgress.value = 0;
    downloadSpeedStr.value = '';
  };

  const runDownload = async (options: DownloadOptions) => {
    const { url, filename, totalSizeOverrideBytes, onSuccess, onError } = options;

    // Cancel any ongoing download
    cancelDownload();

    isDownloading.value = true;
    downloadProgress.value = 1; // start at 1% for instant UI feedback
    downloadSpeedStr.value = '';
    downloadAbortController = new AbortController();

    try {
      await downloadFileMultiThreaded(
        url,
        filename,
        (percent) => {
          downloadProgress.value = percent;
        },
        (speed) => {
          downloadSpeedStr.value = speed;
        },
        downloadAbortController.signal,
        totalSizeOverrideBytes,
      );

      if (onSuccess) {
        await onSuccess();
      }
    } catch (err: any) {
      if (
        axios.isCancel(err) ||
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.message === 'canceled'
      ) {
        // Silently handle user cancellation
        return;
      }
      logError('Failed to download:', err);
      if (onError) {
        onError(err);
      }
    } finally {
      isDownloading.value = false;
      downloadProgress.value = 0;
      downloadSpeedStr.value = '';
      downloadAbortController = null;
    }
  };

  return { isDownloading, downloadProgress, downloadSpeedStr, cancelDownload, runDownload };
}
