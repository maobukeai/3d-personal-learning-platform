export interface SSEPayload {
  text?: string;
  reasoning?: string;
  error?: string;
}

/**
 * Common SSE Stream reader helper.
 * Reads readable stream value by value, parses each SSE line and invokes callbacks.
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (payload: SSEPayload) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  const decoder = new TextDecoder('utf-8');
  let sseBuffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || '';

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        if (cleanLine === 'data: [DONE]') {
          onDone();
          return;
        }
        if (cleanLine.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(cleanLine.substring(6));
            onChunk(parsed);
          } catch (e) {
            // Ignore JSON parse failures from split chunk boundaries
          }
        }
      }
    }
    onDone();
  } catch (error: any) {
    onError(error);
  }
}

/**
 * Simple client-side Markdown-to-HTML parser for dialog chat and preview.
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^- \[ \] (.+)$/gm, '<li class="md-li unchecked"><span class="chk"></span>$1</li>')
    .replace(/^- \[x\] (.+)$/gm, '<li class="md-li checked"><span class="chk done">✓</span>$1</li>')
    .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li">$1</li>')
    .replace(/\n/g, '<br/>');
  return html;
}

