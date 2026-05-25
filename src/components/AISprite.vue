<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { Send, X, Trash2, Copy, Check, Square } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import UserAvatar from '@/components/UserAvatar.vue';

// State management stores
const authStore = useAuthStore();
const systemStore = useSystemStore();

// UI State Variables
const isOpen = ref(false);
const isGenerating = ref(false);
const isTyping = ref(false);
const inputMessage = ref('');
const showBubble = ref(true);

// Resizing Chat Box dimensions (relative to top and left edges)
const chatBoxWidth = ref(380);
const chatBoxHeight = ref(480);
const isResizing = ref(false);
let resizeType = '';
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartX = 0;
let resizeStartY = 0;

// Active LLM Stream Reader & Copy States
let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
const copiedIndex = ref<number | null>(null);

// Draggable Position Coordinates (relative to bottom-right)
const position = ref({ bottom: 24, right: 24 });
const isDragging = ref(false);
let startX = 0;
let startY = 0;
let startBottom = 0;
let startRight = 0;
let hasMoved = false;

// Chat message contract
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Initial chat prompt message history
const messages = ref<Message[]>([
  {
    role: 'assistant',
    content: '嗨！我是平台常驻的 AI 智能小精灵 ✨。我可以为您提供 3D 技术问答（如 WebGL/Three.js）、协助制定学习计划，或是指导您如何使用平台的各项功能（如项目管理、任务看板、材料管理）。有什么我可以帮您的吗？👾',
  },
]);

// DOM reference for auto-scroll
const chatContainer = ref<HTMLDivElement | null>(null);

/**
 * Scroll conversation messages container to bottom.
 */
const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

/**
 * Initiates mouse or touch dragging on the AI Sprite trigger button or Chat Header.
 */
const onDragStart = (e: MouseEvent | TouchEvent) => {
  // Prevent drag if clicking on buttons or interactive icons
  const target = e.target as HTMLElement;
  if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('.el-dropdown')) {
    return;
  }

  isDragging.value = true;
  hasMoved = false;
  
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  
  startX = clientX;
  startY = clientY;
  startBottom = position.value.bottom;
  startRight = position.value.right;

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);
};

/**
 * Calculates new drag coordinates keeping the sprite/chatbox within viewport bounds.
 */
const onDragMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return;
  if ('touches' in e) {
    e.preventDefault(); // Stop mobile screen elastic scrolling
  }
  
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  
  const deltaX = clientX - startX;
  const deltaY = clientY - startY;

  // Set drag flag if it moves beyond a 4px noise threshold
  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
    hasMoved = true;
  }

  const nextBottom = startBottom - deltaY;
  const nextRight = startRight - deltaX;

  // Restrict boundaries dynamically so the chat box stays in view when open
  const maxBottom = isOpen.value 
    ? Math.max(10, window.innerHeight - chatBoxHeight.value - 90) 
    : window.innerHeight - 80;
  const maxRight = isOpen.value 
    ? Math.max(10, window.innerWidth - chatBoxWidth.value - 40) 
    : window.innerWidth - 80;

  position.value.bottom = Math.max(10, Math.min(maxBottom, nextBottom));
  position.value.right = Math.max(10, Math.min(maxRight, nextRight));
};

/**
 * Cleans up global mouse & touch event listeners on drag release.
 */
const onDragEnd = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
};

/**
 * Initiates mouse or touch resizing on the Chat Box edges or corner.
 */
const onResizeStart = (e: MouseEvent | TouchEvent, type: string) => {
  e.preventDefault();
  e.stopPropagation();
  isResizing.value = true;
  resizeType = type;

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

  resizeStartX = clientX;
  resizeStartY = clientY;
  resizeStartWidth = chatBoxWidth.value;
  resizeStartHeight = chatBoxHeight.value;

  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
  document.addEventListener('touchmove', onResizeMove, { passive: false });
  document.addEventListener('touchend', onResizeEnd);
};

/**
 * Adjusts chatBoxWidth & chatBoxHeight based on mouse/touch drag relative movements.
 */
const onResizeMove = (e: MouseEvent | TouchEvent) => {
  if (!isResizing.value) return;

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

  const deltaX = clientX - resizeStartX;
  const deltaY = clientY - resizeStartY;

  if (resizeType === 'left' || resizeType === 'top-left') {
    const newWidth = resizeStartWidth - deltaX;
    // Constrain width so it cannot exceed the left edge of the page
    const maxAllowedWidth = Math.max(300, window.innerWidth - position.value.right - 20);
    chatBoxWidth.value = Math.max(300, Math.min(maxAllowedWidth, 800, newWidth));
  }

  if (resizeType === 'top' || resizeType === 'top-left') {
    const newHeight = resizeStartHeight - deltaY;
    // Constrain height so it cannot exceed the top edge of the page
    const maxAllowedHeight = Math.max(350, window.innerHeight - position.value.bottom - 90);
    chatBoxHeight.value = Math.max(350, Math.min(maxAllowedHeight, 800, newHeight));
  }
};

/**
 * Cleans up global mouse & touch event listeners on resize release.
 */
const onResizeEnd = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('touchmove', onResizeMove);
  document.removeEventListener('touchend', onResizeEnd);

  localStorage.setItem('ai_sprite_chat_width', chatBoxWidth.value.toString());
  localStorage.setItem('ai_sprite_chat_height', chatBoxHeight.value.toString());
};

/**
 * Handles clicks on the mascot sprite. Ignores trigger if dragging just occurred.
 */
const handleSpriteClick = () => {
  if (hasMoved) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    showBubble.value = false;
    scrollToBottom();
  }
};

// Initialize sessionStorage conversation history on mount
onMounted(() => {
  const saved = sessionStorage.getItem('ai_sprite_chat_history');
  if (saved) {
    try {
      messages.value = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse chat history:', e);
    }
  }

  const savedWidth = localStorage.getItem('ai_sprite_chat_width');
  const savedHeight = localStorage.getItem('ai_sprite_chat_height');
  if (savedWidth) {
    const w = parseInt(savedWidth, 10);
    if (w >= 300 && w <= 800) chatBoxWidth.value = w;
  }
  if (savedHeight) {
    const h = parseInt(savedHeight, 10);
    if (h >= 350 && h <= 800) chatBoxHeight.value = h;
  }
  
  // Auto fade out bubble tip after 8 seconds
  setTimeout(() => {
    showBubble.value = false;
  }, 8000);
});

/**
 * Persists messages in session storage.
 */
const saveHistory = () => {
  sessionStorage.setItem('ai_sprite_chat_history', JSON.stringify(messages.value));
};

/**
 * Streams the conversation reply from the backend Server-Sent Events (SSE) API.
 * Uses the browser native fetch API to read chunks on-the-fly.
 */
const handleSend = async () => {
  if (!inputMessage.value.trim() || isGenerating.value || isTyping.value) return;

  const userMsg = inputMessage.value.trim();
  messages.value.push({ role: 'user', content: userMsg });
  inputMessage.value = '';
  saveHistory();
  await scrollToBottom();

  isGenerating.value = true;
  
  try {
    const chatHistory = messages.value.slice(-10);
    const csrfToken = document.cookie.match(/csrfToken=([^;]+)/)?.[1] || '';

    // Invoke direct native fetch to stream chunked SSE payloads
    const response = await fetch('/api/projects/ai-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ messages: chatHistory }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Readable stream not supported in this browser environment.');
    }

    isGenerating.value = false;
    isTyping.value = true;

    // Insert an empty assistant message block for append-streaming
    messages.value.push({ role: 'assistant', content: '' });
    const targetIndex = messages.value.length - 1;

    activeReader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await activeReader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep trailing line snippet

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        if (cleanLine === 'data: [DONE]') {
          break;
        }
        if (cleanLine.startsWith('data: ')) {
          try {
            const payload = JSON.parse(cleanLine.substring(6));
            if (payload.error) {
              messages.value[targetIndex].content += `\n[错误: ${payload.error}]`;
            } else if (payload.text) {
              // Directly stream characters into message content
              messages.value[targetIndex].content += payload.text;
              await scrollToBottom();
            }
          } catch (e) {
            // Ignore JSON parse failures from split chunk boundaries
          }
        }
      }
    }
  } catch (error: any) {
    console.error('AI streaming chat error:', error);
    isGenerating.value = false;
    const errMsg = error.message || '连接失败';
    messages.value.push({ role: 'assistant', content: `小精灵被阻碍了：${errMsg}` });
  } finally {
    isTyping.value = false;
    activeReader = null;
    saveHistory();
    await scrollToBottom();
  }
};

/**
 * Resets the session message logs.
 */
const clearHistory = () => {
  messages.value = [
    {
      role: 'assistant',
      content: '历史记录已清空。有什么新问题我可以帮您解答吗？✨',
    },
  ];
  saveHistory();
};

/**
 * Stops/cancels the active stream reader generation.
 */
const handleStop = () => {
  if (activeReader) {
    try {
      activeReader.cancel();
    } catch (e) {
      console.error('Failed to cancel active reader:', e);
    }
    activeReader = null;
  }
  isGenerating.value = false;
  isTyping.value = false;
};

/**
 * Safe clipboard copy utility supporting navigator.clipboard (HTTPS) 
 * and standard document.execCommand fallback (HTTP / local development).
 */
const copyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success ? Promise.resolve() : Promise.reject(new Error('Copy command failed'));
  } catch (err) {
    document.body.removeChild(textarea);
    return Promise.reject(err);
  }
};

/**
 * Copies the message text content to the clipboard.
 */
const copyMessage = (text: string, index: number) => {
  copyToClipboard(text).then(() => {
    copiedIndex.value = index;
    setTimeout(() => {
      if (copiedIndex.value === index) {
        copiedIndex.value = null;
      }
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy message:', err);
  });
};

/**
 * Catches clicks on copy buttons embedded dynamically inside code blocks.
 */
const handleContainerClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const copyBtn = target.closest('.copy-code-btn') as HTMLElement;
  if (copyBtn) {
    e.preventDefault();
    e.stopPropagation();
    const code = decodeURIComponent(copyBtn.getAttribute('data-code') || '');
    if (code) {
      copyToClipboard(code).then(() => {
        const labelSpan = copyBtn.querySelector('.btn-text');
        const originalText = labelSpan ? labelSpan.textContent : '复制代码';
        if (labelSpan) {
          labelSpan.textContent = '已复制!';
          copyBtn.classList.add('text-emerald-500');
        }
        setTimeout(() => {
          if (labelSpan) {
            labelSpan.textContent = originalText;
            copyBtn.classList.remove('text-emerald-500');
          }
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy code block:', err);
      });
    }
  }
};

/**
 * Rich text formatter parsing block code blocks, inline code, bold text, newlines,
 * and bullet/numbered lists cleanly.
 */
const formatMessage = (content: string) => {
  // Escape HTML tags to prevent XSS injection
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Extract block code segments to protect their newlines from paragraph parsing
  const codeBlocks: string[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;
  
  html = html.replace(codeBlockRegex, (match, lang, code) => {
    const cleanLang = lang || 'code';
    const cleanCode = code.trim();
    const placeholder = `___CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}___`;
    
    const blockHtml = `
      <div class="my-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 overflow-hidden font-mono text-[11px] bg-slate-950 text-slate-200 shadow-inner">
        <div class="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-bold flex justify-between items-center select-none">
          <span class="uppercase tracking-wider">${cleanLang}</span>
          <button type="button" class="copy-code-btn flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-slate-400" data-code="${encodeURIComponent(cleanCode)}">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            <span class="btn-text">复制代码</span>
          </button>
        </div>
        <pre class="p-3 overflow-x-auto whitespace-pre leading-relaxed scrollbar-thin text-left"><code>${cleanCode}</code></pre>
      </div>
    `;
    codeBlocks.push(blockHtml);
    return placeholder;
  });

  // Convert newlines in standard text to line breaks
  html = html.replace(/\n/g, '<br/>');

  // Convert inline code segments: `code`
  html = html.replace(/`([^`\n]+)`/g, '<code class="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[11px] text-indigo-500 font-bold">$1</code>');

  // Convert bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Format bullet list items and numbered lists
  const lines = html.split('<br/>');
  const formattedLines = lines.map(line => {
    const clean = line.trim();
    if (clean.startsWith('* ') || clean.startsWith('- ')) {
      return `<li class="ml-4 list-disc my-1 text-left">${clean.substring(2)}</li>`;
    }
    const numMatch = clean.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      return `<li class="ml-4 list-decimal my-1 text-left">${numMatch[2]}</li>`;
    }
    return line;
  });
  html = formattedLines.join('<br/>');

  // Restore the escaped block code segments
  codeBlocks.forEach((blockHtml, index) => {
    html = html.replace(`___CODE_BLOCK_PLACEHOLDER_${index}___`, blockHtml);
  });

  return html;
};
</script>

<template>
  <div 
    v-if="systemStore.settings.AI_IMPORT_ENABLED" 
    class="fixed z-[99] flex flex-col items-end"
    :style="{ bottom: position.bottom + 'px', right: position.right + 'px' }"
  >
    
    <!-- Bubble Tip -->
    <Transition name="fade">
      <div 
        v-if="showBubble && !isOpen"
        class="mb-3 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold relative max-w-xs break-all animate-bounce-slow pointer-events-none select-none"
        style="
          background: var(--bg-card);
          border: 1px solid var(--border-base);
          color: var(--text-secondary);
        "
      >
        <span>拖动我，有问题随时点击我哦~ 👾</span>
        <!-- Arrow -->
        <div 
          class="absolute bottom-[-6px] right-6 w-3 h-3 rotate-45 border-r border-b"
          style="
            background: var(--bg-card);
            border-color: var(--border-base);
          "
        ></div>
      </div>
    </Transition>

    <!-- Chat Box -->
    <Transition name="slide-fade">
      <div
        v-if="isOpen"
        class="mb-4 rounded-3xl shadow-2xl border flex flex-col overflow-hidden relative backdrop-blur-md animate-none"
        :class="[isResizing ? '' : 'transition-all duration-300']"
        :style="{
          width: chatBoxWidth + 'px',
          height: chatBoxHeight + 'px',
          backgroundColor: 'rgba(var(--bg-card-rgb, 255, 255, 255), 0.85)',
          borderColor: 'var(--border-base)',
        }"
      >
        <!-- Drag resize handles (resizes from top, left, and top-left edges) -->
        <!-- Left edge -->
        <div 
          class="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-30 select-none" 
          @mousedown="onResizeStart($event, 'left')"
          @touchstart="onResizeStart($event, 'left')"
        ></div>
        <!-- Top edge -->
        <div 
          class="absolute left-0 right-0 top-0 h-2 cursor-n-resize z-30 select-none" 
          @mousedown="onResizeStart($event, 'top')"
          @touchstart="onResizeStart($event, 'top')"
        ></div>
        <!-- Top-left corner -->
        <div 
          class="absolute left-0 top-0 w-4 h-4 cursor-nw-resize z-40 select-none" 
          @mousedown="onResizeStart($event, 'top-left')"
          @touchstart="onResizeStart($event, 'top-left')"
        ></div>
        <!-- Top-left visual corner bracket cue -->
        <div class="absolute left-2 top-2 w-2.5 h-2.5 border-l-2 border-t-2 border-slate-400/40 dark:border-slate-500/40 rounded-tl pointer-events-none z-30"></div>
        <!-- Chat Header (draggable handle to move dialogue window) -->
        <div 
          class="px-5 py-3 border-b flex items-center justify-between bg-gradient-to-r from-indigo-500/10 via-accent/10 to-transparent cursor-grab active:cursor-grabbing select-none" 
          style="border-color: var(--border-base)"
          @mousedown="onDragStart"
          @touchstart="onDragStart"
        >
          <div class="flex items-center gap-2.5">
            <!-- Miniature Glowing Mascot inside chat header -->
            <div class="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-white shadow-md relative border overflow-hidden" style="border-color: var(--accent);">
              <svg viewBox="0 0 64 64" class="w-7 h-7">
                <path d="M 12 24 L 6 18 M 52 24 L 58 18" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" />
                <rect x="10" y="16" width="44" height="36" rx="16" fill="rgba(255, 255, 255, 0.1)" stroke="var(--accent)" stroke-width="2.5" />
                <rect x="14" y="21" width="36" height="25" rx="10" fill="rgba(15, 23, 42, 0.9)" />
                <circle cx="23" cy="30" r="2.5" fill="var(--accent)" />
                <circle cx="41" cy="30" r="2.5" fill="var(--accent)" />
                <path d="M 27 37 Q 32 40 37 37" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"></span>
            </div>
            <div>
              <p class="text-xs font-black tracking-tight" style="color: var(--text-primary)">AI 智能小精灵</p>
              <p class="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">在线帮答疑</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
              title="清空会话历史"
              @click="clearHistory"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              @click="isOpen = false"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Chat messages container -->
        <div 
          ref="chatContainer"
          class="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin"
          @click="handleContainerClick"
        >
          <div 
            v-for="(msg, idx) in messages"
            :key="idx"
            class="flex items-start gap-2.5"
            :class="msg.role === 'user' ? 'flex-row-reverse text-right' : ''"
          >
            <!-- Avatar -->
            <div class="shrink-0">
              <UserAvatar v-if="msg.role === 'user'" :user="authStore.user ?? undefined" size="sm" />
              <div v-else class="w-7 h-7 rounded-lg bg-slate-955 text-white flex items-center justify-center shadow-md border overflow-hidden" style="border-color: var(--accent);">
                <svg viewBox="0 0 64 64" class="w-6 h-6">
                  <path d="M 12 24 L 6 18 M 52 24 L 58 18" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" />
                  <rect x="10" y="16" width="44" height="36" rx="16" fill="rgba(255, 255, 255, 0.1)" stroke="var(--accent)" stroke-width="2.5" />
                  <rect x="14" y="21" width="36" height="25" rx="10" fill="rgba(15, 23, 42, 0.9)" />
                  <circle cx="23" cy="30" r="2.5" fill="var(--accent)" />
                  <circle cx="41" cy="30" r="2.5" fill="var(--accent)" />
                  <path d="M 27 37 Q 32 40 37 37" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" />
                </svg>
              </div>
            </div>

            <!-- Message bubble -->
            <div class="max-w-[75%] flex flex-col space-y-1 group">
              <span class="text-[9px] text-slate-400 font-bold px-1">
                {{ msg.role === 'user' ? (authStore.user?.name || '我') : '小精灵' }}
              </span>
              <div 
                class="px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words text-left"
                :class="
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-tr-none shadow-md shadow-accent/15'
                    : 'bg-slate-100 dark:bg-white/5 rounded-tl-none border border-slate-200/50 dark:border-white/5'
                "
                :style="msg.role === 'user' ? { background: 'var(--accent)' } : { color: 'var(--text-primary)' }"
                v-html="formatMessage(msg.content)"
              ></div>
              
              <!-- Message Action Bar (Copy Button) -->
              <div 
                v-if="msg.role === 'assistant'" 
                class="flex items-center gap-2 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none"
              >
                <button 
                  type="button" 
                  class="flex items-center gap-1 text-[10px] text-slate-400 hover:text-accent transition-colors cursor-pointer"
                  @click="copyMessage(msg.content, idx)"
                >
                  <component :is="copiedIndex === idx ? Check : Copy" class="w-2.5 h-2.5" />
                  <span>{{ copiedIndex === idx ? '已复制' : '复制内容' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Loading Indicator bubble -->
          <div v-if="isGenerating" class="flex items-start gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-slate-955 text-white flex items-center justify-center shadow-md border overflow-hidden animate-pulse" style="border-color: var(--accent);">
              <svg viewBox="0 0 64 64" class="w-6 h-6">
                <path d="M 12 24 L 6 18 M 52 24 L 58 18" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" />
                <rect x="10" y="16" width="44" height="36" rx="16" fill="rgba(255, 255, 255, 0.1)" stroke="var(--accent)" stroke-width="2.5" />
                <rect x="14" y="21" width="36" height="25" rx="10" fill="rgba(15, 23, 42, 0.9)" />
                <ellipse cx="23" cy="30" rx="2.5" ry="1.5" fill="var(--accent)" class="animate-ping" />
                <ellipse cx="41" cy="30" rx="2.5" ry="1.5" fill="var(--accent)" class="animate-ping" />
                <path d="M 24 37 C 28 35, 30 39, 34 35 C 36 37, 38 35, 40 37" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" class="talking-mouth-path" />
              </svg>
            </div>
            <div class="max-w-[75%] flex flex-col space-y-1">
              <span class="text-[9px] text-slate-400 font-bold px-1">小精灵</span>
              <div class="px-3.5 py-2 bg-slate-100 dark:bg-white/5 rounded-2xl rounded-tl-none border border-slate-200/50 dark:border-white/5 flex items-center gap-1.5">
                <div class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></div>
                <div class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></div>
                <div class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Input footer -->
        <div class="p-3 border-t bg-slate-50/50 dark:bg-slate-900/50" style="border-color: var(--border-base)">
          <div class="flex items-center gap-2 bg-white dark:bg-slate-900 border rounded-2xl px-3 py-1.5 shadow-inner focus-within:ring-2 focus-within:ring-accent/20 transition-all" style="border-color: var(--border-base)">
            <input 
              v-model="inputMessage"
              type="text"
              class="flex-1 bg-transparent border-none outline-none text-xs"
              style="color: var(--text-primary)"
              placeholder="问问小精灵 3D/代码或平台问题..."
              :disabled="isGenerating || isTyping"
              @keydown.enter="handleSend"
            />
            <button 
              v-if="isGenerating || isTyping"
              type="button"
              class="w-7 h-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              @click="handleStop"
            >
              <Square class="w-3 h-3 fill-current" />
            </button>
            <button 
              v-else
              type="button"
              :disabled="!inputMessage.trim()"
              class="w-7 h-7 rounded-xl bg-accent text-white flex items-center justify-center shadow-md shadow-accent/10 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              style="background: var(--accent)"
              @click="handleSend"
            >
              <Send class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Upgraded Theme-consistent Draggable Sprite Button -->
    <div
      class="elf-mascot relative w-15 h-15 rounded-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 animate-float-sprite"
      style="
        background-color: var(--bg-card);
        border: 2px solid var(--accent);
      "
      :style="{
        boxShadow: `0 0 20px color-mix(in srgb, var(--accent) 35%, transparent)`
      }"
      @mousedown="onDragStart"
      @touchstart="onDragStart"
      @click="handleSpriteClick"
    >
      <!-- holographic background gradient pulse -->
      <div 
        class="absolute inset-0 animate-pulse pointer-events-none"
        :style="{
          background: `radial-gradient(circle at center, color-mix(in srgb, var(--accent) 35%, transparent) 0%, transparent 70%)`
        }"
      ></div>
      
      <!-- scanning line animation -->
      <div 
        class="scanner-line absolute left-0 right-0 h-[1.5px] z-10 pointer-events-none opacity-60"
        style="background-color: var(--accent);"
        :style="{
          boxShadow: `0 0 6px var(--accent)`
        }"
      ></div>
      
      <!-- holographic grid decor -->
      <div 
        class="absolute inset-0 border rounded-full animate-ping [animation-duration:3s] pointer-events-none"
        style="border-color: var(--accent); opacity: 0.15;"
      ></div>

      <!-- Upgraded Custom Vector Mascot -->
      <svg viewBox="0 0 64 64" class="w-12 h-12 z-20 transition-transform duration-300 pointer-events-none" :style="{ transform: isOpen ? 'scale(0.88) rotate(-3deg)' : 'scale(1)' }">
        <!-- Cyber ears/antennae -->
        <path d="M 12 24 L 6 18 M 52 24 L 58 18" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" class="animate-pulse" />
        <circle cx="6" cy="18" r="3" fill="var(--accent)" />
        <circle cx="58" cy="18" r="3" fill="var(--accent)" />

        <!-- Outer Head Frame / Helmet (Glassmorphic border) -->
        <rect x="10" y="16" width="44" height="36" rx="16" fill="rgba(255, 255, 255, 0.15)" stroke="var(--accent)" stroke-width="2.5" />
        
        <!-- Headphone bands -->
        <rect x="5" y="25" width="6" height="15" rx="3" fill="var(--accent)" />
        <rect x="53" y="25" width="6" height="15" rx="3" fill="var(--accent)" />

        <!-- Cyber Visor -->
        <rect x="14" y="21" width="36" height="25" rx="10" fill="rgba(15, 23, 42, 0.88)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1" />

        <!-- Blinking Cyber Eyes -->
        <g class="eyes">
          <ellipse cx="23" cy="30" rx="3" ry="4.5" fill="var(--accent)" class="eye animate-blink" :style="{ filter: 'drop-shadow(0 0 3px var(--accent))' }" />
          <ellipse cx="41" cy="30" rx="3" ry="4.5" fill="var(--accent)" class="eye animate-blink" :style="{ filter: 'drop-shadow(0 0 3px var(--accent))' }" />
        </g>

        <!-- Waveform Talking Mouth or Smile -->
        <path 
          v-if="isGenerating || isTyping"
          d="M 24 37 C 28 35, 30 39, 34 35 C 36 37, 38 35, 40 37" 
          fill="none" 
          stroke="var(--accent)" 
          stroke-width="2" 
          stroke-linecap="round"
          class="talking-mouth-path" 
          :style="{ filter: 'drop-shadow(0 0 3px var(--accent))' }"
        />
        <path 
          v-else
          d="M 27 37 Q 32 40 37 37" 
          fill="none" 
          stroke="var(--accent)" 
          stroke-width="2.5" 
          stroke-linecap="round"
          :style="{ filter: 'drop-shadow(0 0 2px var(--accent))' }"
        />
      </svg>

      <!-- Inner glow ring -->
      <span class="absolute inset-0.5 rounded-full border border-white/5 pointer-events-none"></span>
    </div>

  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: var(--border-base);
  border-radius: 99px;
}

/* cyber mouth audio-wave style simulation */
.talking-mouth-path {
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: talking-wave 1s linear infinite;
}
@keyframes talking-wave {
  to {
    stroke-dashoffset: 0;
  }
}

/* Blinking animations for eyes */
.eye {
  transition: all 0.2s ease;
  transform-origin: center;
}
.animate-blink {
  animation: eye-blink 4s infinite;
}
@keyframes eye-blink {
  0%, 90%, 94%, 98%, 100% {
    transform: scaleY(1);
  }
  92%, 96% {
    transform: scaleY(0.15);
  }
}

/* Floating scanning hologram line */
.scanner-line {
  animation: scan-line 3s linear infinite;
}
@keyframes scan-line {
  0% {
    top: 0%;
  }
  50% {
    top: 100%;
  }
  100% {
    top: 0%;
  }
}

/* Animations */
.animate-bounce-slow {
  animation: bounce-slow 2.5s infinite;
}
@keyframes bounce-slow {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.animate-float-sprite {
  animation: float-sprite 3.5s ease-in-out infinite;
}
@keyframes float-sprite {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

/* Slide fade transition */
.slide-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-fade-leave-active {
  transition: all 0.25s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(20px) scale(0.95);
  opacity: 0;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
