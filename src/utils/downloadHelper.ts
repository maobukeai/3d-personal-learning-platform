import axios from 'axios';
import api from '@/utils/api';
import { logError } from '@/utils/error';

/**
 * Downloads a file in parallel using HTTP Range requests if supported,
 * and falls back to a standard browser download if ranges are not supported or if the download fails.
 *
 * @param url The public URL of the file to download
 * @param filename The suggested name for the downloaded file
 * @param onProgress Optional callback to receive real-time progress percentage (0-100)
 */
export async function downloadFileMultiThreaded(
  url: string,
  filename: string,
  onProgress?: (percent: number) => void,
  onSpeed?: (speed: string) => void,
  signal?: AbortSignal,
  totalSizeOverride?: number,
): Promise<void> {
  let totalSize = totalSizeOverride || 0;
  let useMultiThread = false;

  const isSameOrigin =
    url.startsWith('/') ||
    (api.defaults.baseURL && url.startsWith(api.defaults.baseURL)) ||
    url.includes(window.location.host);

  try {
    // 1. Perform HEAD request to query content length and range support.
    // Some endpoints may require CORS settings to expose Content-Length and Accept-Ranges.
    let contentLength: string | undefined;
    let acceptRanges: string | undefined;

    try {
      const headRes = await axios.head(url, {
        signal,
        ...(isSameOrigin ? { withCredentials: true } : {}),
      });
      const lenVal = headRes.headers['content-length'];
      contentLength = lenVal ? String(lenVal) : undefined;
      const rangeVal = headRes.headers['accept-ranges'];
      acceptRanges = rangeVal ? String(rangeVal) : undefined;
      if (contentLength) {
        totalSize = parseInt(contentLength, 10);
      }
    } catch (e) {
      logError(e, { operation: 'downloadHelper.headProbe', component: 'DownloadHelper' });
    }

    // 2. Probe a 1-byte range request to verify the server actually returns 206.
    // This catches cases where CORS or CDN silently downgrades range requests to 200.
    if (acceptRanges !== 'none') {
      try {
        const probeRes = await axios.get(url, {
          headers: { Range: 'bytes=0-0' },
          responseType: 'arraybuffer',
          signal,
          ...(isSameOrigin ? { withCredentials: true } : {}),
        });
        if (probeRes.status === 206) {
          useMultiThread = true;
          // If we didn't get total size from HEAD, check Content-Range header from probe
          // e.g. Content-Range: bytes 0-0/123456
          const contentRange = probeRes.headers['content-range'];
          if (contentRange && !totalSize) {
            const parts = contentRange.split('/');
            if (parts.length > 1) {
              totalSize = parseInt(parts[1], 10);
            }
          }
        }
      } catch (e) {
        logError(e, { operation: 'downloadHelper.rangeProbe', component: 'DownloadHelper' });
      }
    }

    // If the file is small (e.g., < 5MB), download it in a single stream to avoid overhead
    if (useMultiThread && totalSize > 0 && totalSize < 5 * 1024 * 1024) {
      useMultiThread = false;
    }

    if (useMultiThread && totalSize > 0) {
      // 3. Set up parallel range request download (6 chunks in parallel)
      const threads = 6;
      const chunkSize = Math.ceil(totalSize / threads);
      const promises: Promise<ArrayBuffer>[] = [];
      const loadedBytes = new Array(threads).fill(0);

      let lastLoaded = 0;
      let lastTime = Date.now();

      const updateProgress = () => {
        const totalLoaded = loadedBytes.reduce((sum, val) => sum + val, 0);
        const percent = Math.min(Math.round((totalLoaded / totalSize) * 100), 100);
        if (onProgress) {
          onProgress(percent);
        }

        // Calculate speed
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.5) {
          const bytesTransferred = totalLoaded - lastLoaded;
          const speedBytesPerSec = bytesTransferred / elapsed;
          let speedStr: string;
          if (speedBytesPerSec > 1024 * 1024) {
            speedStr = `${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
          } else if (speedBytesPerSec > 1024) {
            speedStr = `${(speedBytesPerSec / 1024).toFixed(0)} KB/s`;
          } else {
            speedStr = `${speedBytesPerSec.toFixed(0)} B/s`;
          }
          if (onSpeed) {
            onSpeed(speedStr);
          }
          lastLoaded = totalLoaded;
          lastTime = now;
        }
      };

      for (let i = 0; i < threads; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize - 1, totalSize - 1);

        const promise = axios
          .get(url, {
            responseType: 'arraybuffer',
            headers: {
              Range: `bytes=${start}-${end}`,
            },
            signal,
            ...(isSameOrigin ? { withCredentials: true } : {}),
            onDownloadProgress: (progressEvent) => {
              loadedBytes[i] = progressEvent.loaded || 0;
              updateProgress();
            },
          })
          .then((res) => res.data);

        promises.push(promise);
      }

      // Wait for all range requests to resolve
      const chunks = await Promise.all(promises);

      // Reassemble the file chunks into a single Blob
      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);

      // Trigger download of the local blob
      triggerBrowserDownload(blobUrl, filename);

      // Revoke blob URL after 5 minutes to free up memory
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 300000);
    } else {
      // 4. Single-stream GET download with progress tracking
      let lastLoaded = 0;
      let lastTime = Date.now();

      const response = await axios.get(url, {
        responseType: 'blob',
        signal,
        ...(isSameOrigin ? { withCredentials: true } : {}),
        onDownloadProgress: (progressEvent) => {
          const loaded = progressEvent.loaded || 0;
          const total = progressEvent.total || totalSize;

          if (total > 0) {
            const percent = Math.min(Math.round((loaded / total) * 100), 100);
            if (onProgress) {
              onProgress(percent);
            }
          }

          // Calculate speed
          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          if (elapsed >= 0.5) {
            const bytesTransferred = loaded - lastLoaded;
            const speedBytesPerSec = bytesTransferred / elapsed;
            let speedStr: string;
            if (speedBytesPerSec > 1024 * 1024) {
              speedStr = `${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
            } else if (speedBytesPerSec > 1024) {
              speedStr = `${(speedBytesPerSec / 1024).toFixed(0)} KB/s`;
            } else {
              speedStr = `${speedBytesPerSec.toFixed(0)} B/s`;
            }
            if (onSpeed) {
              onSpeed(speedStr);
            }
            lastLoaded = loaded;
            lastTime = now;
          }
        },
      });

      const blob = response.data;
      const blobUrl = URL.createObjectURL(blob);
      triggerBrowserDownload(blobUrl, filename);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 300000);
    }
  } catch (error) {
    if (
      axios.isCancel(error) ||
      (error instanceof Error && (error.name === 'CanceledError' || error.message === 'canceled'))
    ) {
      throw error;
    }

    // Re-throw HTTP response errors (404, 403, 500, etc.) so the caller can show
    // a meaningful message. Do NOT fall back to triggerBrowserDownload for these,
    // because opening a link to a 404 URL just shows a broken error page.
    if (axios.isAxiosError(error) && error.response) {
      throw error;
    }

    // For non-HTTP errors (CORS, network failure, mixed-content, etc.) fall back
    // to a plain browser navigation download, which may succeed where fetch cannot.
    logError(error, { operation: 'downloadHelper.download', component: 'DownloadHelper' });
    triggerBrowserDownload(url, filename);
    if (onProgress) onProgress(100);
  }
}

/**
 * Triggers a direct browser file download.
 */
function triggerBrowserDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // For cross-origin URLs, set target="_blank" if download attribute isn't supported/respected
  if (url.startsWith('http') && !url.includes(window.location.host)) {
    link.target = '_blank';
  }

  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
