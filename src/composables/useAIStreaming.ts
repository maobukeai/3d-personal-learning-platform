import { ref, onUnmounted } from 'vue';
import {
  parseSSEStream,
  createJsonHeaders,
  readFetchErrorMessage,
  type SSEPayload,
} from '@/utils/aiHelpers';

interface AIStreamingCallbacks {
  onChunk: (text: string, reasoning?: string) => void;
  onMeta?: (payload: SSEPayload) => void;
  onSources?: (payload: SSEPayload) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export const useAIStreaming = () => {
  const isGenerating = ref(false);
  const currentAbortController = ref<AbortController | null>(null);

  const streamChat = async (
    url: string,
    body: unknown,
    callbacks: AIStreamingCallbacks,
  ) => {
    if (isGenerating.value) {
      return;
    }

    isGenerating.value = true;
    const controller = new AbortController();
    currentAbortController.value = controller;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: createJsonHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorMsg = await readFetchErrorMessage(response);
        throw new Error(errorMsg);
      }

      if (!response.body) {
        throw new Error('Readable stream not supported');
      }

      const reader = response.body.getReader();

      await parseSSEStream(
        reader,
        (payload) => {
          if (payload.event === 'meta') {
            callbacks.onMeta?.(payload);
          } else if (payload.event === 'sources') {
            callbacks.onSources?.(payload);
          } else if (payload.event === 'heartbeat') {
            // Heartbeat, do nothing
          } else if (payload.error) {
            throw new Error(payload.error);
          } else {
            // Normal message text or reasoning
            if (payload.text !== undefined || payload.reasoning !== undefined) {
              callbacks.onChunk(payload.text || '', payload.reasoning || '');
            }
          }
        },
        () => {
          isGenerating.value = false;
          callbacks.onDone?.();
        },
        (err) => {
          isGenerating.value = false;
          callbacks.onError?.(err);
        },
      );
    } catch (err: unknown) {
      isGenerating.value = false;
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (currentAbortController.value === controller) {
        currentAbortController.value = null;
      }
    }
  };

  const abort = () => {
    if (currentAbortController.value) {
      currentAbortController.value.abort();
      currentAbortController.value = null;
    }
    isGenerating.value = false;
  };

  onUnmounted(() => {
    abort();
  });

  return {
    isGenerating,
    streamChat,
    abort,
  };
};
