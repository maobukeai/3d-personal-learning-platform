<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Sparkles } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useSystemStore } from '@/stores/system';
import { useSpriteChatStore } from '@/stores/spriteChat';
import { useSpriteDraggable } from '@/composables/useSpriteDraggable';
import { preferences } from '@/utils/preferences';
import { logError } from '@/utils/error';
import api from '@/utils/api';
import SpriteSidebar from './aiSprite/SpriteSidebar.vue';
import SpriteChatArea from './aiSprite/SpriteChatArea.vue';
import SpriteUsageDialog from './aiSprite/SpriteUsageDialog.vue';

import('md-editor-v3/lib/style.css');

const systemStore = useSystemStore();
const chatStore = useSpriteChatStore();
const route = useRoute();
const router = useRouter();

// Deconstruct reactive states from Pinia store
const {
  currentSessionId,
  inputMessage,
  uploadedImages,
  chatMode,
  selectedModelId,
  historySearch,
  copiedIndex,
  isUploading,
  uploadError,
  isGeneratingMap,
  isTypingMap,
  availableAiModels,
  currentModel,
  chatSessions,
  activeSessionMessages,
  recentPrompts,
  currentConversationTitle,
  currentConversationMeta,
  shouldShowLandingState,
  isVip,
  vipPlanName,
} = storeToRefs(chatStore);

// Deconstruct actions from Pinia store
const {
  selectSession,
  startNewChat,
  deleteSession,
  loadHistory,
  handleUploadFiles,
  handlePaste,
  removeUploadedImage,
  handleStop,
  handleSend,
  clearHistory,
  regenerateResponse,
  editMessage,
  setUnloading,
  resumePendingRuns,
} = chatStore;

const goToBilling = () => {
  isOpen.value = false;
  router.push('/billing');
};

// UI and layout local states
const isOpen = ref(false);
const showBubble = ref(localStorage.getItem('ai_bubble_dismissed') !== 'true');
const showModelDropdown = ref(false);
const chatAreaRef = ref<InstanceType<typeof SpriteChatArea> | null>(null);
const isDark = ref(document.documentElement.classList.contains('dark'));

// Usage Dialog States & Logic
const showUsageDialog = ref(false);
const loadingUsage = ref(false);
const usageData = ref<{
  usedToday: number;
  dailyLimit: number;
  planName: string;
  planDisplayName: string;
} | null>(null);
const usageError = ref('');

const fetchUsageLimit = async () => {
  loadingUsage.value = true;
  usageError.value = '';
  usageData.value = null;
  showUsageDialog.value = true;
  try {
    const response = await api.get('/api/projects/ai-chat/usage');
    if (response.data && response.data.success) {
      usageData.value = response.data.data;
    } else {
      usageError.value = response.data?.message || '获取额度数据失败，请重试';
    }
  } catch (error: unknown) {
    logError(error, { operation: 'ai.fetchUsage', component: 'AISprite' });
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    const apiError =
      err?.response?.data?.message || err?.message || '请求发送失败，请检查网络或刷新重试';
    usageError.value = apiError;
  } finally {
    loadingUsage.value = false;
  }
};

const handleUpgradeClick = () => {
  showUsageDialog.value = false;
  goToBilling();
};

const isFullscreen = ref(false);
const width = ref(preferences.getAiSpriteWidth());
const height = ref(preferences.getAiSpriteHeight());
const showMobileSidebar = ref(false);
const windowWidth = ref(window.innerWidth);

const isMobile = computed(() => windowWidth.value < 768);

const {
  spriteX,
  spriteY,
  offsetX,
  offsetY,
  isDraggingSprite,
  hasDraggedSprite,
  startDrag,
  startDragSprite,
  startDragSpriteTouch,
  clampSpritePosition,
} = useSpriteDraggable(isMobile, isFullscreen);

const updateWindowSize = () => {
  windowWidth.value = window.innerWidth;
  clampSpritePosition();
};

// Resize logic
let isResizing = false;
let startWidth = 0;
let startHeight = 0;
let startResizeX = 0;
let startResizeY = 0;

const startResize = (event: MouseEvent) => {
  if (isFullscreen.value || isMobile.value) return;

  isResizing = true;
  startWidth = width.value;
  startHeight = height.value;
  startResizeX = event.clientX;
  startResizeY = event.clientY;

  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
};

const handleResize = (event: MouseEvent) => {
  if (!isResizing) return;
  const deltaX = event.clientX - startResizeX;
  const deltaY = event.clientY - startResizeY;

  width.value = Math.max(500, Math.min(window.innerWidth - 40, startWidth + deltaX));
  height.value = Math.max(400, Math.min(window.innerHeight - 40, startHeight + deltaY));
};

const stopResize = () => {
  isResizing = false;
  preferences.setAiSpriteDimensions(width.value, height.value);
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
};

const handleSpriteClick = () => {
  if (hasDraggedSprite.value) return;
  isOpen.value = !isOpen.value;
};

const handleDocumentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.model-select-dropdown-container')) {
    showModelDropdown.value = false;
  }
};

const copyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
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
  } catch (error) {
    document.body.removeChild(textarea);
    return Promise.reject(error);
  }
};

const copyMessage = (text: string, id: string) => {
  copyToClipboard(text)
    .then(() => {
      copiedIndex.value = id;
      setTimeout(() => {
        if (copiedIndex.value === id) {
          copiedIndex.value = null;
        }
      }, 1800);
    })
    .catch((error) => {
      logError(error, { operation: 'ai.copyMessage', component: 'AISprite' });
    });
};

const scrollToBottom = () => {
  chatAreaRef.value?.scrollToBottom();
};

let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
let darkObserver: MutationObserver | null = null;

onMounted(() => {
  chatStore.onScrollToBottom = scrollToBottom;
  setUnloading(false);

  bubbleTimer = setTimeout(() => {
    showBubble.value = false;
    localStorage.setItem('ai_bubble_dismissed', 'true');
  }, 7000);

  window.addEventListener('click', handleDocumentClick);
  window.addEventListener('resize', updateWindowSize);
  window.addEventListener('ai-chat-history-updated', loadHistory);

  darkObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark');
  });
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  // Load guest or authenticated history
  loadHistory();
  // Resume any unfinished streaming/polling tasks
  resumePendingRuns();
});

onUnmounted(() => {
  chatStore.onScrollToBottom = null;
  setUnloading(true);

  // Abort active streaming connections on clean-up
  handleStop();

  stopResize();
  window.removeEventListener('click', handleDocumentClick);
  window.removeEventListener('resize', updateWindowSize);
  window.removeEventListener('ai-chat-history-updated', loadHistory);

  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
  }
  darkObserver?.disconnect();
});
</script>

<template>
  <div
    v-if="systemStore.settings.AI_IMPORT_ENABLED"
    class="fixed z-[99]"
    :class="[spriteX === null ? 'bottom-5 right-5' : '']"
    :style="spriteX !== null ? { left: spriteX + 'px', top: spriteY + 'px' } : {}"
  >
    <Transition name="fade">
      <div
        v-if="showBubble && !isOpen"
        class="pointer-events-none absolute bottom-[84px] right-0 w-64 rounded-3xl border px-4 py-3 text-xs font-medium leading-5 shadow-xl"
        style="
          background: rgba(255, 255, 255, 0.94);
          border-color: rgba(244, 114, 182, 0.18);
          color: var(--text-secondary);
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
        "
      >
        需要帮忙吗？随时打开 AI 助手 ✨
      </div>
    </Transition>

    <Transition name="panel-fade">
      <div
        v-if="isOpen"
        :class="[
          'fixed inset-0 z-[100] flex items-center justify-center transition-all duration-200',
          isFullscreen || isMobile ? 'p-0' : 'p-3 md:p-5 pointer-events-none',
        ]"
      >
        <div class="ai-overlay absolute inset-0 pointer-events-auto" @click="isOpen = false"></div>

        <div
          :class="[
            'ai-shell relative flex overflow-hidden border pointer-events-auto shadow-2xl transition-all duration-200',
            isFullscreen || isMobile
              ? 'w-full h-full rounded-none border-none max-w-none max-h-none'
              : 'rounded-[24px]',
          ]"
          :style="
            isFullscreen || isMobile
              ? {}
              : {
                  width: width + 'px',
                  height: height + 'px',
                  transform: `translate(${offsetX}px, ${offsetY}px)`,
                }
          "
        >
          <SpriteSidebar
            v-model:show-mobile-sidebar="showMobileSidebar"
            v-model:history-search="historySearch"
            :is-mobile="isMobile"
            :current-session-id="currentSessionId"
            :recent-prompts="recentPrompts"
            :chat-sessions="chatSessions"
            :is-vip="isVip"
            :vip-plan-name="vipPlanName"
            @new-session="startNewChat"
            @select-session="selectSession"
            @delete-session="deleteSession"
            @fetch-usage="fetchUsageLimit"
            @go-to-billing="goToBilling"
          />

          <SpriteChatArea
            ref="chatAreaRef"
            v-model:show-mobile-sidebar="showMobileSidebar"
            v-model:is-fullscreen="isFullscreen"
            v-model:is-open="isOpen"
            v-model:input-message="inputMessage"
            v-model:chat-mode="chatMode"
            v-model:show-model-dropdown="showModelDropdown"
            :is-mobile="isMobile"
            :current-conversation-title="currentConversationTitle"
            :current-conversation-meta="currentConversationMeta"
            :should-show-landing-state="shouldShowLandingState"
            :active-session-messages="activeSessionMessages"
            :current-session-id="currentSessionId"
            :is-generating="isGeneratingMap[currentSessionId]"
            :is-typing="isTypingMap[currentSessionId]"
            :uploaded-images="uploadedImages"
            :is-uploading="isUploading"
            :upload-error="uploadError"
            :available-ai-models="availableAiModels"
            :current-model="currentModel"
            :is-dark="isDark"
            :copied-index="copiedIndex"
            @select-model="selectedModelId = $event"
            @start-new-chat="startNewChat"
            @clear-history="clearHistory"
            @copy-message="copyMessage"
            @regenerate-response="regenerateResponse"
            @drag-start="startDrag"
            @upload-files="handleUploadFiles"
            @remove-image="removeUploadedImage"
            @handle-send="handleSend(route.path)"
            @handle-stop="handleStop()"
            @paste="handlePaste"
            @edit-message="editMessage"
          />

          <!-- Resize Handle (Desktop floating window only) -->
          <div
            v-if="!isFullscreen && !isMobile"
            class="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize z-50 flex items-end justify-end p-0.5"
            @mousedown.stop="startResize"
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              class="text-slate-400 dark:text-slate-600"
            >
              <line
                x1="6"
                y1="1"
                x2="1"
                y2="6"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <line
                x1="7"
                y1="4"
                x2="4"
                y2="7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </Transition>

    <button
      v-if="!isOpen"
      type="button"
      class="ai-trigger group relative flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-full border text-white shadow-[0_22px_44px_rgba(244,114,182,0.32)] transition hover:-translate-y-1"
      :class="{ 'cursor-grabbing': isDraggingSprite, 'cursor-grab': !isDraggingSprite }"
      @click="handleSpriteClick"
      @mousedown="startDragSprite"
      @touchstart="startDragSpriteTouch"
    >
      <div
        class="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.28),transparent_48%)]"
      ></div>
      <Sparkles class="relative z-10 h-6 w-6 transition group-hover:scale-110" />
    </button>

    <!-- AI Usage Dialog -->
    <SpriteUsageDialog
      v-model="showUsageDialog"
      :loading="loadingUsage"
      :error="usageError"
      :data="usageData"
      @upgrade="handleUpgradeClick"
      @retry="fetchUsageLimit"
    />
  </div>
</template>

<style scoped>
.ai-overlay {
  background:
    radial-gradient(circle at top left, rgba(244, 114, 182, 0.08), transparent 32%),
    rgba(248, 250, 252, 0.5);
  backdrop-filter: blur(8px);
}

.ai-shell {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.96) 0%,
    rgba(255, 251, 248, 0.98) 58%,
    rgba(255, 255, 255, 0.94) 100%
  );
  border-color: rgba(255, 255, 255, 0.7);
  box-shadow: 0 35px 80px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(24px);
}

.dark .ai-shell {
  background: linear-gradient(
    135deg,
    rgba(15, 23, 42, 0.94) 0%,
    rgba(30, 41, 59, 0.96) 58%,
    rgba(17, 24, 39, 0.94) 100%
  );
  border-color: rgba(148, 163, 184, 0.16);
}

.ai-sidebar {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.74) 0%, rgba(255, 250, 247, 0.88) 100%);
  backdrop-filter: blur(18px);
}

.dark .ai-sidebar {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.88) 100%);
}

.ai-main {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.58) 0%, rgba(255, 253, 251, 0.88) 100%);
}

.dark .ai-main {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.34) 0%, rgba(15, 23, 42, 0.7) 100%);
}

.ai-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  width: 34px;
  border-radius: 12px;
  color: #ffffff !important;
  background: linear-gradient(135deg, #60a5fa 0%, var(--accent) 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 8px 16px rgba(var(--accent-rgb), 0.2) !important;
  transition: all 0.3s ease;
}

.ai-logo:hover {
  transform: scale(1.05);
  box-shadow: 0 10px 20px rgba(var(--accent-rgb), 0.3) !important;
}

.dark .ai-logo {
  color: var(--accent) !important;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.9) 0%,
    rgba(15, 23, 42, 0.95) 100%
  ) !important;
  border: 1px solid rgba(var(--accent-rgb), 0.35) !important;
  box-shadow:
    0 8px 20px rgba(var(--accent-rgb), 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

.dark .ai-logo:hover {
  border-color: rgba(var(--accent-rgb), 0.5) !important;
  box-shadow:
    0 10px 24px rgba(var(--accent-rgb), 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
}

.ai-logo--small {
  height: 30px;
  width: 30px;
  border-radius: 10px;
}

.ai-empty-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88px;
  width: 88px;
  border-radius: 999px;
  color: var(--accent);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(var(--accent-rgb), 0.05));
  border: 1px solid rgba(var(--accent-rgb), 0.15);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 22px 44px rgba(var(--accent-rgb), 0.08);
}

.dark .ai-empty-badge {
  color: var(--accent);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
  border: 1px solid rgba(var(--accent-rgb), 0.25);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 22px 44px rgba(0, 0, 0, 0.35);
}

.ai-assistant-bubble {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.dark .ai-assistant-bubble {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(148, 163, 184, 0.12);
}

.ai-user-bubble {
  background: var(--accent) !important;
  box-shadow: 0 8px 20px rgba(var(--accent-rgb), 0.15) !important;
}

.ai-user-bubble,
.ai-user-bubble * {
  color: #ffffff !important;
}

.ai-trigger {
  border-color: rgba(255, 255, 255, 0.7) !important;
  background: linear-gradient(135deg, #60a5fa 0%, var(--accent) 100%) !important;
  box-shadow: 0 14px 28px rgba(var(--accent-rgb), 0.25) !important;
  transition: all 0.3s ease;
}

.ai-trigger:hover {
  transform: translateY(-4px) scale(1.05) !important;
  box-shadow: 0 18px 36px rgba(var(--accent-rgb), 0.35) !important;
}

.dark .ai-trigger {
  border-color: rgba(var(--accent-rgb), 0.4) !important;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.9) 0%,
    rgba(15, 23, 42, 0.95) 100%
  ) !important;
  color: var(--accent) !important;
  box-shadow:
    0 14px 28px rgba(var(--accent-rgb), 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

.dark .ai-trigger:hover {
  border-color: rgba(var(--accent-rgb), 0.5) !important;
  box-shadow:
    0 18px 36px rgba(var(--accent-rgb), 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
}

.ai-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.ai-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.ai-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 999px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Dark mode adaptation overrides */
.subscription-card {
  border-color: rgba(251, 191, 36, 0.18) !important;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.92) 0%,
    rgba(255, 247, 237, 0.9) 100%
  ) !important;
}

.dark .subscription-card {
  border-color: rgba(251, 191, 36, 0.1) !important;
  background: linear-gradient(
    180deg,
    rgba(30, 41, 59, 0.8) 0%,
    rgba(15, 23, 42, 0.85) 100%
  ) !important;
}

.subscription-btn {
  background: #0f172a !important;
  color: #ffffff !important;
}

.dark .subscription-btn {
  background: #f5792a !important;
  color: #ffffff !important;
}

.dark .subscription-btn:hover {
  background: #e0661b !important;
}

/* Override global glass input borders on chat textarea */
html.theme-glass .ai-main textarea,
.ai-main textarea {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html.theme-glass .ai-main textarea:focus,
.ai-main textarea:focus {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

/* Ensure clear assistant response text color */
.ai-assistant-bubble {
  color: var(--text-primary) !important;
}

.dark .ai-assistant-bubble {
  color: var(--text-primary) !important;
}

/* Override global glass input borders on transparent search input */
html.theme-glass .ai-sidebar input[type='text'],
.ai-sidebar input[type='text'] {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html.theme-glass .ai-sidebar input[type='text']:focus,
.ai-sidebar input[type='text']:focus {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

/* Custom legible text descriptions */
.subscription-desc {
  color: #64748b !important;
}

.dark .subscription-desc {
  color: #cbd5e1 !important;
}

.thinking-content {
  color: #64748b !important;
}

.dark .thinking-content {
  color: #cbd5e1 !important;
}

/* Input placeholder colors in dark mode */
.ai-main textarea::placeholder {
  color: #94a3b8 !important;
}

.dark .ai-main textarea::placeholder {
  color: #64748b !important;
}

/* Accent-based Send Button */
.ai-send-btn {
  background: var(--accent) !important;
  box-shadow: 0 10px 20px -5px rgba(var(--accent-rgb), 0.3) !important;
}

.ai-send-btn:hover:not(:disabled) {
  opacity: 0.95;
  box-shadow: 0 12px 24px -5px rgba(var(--accent-rgb), 0.45) !important;
}

.ai-send-btn:disabled {
  opacity: 0.45;
  box-shadow: none !important;
}

/* Mobile compaction and drag/resize responsive overrides */
@media (max-width: 767px) {
  .ai-shell {
    border-radius: 0px !important;
  }
  .ai-main header {
    padding-left: 10px !important;
    padding-right: 10px !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }
  .ai-main footer {
    padding-left: 10px !important;
    padding-right: 10px !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }
  .ai-main textarea {
    font-size: 13px !important;
    line-height: 1.5 !important;
    min-height: 50px !important;
  }
  .ai-chat-content {
    padding-left: 12px !important;
    padding-right: 12px !important;
    padding-top: 14px !important;
    padding-bottom: 14px !important;
  }
  .ai-assistant-bubble,
  .ai-user-bubble {
    border-radius: 16px !important;
    padding: 12px 14px !important;
  }
  .thinking-content {
    font-size: 11px !important;
    padding: 8px 10px !important;
    border-radius: 12px !important;
  }
}
</style>
