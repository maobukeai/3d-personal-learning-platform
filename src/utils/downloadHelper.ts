import axios from 'axios';

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
): Promise<void> {
  try {
    // 1. Perform HEAD request to query content length and range support.
    // Some endpoints may require CORS settings to expose Content-Length and Accept-Ranges.
    const headRes = await axios.head(url, { signal });
    const contentLength = headRes.headers['content-length'];
    const acceptRanges = headRes.headers['accept-ranges'];

    // If content-length is unknown or server explicitly refuses range requests, fall back
    if (!contentLength || acceptRanges === 'none') {
      triggerBrowserDownload(url, filename);
      if (onProgress) onProgress(100);
      return;
    }

    const totalSize = parseInt(String(contentLength), 10);
    // If the file is small (e.g., < 5MB), download it in a single standard request to avoid overhead
    if (totalSize < 5 * 1024 * 1024) {
      triggerBrowserDownload(url, filename);
      if (onProgress) onProgress(100);
      return;
    }

    // 2. Probe a 1-byte range request to verify the server actually returns 206.
    // This catches cases where CORS or CDN silently downgrades range requests to 200.
    try {
      const probeRes = await axios.get(url, {
        headers: { Range: 'bytes=0-0' },
        responseType: 'arraybuffer',
        signal,
      });
      if (probeRes.status !== 206) {
        // Server responded 200 instead of 206 — range requests are not truly supported
        triggerBrowserDownload(url, filename);
        if (onProgress) onProgress(100);
        return;
      }
    } catch {
      // Probe failed (e.g., CORS blocks Range header) — fall back gracefully
      triggerBrowserDownload(url, filename);
      if (onProgress) onProgress(100);
      return;
    }

    // 3. Set up parallel range request download (4 chunks in parallel)
    const threads = 4;
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

    // 4. Reassemble the file chunks into a single Blob
    const blob = new Blob(chunks);
    const blobUrl = URL.createObjectURL(blob);

    // 5. Trigger download of the local blob
    triggerBrowserDownload(blobUrl, filename);

    // Revoke blob URL after 1 minute to free up memory
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  } catch (error) {
    if (
      axios.isCancel(error) ||
      (error instanceof Error && (error.name === 'CanceledError' || error.message === 'canceled'))
    ) {
      throw error;
    }
    console.warn(
      '[DownloadHelper] Parallel range download failed. Falling back to browser standard download:',
      error,
    );
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
