<script setup lang="ts">
import { computed } from 'vue';
import { marked, Renderer, type Tokens } from 'marked';
import SafeHtml from '@/components/SafeHtml.vue';

const props = defineProps<{ source?: string | null }>();

const renderer = new Renderer();
const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

renderer.checkbox = ({ checked }: Tokens.Checkbox) =>
  `<span class="markdown-task-checkbox${checked ? ' is-checked' : ''}" aria-hidden="true">${
    checked ? '✓' : ''
  }</span>`;

renderer.code = ({ text, lang }: Tokens.Code) => {
  const language = lang?.trim().split(/\s+/)[0] || 'text';
  return `<div class="markdown-code-block"><div class="markdown-code-head"><span class="markdown-code-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="markdown-code-language">${escapeHtml(language)}</span><span class="markdown-code-copy">复制</span></div><pre><code class="language-${escapeHtml(language)}">${escapeHtml(text)}</code></pre></div>`;
};

const html = computed(() => {
  const source = props.source?.trim();
  if (!source) return '';
  return marked.parse(source, { breaks: true, gfm: true, renderer }) as string;
});

const handleCodeAction = async (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  const action = target?.closest<HTMLElement>('.markdown-code-copy');
  const code = action?.closest('.markdown-code-block')?.querySelector('code')?.textContent;
  if (!action || !code || !navigator.clipboard) return;

  try {
    await navigator.clipboard.writeText(code);
    action.textContent = '已复制';
    window.setTimeout(() => {
      action.textContent = '复制';
    }, 1600);
  } catch {
    action.textContent = '复制失败';
    window.setTimeout(() => {
      action.textContent = '复制';
    }, 1600);
  }
};
</script>

<template>
  <div class="public-markdown-shell" @click="handleCodeAction">
    <SafeHtml :html="html" class="public-markdown" />
  </div>
</template>

<style scoped>
.public-markdown {
  color: var(--text-secondary);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif;
  font-size: inherit;
  line-height: 1.75;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.public-markdown :deep(h1),
.public-markdown :deep(h2),
.public-markdown :deep(h3),
.public-markdown :deep(h4),
.public-markdown :deep(h5),
.public-markdown :deep(h6) {
  position: relative;
  margin: 1.4em 0 0.8em;
  color: var(--text-primary);
  font-weight: 700;
  line-height: 1.35;
}

.public-markdown :deep(h1) {
  font-size: 2em;
}
.public-markdown :deep(h2) {
  font-size: 1.5em;
}
.public-markdown :deep(h3) {
  font-size: 1.25em;
}
.public-markdown :deep(h4) {
  font-size: 1em;
}
.public-markdown :deep(h5) {
  font-size: 0.875em;
}
.public-markdown :deep(h6) {
  font-size: 0.85em;
}

.public-markdown :deep(p) {
  margin: 0 0 1em;
}
.public-markdown :deep(ul),
.public-markdown :deep(ol) {
  margin: 0 0 1em;
  padding-left: 2em;
}
.public-markdown :deep(ul) {
  list-style: disc;
}
.public-markdown :deep(ol) {
  list-style: decimal;
}
.public-markdown :deep(li + li) {
  margin-top: 0.25em;
}
.public-markdown :deep(a) {
  color: var(--accent);
  text-decoration: none;
}
.public-markdown :deep(a:hover) {
  text-decoration: underline;
}

.public-markdown :deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 4px solid var(--border-strong);
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.public-markdown :deep(hr) {
  height: 1px;
  margin: 1.25em 0;
  border: 0;
  background: var(--border-base);
}

.public-markdown :deep(code:not(pre code)) {
  padding: 2px 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.public-markdown :deep(.markdown-code-block) {
  margin: 1.25em 0;
  overflow: hidden;
  border: 1px solid rgb(148 163 184 / 20%);
  border-radius: 12px;
  background: linear-gradient(145deg, #202734, #151a23);
  box-shadow: 0 12px 30px rgb(15 23 42 / 20%);
}

.public-markdown :deep(.markdown-code-head) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 2.2rem;
  gap: 0.6rem;
  padding: 0 0.85rem;
  border-bottom: 1px solid rgb(255 255 255 / 7%);
  background: rgb(255 255 255 / 3%);
  color: #cbd5e1;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72em;
  line-height: 1;
}

.public-markdown :deep(.markdown-code-dots) {
  display: inline-flex;
  gap: 0.3rem;
}

.public-markdown :deep(.markdown-code-dots i) {
  display: block;
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
  background: #ec6a5e;
}

.public-markdown :deep(.markdown-code-dots i:nth-child(2)) {
  background: #f4bf4f;
}
.public-markdown :deep(.markdown-code-dots i:nth-child(3)) {
  background: #61c554;
}

.public-markdown :deep(.markdown-code-language) {
  margin-right: auto;
  color: #94a3b8;
  text-transform: lowercase;
}

.public-markdown :deep(.markdown-code-copy) {
  padding: 0.28rem 0.52rem;
  border: 1px solid rgb(148 163 184 / 24%);
  border-radius: 0.35rem;
  color: #cbd5e1;
  cursor: pointer;
  transition:
    color 0.16s ease,
    background-color 0.16s ease,
    border-color 0.16s ease;
  user-select: none;
}

.public-markdown :deep(.markdown-code-copy:hover) {
  border-color: rgb(129 140 248 / 72%);
  background: rgb(99 102 241 / 18%);
  color: #e0e7ff;
}

.public-markdown :deep(.markdown-code-block pre) {
  margin: 0;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  -webkit-overflow-scrolling: touch;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.public-markdown :deep(.markdown-code-block pre code) {
  display: block;
  min-width: max-content;
  padding: 1em;
  border-radius: 0;
  background: #151a23 !important;
  color: #dbeafe !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.65;
  white-space: pre;
}

.public-markdown :deep(pre:not(.markdown-code-block pre)) {
  max-width: 100%;
  overflow-x: auto;
  padding: 0.9em;
  border-radius: 6px;
  background: var(--bg-subtle);
}

.public-markdown :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 1em 0;
  -webkit-overflow-scrolling: touch;
}

.public-markdown :deep(th),
.public-markdown :deep(td) {
  padding: 0.55em 0.8em;
  border: 1px solid var(--border-base);
  text-align: left;
}

.public-markdown :deep(th) {
  color: var(--text-primary);
  background: var(--bg-subtle);
  font-weight: 700;
}

.public-markdown :deep(img),
.public-markdown :deep(video) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1em auto;
  border-radius: 5px;
}

.public-markdown :deep(.markdown-task-checkbox) {
  display: inline-flex;
  width: 1.05em;
  height: 1.05em;
  margin-right: 0.5em;
  vertical-align: -0.1em;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--md-theme-border-color, var(--border-strong));
  border-radius: 0.28em;
  color: white;
  font-size: 0.8em;
  font-weight: 800;
}

.public-markdown :deep(.markdown-task-checkbox.is-checked) {
  border-color: var(--accent);
  background: var(--accent);
}

@media (max-width: 767px) {
  .public-markdown {
    padding-inline: 4px;
    line-height: 1.72;
  }

  .public-markdown :deep(h1) {
    font-size: 1.7em;
  }

  .public-markdown :deep(h2) {
    font-size: 1.35em;
  }

  .public-markdown :deep(h3) {
    font-size: 1.16em;
  }

  .public-markdown :deep(.markdown-code-block) {
    margin-inline: -0.25rem;
    border-radius: 0.7rem;
  }

  .public-markdown :deep(.markdown-code-block pre code) {
    padding: 0.8em;
    font-size: 0.82em;
  }

  .public-markdown :deep(.markdown-code-head) {
    height: 2rem;
    padding-inline: 0.65rem;
  }

  .public-markdown :deep(th),
  .public-markdown :deep(td) {
    min-width: 5.75rem;
    padding: 0.52em 0.65em;
  }
}
</style>
