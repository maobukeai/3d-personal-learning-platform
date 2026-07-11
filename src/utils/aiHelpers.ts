import { useAuthStore } from '@/stores/auth';
import { preferences } from '@/utils/preferences';

export interface ResearchSourceItem {
  title: string;
  link: string;
  domain: string;
  publishedAt?: string;
}

export interface SSEPayload {
  event?: 'meta' | 'heartbeat' | 'done' | 'sources';
  requestId?: string;
  provider?: string;
  model?: string;
  usage?: {
    outputChars?: number;
    reasoningChars?: number;
  };
  text?: string;
  reasoning?: string;
  error?: string;
  sources?: ResearchSourceItem[];
}

export const getCsrfToken = (): string => {
  return document.cookie.match(/csrfToken=([^;]+)/)?.[1] ?? '';
};

export const createJsonHeaders = (
  extraHeaders: Record<string, string> = {},
): Record<string, string> => {
  const csrfToken = getCsrfToken();
  const authStore = useAuthStore();
  const activeWorkspaceId = preferences.getActiveWorkspaceId();
  return {
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...(authStore.accessToken && { Authorization: `Bearer ${authStore.accessToken}` }),
    ...(activeWorkspaceId && { 'X-Workspace-Id': activeWorkspaceId }),
    ...extraHeaders,
  };
};

export const readFetchErrorMessage = async (
  response: Response,
  fallback = `HTTP ${response.status}`,
): Promise<string> => {
  const raw = await response.text();
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    return parsed.error || parsed.message || raw || fallback;
  } catch {
    return raw || fallback;
  }
};

/**
 * Common SSE Stream reader helper.
 * Reads readable stream value by value, parses each SSE line and invokes callbacks.
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (payload: SSEPayload) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): Promise<void> {
  const decoder = new TextDecoder('utf-8');
  let sseBuffer = '';
  const consumeLine = (line: string): boolean => {
    const cleanLine = line.trim();
    if (!cleanLine) return false;
    if (cleanLine === 'data: [DONE]') {
      onDone();
      return true;
    }
    if (cleanLine.startsWith('data: ')) {
      let parsed: SSEPayload;
      try {
        parsed = JSON.parse(cleanLine.substring(6));
      } catch {
        // Ignore JSON parse failures from incomplete or non-JSON SSE events.
        return false;
      }
      onChunk(parsed);
    }
    return false;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      // RFC 8895: SSE lines may be terminated by \r\n, \r, or \n.
      const lines = sseBuffer.split(/\r?\n/);
      sseBuffer = lines.pop() || '';

      for (const line of lines) {
        if (consumeLine(line)) return;
      }
    }
    sseBuffer += decoder.decode();
    if (sseBuffer && consumeLine(sseBuffer)) return;
    onDone();
  } catch (error: unknown) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * @deprecated renderMarkdown is no longer used in AISprite.vue (replaced by
 * the MdPreview component). Kept here only to avoid breaking any external
 * callers. Will be removed in a future cleanup.
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 1. Block-level: Headings
  html = html
    .replace(/^#### (.+)$/gm, '<h5 class="md-h5">$1</h5>')
    .replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>');

  // 2. Block-level: Lists (supporting optional indentation and both '-' and '*')
  html = html
    .replace(
      /^\s*[-*]\s+\[\s*\]\s+(.+)$/gm,
      '<li class="md-li unchecked"><span class="chk"></span>$1</li>',
    )
    .replace(
      /^\s*[-*]\s+\[x\]\s+(.+)$/gm,
      '<li class="md-li checked"><span class="chk done">✓</span>$1</li>',
    )
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li class="md-li">$1</li>')
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li class="md-li">$1</li>');

  // 3. Inline-level: Bold, Italic, Code
  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 4. Line breaks and cleanups
  html = html
    .replace(/\n/g, '<br/>')
    .replace(/(<br\s*\/?>){2,}/g, '<br/>')
    .replace(/(<\/h[2-5]>)\s*<br\s*\/?>/gi, '$1')
    .replace(/<br\s*\/?>\s*(<h[2-5]>)/gi, '$1')
    .replace(/(<\/li>)\s*<br\s*\/?>/gi, '$1')
    .replace(/<br\s*\/?>\s*(<li[^>]*>)/gi, '$1');

  return html;
}
