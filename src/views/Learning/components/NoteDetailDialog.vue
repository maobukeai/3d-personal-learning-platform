<script setup lang="ts">
import { ref, computed, onUnmounted, defineAsyncComponent } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import type { User } from '@/types';
import {
  X,
  Check,
  Copy,
  Star,
  BookOpen,
  Minus,
  Plus,
  Eye,
  Heart,
  Sparkles,
  MessageSquare,
  Trash2,
  Share2,
  Loader2,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar.vue';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { parseTags } from '@/utils/tags';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

interface Note {
  id: string;
  title: string;
  content: string;
  summary?: string;
  visibility: string;
  tags?: string;
  category?: string;
  views: number;
  isPinned: boolean;
  isPopular: boolean;
  isLiked: boolean;
  userId: string;
  _count: { likes: number; comments: number };
  user: { id: string; name: string; avatarUrl: string; bio?: string };
  createdAt: string;
  updatedAt: string;
}

const emit = defineEmits<{
  (e: 'like-updated', data: { id: string; isLiked: boolean; likesCount: number }): void;
  (e: 'popular-updated', data: { id: string; isPopular: boolean }): void;
  (e: 'views-updated', data: { id: string; views: number }): void;
  (e: 'share', note: Note): void;
}>();

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const visible = ref(false);
const detailNote = ref<Note | null>(null);
const isCopying = ref(false);
let progressInterval: ReturnType<typeof setInterval> | null = null;
let fillInterval: ReturnType<typeof setInterval> | null = null;
let copyTimer: ReturnType<typeof setTimeout> | null = null;
let scrollResetTimer: ReturnType<typeof setTimeout> | null = null;

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const handleShowUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleChatWithMember = async (member: User) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [member.id],
      isGroup: false,
    });
    visible.value = false; // Close detail modal
    router.push('/messages');
  } catch (_error) {
    ElMessage.error(t('notes.startChatFailed'));
  }
};

// Reading Panel States
const fontSize = ref(16);
const readProgress = ref(0);
const scrollContainer = ref<HTMLElement | null>(null);

// Comments States & Functions
interface NoteComment {
  id: string;
  userId: string;
  user: { id: string; name: string; avatarUrl?: string | null };
  content: string;
  createdAt: string;
}
const comments = ref<NoteComment[]>([]);
const commentContent = ref('');
const submittingComment = ref(false);
const loadingComments = ref(false);

const fetchComments = async (noteId: string) => {
  loadingComments.value = true;
  try {
    const res = await api.get(`/api/notes/${noteId}/comments`);
    comments.value = res.data;
  } catch {
    ElMessage.error(t('notes.loadCommentsFailed'));
  } finally {
    loadingComments.value = false;
  }
};

const submitComment = async () => {
  if (!detailNote.value) return;
  if (!commentContent.value || !commentContent.value.trim()) {
    ElMessage.warning(t('notes.commentRequired'));
    return;
  }
  submittingComment.value = true;
  try {
    const res = await api.post(`/api/notes/${detailNote.value.id}/comment`, {
      content: commentContent.value.trim(),
    });
    comments.value.push(res.data);
    commentContent.value = '';
    ElMessage.success(t('notes.commentSuccess'));
    if (detailNote.value._count) {
      detailNote.value._count.comments++;
    }
  } catch (err: unknown) {
    ElMessage.error(getApiErrorMessage(err, t('notes.commentFailed')));
  } finally {
    submittingComment.value = false;
  }
};

const handleDeleteComment = async (commentId: string) => {
  try {
    await api.delete(`/api/notes/comment/${commentId}`);
    comments.value = comments.value.filter((c) => c.id !== commentId);
    ElMessage.success(t('notes.commentDeleteSuccess'));
    if (detailNote.value && detailNote.value._count) {
      detailNote.value._count.comments = Math.max(0, detailNote.value._count.comments - 1);
    }
  } catch (err: unknown) {
    ElMessage.error(getApiErrorMessage(err, t('notes.commentDeleteFailed')));
  }
};

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (!target) return;
  const scrollTop = target.scrollTop;
  const scrollHeight = target.scrollHeight;
  const clientHeight = target.clientHeight;
  const totalScroll = scrollHeight - clientHeight;
  if (totalScroll > 0) {
    readProgress.value = Math.min(Math.round((scrollTop / totalScroll) * 100), 100);
  } else {
    readProgress.value = 0;
  }
};

const open = async (note: Note) => {
  sessionSummary.value = '';
  isSummarizing.value = false;
  try {
    const res = await api.get(`/api/notes/${note.id}`);
    detailNote.value = res.data;
    if (res.data.summary && !isFallbackExcerpt(res.data.summary, res.data.content)) {
      sessionSummary.value = res.data.summary;
    } else {
      sessionSummary.value = '';
    }
    visible.value = true;
    readProgress.value = 0;
    // reset scroll to top after modal renders
    scrollResetTimer = setTimeout(() => {
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop = 0;
      }
    }, 50);

    emit('views-updated', {
      id: note.id,
      views: res.data.views,
    });
    emit('like-updated', {
      id: note.id,
      isLiked: res.data.isLiked,
      likesCount: res.data._count.likes,
    });
    fetchComments(note.id);
  } catch {
    ElMessage.error(t('notes.loadDetailFailed'));
  }
};

const handleLike = async () => {
  if (!detailNote.value) return;
  try {
    const res = await api.post(`/api/notes/${detailNote.value.id}/like`);
    detailNote.value.isLiked = res.data.isLiked;
    if (res.data.isLiked) {
      detailNote.value._count.likes++;
    } else {
      detailNote.value._count.likes--;
    }
    emit('like-updated', {
      id: detailNote.value.id,
      isLiked: detailNote.value.isLiked,
      likesCount: detailNote.value._count.likes,
    });
  } catch {
    ElMessage.error(t('notes.operationFailed'));
  }
};

const handleTogglePopular = async () => {
  if (!detailNote.value) return;
  try {
    const res = await api.post(`/api/notes/${detailNote.value.id}/popular`);
    detailNote.value.isPopular = res.data.isPopular;
    ElMessage.success(
      detailNote.value.isPopular ? t('notes.popularRecommended') : t('notes.popularCancelled'),
    );
    emit('popular-updated', {
      id: detailNote.value.id,
      isPopular: detailNote.value.isPopular,
    });
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('notes.operationFailed')));
  }
};

const handleCopy = async () => {
  if (!detailNote.value) return;
  try {
    await navigator.clipboard.writeText(detailNote.value.content);
    isCopying.value = true;
    ElMessage.success(t('notes.copiedToClipboard'));
    copyTimer = setTimeout(() => {
      isCopying.value = false;
    }, 2000);
  } catch {
    ElMessage.error(t('notes.copyFailed'));
  }
};

const changeFontSize = (delta: number) => {
  const newSize = fontSize.value + delta;
  if (newSize >= 12 && newSize <= 24) {
    fontSize.value = newSize;
  }
};

const isFallbackExcerpt = (summary: string, content: string): boolean => {
  if (!summary || !content) return false;
  const cleanStr = (str: string) => str.replace(/[#*`>_\-[\]()+:\s\r\n.,，。！!？?、]/g, '');
  const cleanSummary = cleanStr(summary);
  const cleanContent = cleanStr(content);
  return cleanContent.includes(cleanSummary) && cleanContent.indexOf(cleanSummary) < 150;
};

const isSummarizing = ref(false);
const sessionSummary = ref('');
const summaryProgress = ref(0);

const currentThinkingStep = computed(() => {
  const percent = summaryProgress.value;
  if (percent < 12) return t('notes.thinkingStep1');
  if (percent < 25) return t('notes.thinkingStep2');
  if (percent < 38) return t('notes.thinkingStep3');
  if (percent < 50) return t('notes.thinkingStep4');
  if (percent < 65) return t('notes.thinkingStep5');
  if (percent < 80) return t('notes.thinkingStep6');
  if (percent < 92) return t('notes.thinkingStep7');
  return t('notes.thinkingStep8');
});

const generateAiSummary = async () => {
  if (!detailNote.value || isSummarizing.value) return;
  isSummarizing.value = true;
  summaryProgress.value = 0;
  sessionSummary.value = '';

  progressInterval = setInterval(() => {
    if (summaryProgress.value < 40) {
      summaryProgress.value += Math.floor(Math.random() * 3) + 2; // 2-4%
    } else if (summaryProgress.value < 70) {
      summaryProgress.value += Math.floor(Math.random() * 2) + 1; // 1-2%
    } else if (summaryProgress.value < 90) {
      if (Math.random() > 0.4) {
        summaryProgress.value += 1;
      }
    } else if (summaryProgress.value < 99) {
      if (Math.random() > 0.7) {
        summaryProgress.value += 1;
      }
    }
  }, 150);

  try {
    const res = await api.post(`/api/notes/${detailNote.value.id}/ai-summarize`);
    if (res.data && res.data.summary) {
      clearInterval(progressInterval);
      // Smoothly accelerate to 100%
      const fillProgress = () => {
        return new Promise<void>((resolve) => {
          fillInterval = setInterval(() => {
            if (summaryProgress.value < 100) {
              summaryProgress.value += Math.min(5, 100 - summaryProgress.value);
            } else {
              if (fillInterval) clearInterval(fillInterval);
              resolve();
            }
          }, 30);
        });
      };
      await fillProgress();
      await new Promise((resolve) => setTimeout(resolve, 200));
      sessionSummary.value = res.data.summary;
    } else {
      clearInterval(progressInterval);
      ElMessage.error(t('notes.aiSummaryEmpty'));
    }
  } catch (err: unknown) {
    clearInterval(progressInterval);
    ElMessage.error(getApiErrorMessage(err, t('notes.aiSummaryFailed')));
  } finally {
    isSummarizing.value = false;
  }
};

onUnmounted(() => {
  if (progressInterval) clearInterval(progressInterval);
  if (fillInterval) clearInterval(fillInterval);
  if (copyTimer) clearTimeout(copyTimer);
  if (scrollResetTimer) clearTimeout(scrollResetTimer);
});

defineExpose({ open });
</script>

<template>
  <Modal :show="visible" size="xxl" padding="none" glass-card @close="visible = false">
    <div
      v-if="detailNote"
      class="flex flex-col md:flex-row h-screen md:h-[88vh] overflow-hidden relative rounded-none md:rounded-3xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl"
    >
      <!-- Global Close Button (Top Right of the entire Dialog Container) -->
      <button
        type="button"
        class="dialog-close-btn absolute top-4 right-4 z-50 flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-base)] bg-[var(--bg-card)]/80 backdrop-blur-xs hover:bg-slate-100 dark:hover:bg-zinc-800 text-[var(--text-secondary)] transition-all active:scale-90 shadow-md cursor-pointer"
        :title="t('notes.closeReading')"
        @click="visible = false"
      >
        <X class="w-4 h-4" />
      </button>

      <!-- Side Dashboard Panel -->
      <aside
        class="hidden md:flex w-64 p-5 flex-col shrink-0 border-r relative z-10 select-none bg-slate-50/70 dark:bg-zinc-900/60 backdrop-blur-md"
        style="border-color: var(--border-base)"
      >
        <!-- User Information Dashboard (Clickable) -->
        <div
          class="mb-4 p-3 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center gap-3 shadow-xs cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all"
          :title="t('notes.viewAuthorProfile')"
          @click="handleShowUserProfile(detailNote.user.id)"
        >
          <UserAvatar
            :user="detailNote.user"
            size="sm"
            md-size="md"
            class="shrink-0 ring-2 ring-accent/10 hover:scale-105 transition-all"
          />
          <div class="min-w-0">
            <h4
              class="font-black text-xs text-[var(--text-primary)] leading-tight flex items-center gap-1.5 hover:text-accent transition-colors"
            >
              {{ detailNote.user.name }}
              <span
                class="text-[8px] font-black px-1.5 py-0.2 bg-purple-500/10 dark:bg-purple-400/10 text-purple-600 dark:text-purple-400 rounded"
                >{{ t('notes.author') }}</span
              >
            </h4>
            <p class="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-1 leading-relaxed">
              {{ detailNote.user.bio || t('notes.explorer') }}
            </p>
          </div>
        </div>

        <!-- Metrics & Details Panel -->
        <div class="space-y-4 overflow-y-auto pr-1 scrollbar-hide flex-1">
          <!-- Metrics -->
          <div
            class="bg-[var(--bg-card)] border border-[var(--border-base)] p-3 rounded-2xl shadow-xs"
          >
            <p
              class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2.5"
            >
              {{ t('notes.articleDashboard') }}
            </p>
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-slate-50 dark:bg-zinc-800/40 p-2 rounded-xl text-center">
                <span class="text-[9px] text-[var(--text-muted)] block">{{
                  t('notes.viewsUnit')
                }}</span>
                <span
                  class="text-xs font-black text-[var(--text-primary)] flex items-center justify-center gap-1 mt-0.5"
                  ><Eye class="w-3 h-3 text-[var(--text-muted)]" />{{ detailNote.views }}</span
                >
              </div>
              <div class="bg-slate-50 dark:bg-zinc-800/40 p-2 rounded-xl text-center">
                <span class="text-[9px] text-[var(--text-muted)] block">{{
                  t('notes.likesUnit')
                }}</span>
                <span
                  class="text-xs font-black text-[var(--text-primary)] flex items-center justify-center gap-1 mt-0.5"
                  ><Heart class="w-3 h-3 text-rose-500" />{{ detailNote._count.likes }}</span
                >
              </div>
            </div>
          </div>

          <!-- Reading ToolBox -->
          <div
            class="bg-[var(--bg-card)] border border-[var(--border-base)] p-3 rounded-2xl shadow-xs space-y-3"
          >
            <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">
              {{ t('notes.typography') }}
            </p>

            <!-- Font Sizer -->
            <div class="flex items-center justify-between text-xs">
              <span class="text-[10px] font-medium text-[var(--text-secondary)]">{{
                t('notes.fontSize')
              }}</span>
              <div
                class="flex items-center gap-1 bg-slate-50 dark:bg-zinc-800/40 rounded-lg p-0.5 border border-[var(--border-base)]"
              >
                <button
                  type="button"
                  class="w-5 h-5 flex items-center justify-center hover:bg-[var(--bg-card)] rounded text-[var(--text-secondary)] transition-all cursor-pointer"
                  @click="changeFontSize(-1)"
                >
                  <Minus class="w-2.5 h-2.5" />
                </button>
                <span class="text-[10px] font-black px-1 text-[var(--text-primary)]"
                  >{{ fontSize }}px</span
                >
                <button
                  type="button"
                  class="w-5 h-5 flex items-center justify-center hover:bg-[var(--bg-card)] rounded text-[var(--text-secondary)] transition-all cursor-pointer"
                  @click="changeFontSize(1)"
                >
                  <Plus class="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Tags & Category Panel -->
          <div
            class="bg-[var(--bg-card)] border border-[var(--border-base)] p-3 rounded-2xl shadow-xs"
          >
            <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {{ t('notes.notebookTags') }}
            </p>
            <div class="flex flex-wrap gap-1">
              <span
                v-if="detailNote.category"
                class="px-2 py-0.5 rounded-lg bg-accent/10 border border-accent/15 text-accent text-[9px] font-black"
                >{{ detailNote.category }}</span
              >
              <span
                v-for="tag in parseTags(detailNote.tags)"
                :key="tag"
                class="px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-zinc-800/40 text-[var(--text-secondary)] text-[9px] font-black border border-[var(--border-base)]"
                >#{{ tag }}</span
              >
            </div>
          </div>
        </div>

        <!-- Core Call-to-Actions -->
        <div class="flex flex-col pt-3 border-t border-[var(--border-base)] gap-2">
          <Button
            v-if="authStore.user?.role === 'ADMIN' && detailNote.visibility === 'PUBLIC'"
            :variant="detailNote.isPopular ? 'glass' : 'secondary'"
            size="sm"
            full-width
            :class="detailNote.isPopular ? '!text-amber-500 !border-amber-500/30 !bg-amber-500/10 hover:!bg-amber-500/15 dark:!bg-amber-500/20' : ''"
            @click="handleTogglePopular"
          >
            <Star class="w-3.5 h-3.5 mr-1.5" :class="{ 'fill-current': detailNote.isPopular }" />
            <span>{{
              detailNote.isPopular
                ? t('notes.popularRecommendedShort')
                : t('notes.recommendPopular')
            }}</span>
          </Button>

          <Button
            :variant="detailNote.isLiked ? 'glass' : 'secondary'"
            size="sm"
            full-width
            :class="detailNote.isLiked ? '!text-rose-500 !border-rose-500/30 !bg-rose-500/10 hover:!bg-rose-500/15 dark:!bg-rose-500/20' : ''"
            @click="handleLike"
          >
            <Heart class="w-3.5 h-3.5 mr-1.5" :class="{ 'fill-current': detailNote.isLiked }" />
            <span>{{ detailNote.isLiked ? t('notes.liked') : t('notes.likeNote') }}</span>
          </Button>

          <Button
            v-if="detailNote.userId === authStore.user?.id"
            variant="secondary"
            size="sm"
            full-width
            @click="emit('share', detailNote)"
          >
            <Share2 class="w-3.5 h-3.5 mr-1.5" />
            <span>{{ t('notes.shareNote') }}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            full-width
            @click="handleCopy"
          >
            <component :is="isCopying ? Check : Copy" class="w-3.5 h-3.5 mr-1.5" />
            <span>{{ isCopying ? t('notes.copied') : t('notes.copyFullText') }}</span>
          </Button>
        </div>
      </aside>

      <!-- Right Main Reading Canvas -->
      <div
        ref="scrollContainer"
        class="flex-1 overflow-y-auto custom-scrollbar relative flex flex-col bg-white/20 dark:bg-zinc-900/20 text-[var(--text-primary)]"
        @scroll="handleScroll"
      >
        <!-- Floating Reading Progress Indicator -->
        <div class="sticky top-0 left-0 right-0 z-50 h-0.5 bg-slate-100/50 dark:bg-zinc-800/50">
          <div
            class="h-full bg-gradient-to-r from-purple-500 via-accent to-indigo-500 transition-all duration-100"
            :style="{ width: readProgress + '%' }"
          />
        </div>

        <div
          class="dialog-content-wrapper max-w-[760px] w-full mx-auto px-3 sm:px-8 pt-14 pb-6 sm:py-10 flex-1 flex flex-col justify-between"
        >
          <!-- Article Body -->
          <div>
            <!-- Mobile Author Info Header (Visible only on mobile) -->
            <div
              class="md:hidden flex items-center justify-between border-b pb-3 mb-4 border-[var(--border-base)]"
            >
              <div
                class="flex items-center gap-2.5 min-w-0 cursor-pointer"
                @click="handleShowUserProfile(detailNote.user.id)"
              >
                <UserAvatar
                  :user="detailNote.user"
                  size="sm"
                  class="shrink-0 ring-2 ring-accent/10"
                />
                <div class="min-w-0">
                  <h4
                    class="font-black text-xs text-[var(--text-primary)] leading-none flex items-center gap-1"
                  >
                    {{ detailNote.user.name }}
                    <span
                      class="text-[8px] font-black px-1.5 py-0.2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded"
                      >{{ t('notes.author') }}</span
                    >
                  </h4>
                  <p class="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-1 leading-relaxed">
                    {{ detailNote.user.bio || t('notes.explorer') }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-black">
                <span class="flex items-center gap-0.5"
                  ><Eye class="w-3 h-3" /> {{ detailNote.views }}</span
                >
                <span class="flex items-center gap-0.5"
                  ><Heart class="w-3 h-3 text-rose-500" /> {{ detailNote._count.likes }}</span
                >
              </div>
            </div>

            <header
              class="border-b border-dashed pb-2 mb-3 sm:pb-3 sm:mb-3 border-[var(--border-base)]"
            >
              <h1
                class="text-xl sm:text-2xl md:text-3xl font-black leading-tight tracking-tight mb-2.5"
              >
                {{ detailNote.title }}
              </h1>

              <!-- Dynamic AI summary -->
              <div
                class="rounded-xl p-2.5 text-xs leading-relaxed border bg-slate-50/40 dark:bg-zinc-900/10 border-[var(--border-base)] text-[var(--text-secondary)]"
              >
                <div class="flex items-center justify-between">
                  <div
                    class="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-primary)]"
                  >
                    <Sparkles class="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span>{{ t('notes.coreSummary') }}</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    :loading="isSummarizing"
                    @click="generateAiSummary"
                  >
                    <Sparkles v-if="!isSummarizing" class="w-3.5 h-3.5 mr-1" />
                    <span>{{
                      isSummarizing
                        ? t('notes.summarizing')
                        : sessionSummary
                          ? t('notes.regenerate')
                          : t('notes.generateAiSummary')
                    }}</span>
                  </Button>
                </div>

                <div
                  v-if="sessionSummary"
                  class="text-[var(--text-secondary)] mt-2 whitespace-pre-wrap leading-normal"
                >
                  {{ sessionSummary }}
                </div>
                <div v-else-if="isSummarizing" class="mt-2.5 space-y-1.5">
                  <div
                    class="flex items-center justify-between text-[10px] text-[var(--text-muted)]"
                  >
                    <span class="flex items-center gap-1.5 font-bold text-[var(--text-secondary)]">
                      <Loader2 class="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                      {{ t('notes.aiThinking', { step: currentThinkingStep }) }}
                    </span>
                    <span class="font-bold text-[var(--accent)]">{{ summaryProgress }}%</span>
                  </div>
                  <div
                    class="h-1 w-full bg-slate-200/50 dark:bg-zinc-800 rounded-full overflow-hidden"
                  >
                    <div
                      class="h-full bg-[var(--accent)] rounded-full transition-all duration-300 ease-out"
                      :style="{ width: `${summaryProgress}%` }"
                    ></div>
                  </div>
                </div>
                <div v-else class="text-[var(--text-muted)] text-[10.5px] mt-1.5 py-0.5">
                  {{ t('notes.awaitingSummary') }}
                </div>
              </div>
            </header>

            <!-- Markdown Text Rendering -->
            <div
              class="modern-markdown-content min-h-[300px] markdown-theme-default"
              :style="{ fontSize: fontSize + 'px' }"
            >
              <MarkdownEditor :model-value="detailNote.content" preview-only />
            </div>

            <!-- Mobile Toolbox & Actions (Visible only on mobile) -->
            <div
              class="md:hidden mt-3 p-2.5 rounded-xl border border-[var(--border-base)] bg-slate-50/50 dark:bg-white/[0.02] space-y-2"
            >
              <!-- Personalized typography font size -->
              <div
                class="flex items-center justify-between text-[11px] pb-1.5 border-b border-[var(--border-base)]"
              >
                <span class="font-bold text-[var(--text-secondary)]">{{
                  t('notes.fontSizeAdjust')
                }}</span>
                <div
                  class="flex items-center gap-0.5 bg-slate-50 dark:bg-zinc-800/40 rounded-lg p-0.5 border border-[var(--border-base)]"
                >
                  <button
                    type="button"
                    class="w-5 h-5 flex items-center justify-center hover:bg-[var(--bg-card)] rounded text-[var(--text-secondary)] transition-all cursor-pointer"
                    @click="changeFontSize(-1)"
                  >
                    <Minus class="w-2.5 h-2.5" />
                  </button>
                  <span class="text-[10px] font-black px-1.5 text-[var(--text-primary)]"
                    >{{ fontSize }}px</span
                  >
                  <button
                    type="button"
                    class="w-5 h-5 flex items-center justify-center hover:bg-[var(--bg-card)] rounded text-[var(--text-secondary)] transition-all cursor-pointer"
                    @click="changeFontSize(1)"
                  >
                    <Plus class="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-if="authStore.user?.role === 'ADMIN' && detailNote.visibility === 'PUBLIC'"
                  type="button"
                  class="flex-1 min-w-[70px] flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all active:scale-95 cursor-pointer bg-[var(--bg-card)]"
                  :class="
                    detailNote.isPopular
                      ? 'bg-amber-500/10 border-amber-500/25 text-amber-500'
                      : 'bg-transparent border-[var(--border-base)] text-[var(--text-secondary)]'
                  "
                  @click="handleTogglePopular"
                >
                  <Star class="w-3 h-3" :class="{ 'fill-current': detailNote.isPopular }" />
                  <span>{{
                    detailNote.isPopular ? t('notes.popularHot') : t('notes.recommendPopular')
                  }}</span>
                </button>

                <button
                  type="button"
                  class="flex-1 min-w-[70px] flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all active:scale-95 cursor-pointer bg-[var(--bg-card)]"
                  :class="
                    detailNote.isLiked
                      ? 'bg-rose-500/10 border-rose-500/25 text-rose-500'
                      : 'bg-transparent border-[var(--border-base)] text-[var(--text-secondary)]'
                  "
                  @click="handleLike"
                >
                  <Heart class="w-3 h-3" :class="{ 'fill-current': detailNote.isLiked }" />
                  <span>{{ detailNote.isLiked ? t('notes.liked') : t('notes.like') }}</span>
                </button>

                <button
                  v-if="detailNote.userId === authStore.user?.id"
                  type="button"
                  class="flex-1 min-w-[70px] flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border border-[var(--border-base)] text-[var(--text-secondary)] bg-[var(--bg-card)] transition-all active:scale-95 cursor-pointer shadow-2xs"
                  @click="emit('share', detailNote)"
                >
                  <Share2 class="w-3 h-3" />
                  <span>{{ t('notes.share') }}</span>
                </button>

                <button
                  type="button"
                  class="flex-1 min-w-[70px] flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border border-[var(--border-base)] text-[var(--text-secondary)] bg-[var(--bg-card)] transition-all active:scale-95 cursor-pointer shadow-2xs"
                  @click="handleCopy"
                >
                  <component :is="isCopying ? Check : Copy" class="w-3 h-3" />
                  <span>{{ isCopying ? t('notes.copied') : t('notes.copyFullText') }}</span>
                </button>
              </div>

              <!-- Tags list on mobile -->
              <div
                v-if="parseTags(detailNote.tags).length || detailNote.category"
                class="pt-2 border-t border-[var(--border-base)]"
              >
                <div class="flex flex-wrap gap-1">
                  <span
                    v-if="detailNote.category"
                    class="px-1.5 py-0.2 rounded-md bg-accent/10 border border-accent/15 text-accent text-[9px] font-black"
                    >{{ detailNote.category }}</span
                  >
                  <span
                    v-for="tag in parseTags(detailNote.tags)"
                    :key="tag"
                    class="px-1.5 py-0.2 rounded-md bg-slate-50 dark:bg-zinc-800/40 text-[var(--text-secondary)] text-[9px] font-black border border-[var(--border-base)]"
                    >#{{ tag }}</span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Note Comments Section -->
          <div
            class="mt-8 pt-6 sm:mt-12 sm:pt-8 border-t border-[var(--border-base)] space-y-4 sm:space-y-6"
          >
            <div class="flex items-center justify-between">
              <h3
                class="text-sm font-bold flex items-center gap-2"
                style="color: var(--text-primary)"
              >
                <MessageSquare class="w-4 h-4 text-accent" />
                <span>{{ t('notes.commentsCount', { n: comments.length }) }}</span>
              </h3>
            </div>

            <!-- Comment Input -->
            <div v-if="authStore.isAuthenticated" class="flex items-start gap-2.5">
              <UserAvatar :user="authStore.user" size="sm" class="shrink-0 w-6 h-6" />
              <div class="flex-1 space-y-2">
                <textarea
                  v-model="commentContent"
                  rows="3"
                  :placeholder="t('notes.commentPlaceholder')"
                  maxlength="500"
                  class="w-full text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:outline-none bg-slate-50 dark:bg-zinc-900 border border-[var(--border-base)] text-[var(--text-primary)] focus:border-accent p-3 focus:ring-2 focus:ring-accent/20"
                ></textarea>
                <div class="text-[10px] text-[var(--text-muted)] text-right mt-0.5">
                  {{ commentContent.length }} / 500
                </div>
                <div class="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    class="font-bold"
                    :loading="submittingComment"
                    @click="submitComment"
                  >
                    {{ t('notes.publishComment') }}
                  </Button>
                </div>
              </div>
            </div>
            <div
              v-else
              class="p-4 bg-slate-50 dark:bg-white/5 border border-dashed border-[var(--border-base)] rounded-2xl text-center"
            >
              <p class="text-xs text-[var(--text-muted)] mb-2.5">{{ t('notes.loginToComment') }}</p>
              <Button
                variant="primary"
                size="sm"
                class="font-bold"
                @click="
                  visible = false;
                  router.push('/login');
                "
              >
                {{ t('notes.goLogin') }}
              </Button>
            </div>

            <!-- Comments List -->
            <div v-loading="loadingComments" class="space-y-4">
              <div
                v-if="comments.length === 0"
                class="text-center py-6 text-xs text-[var(--text-muted)]"
              >
                {{ t('notes.noCommentsYet') }}
              </div>
              <div
                v-for="item in comments"
                :key="item.id"
                class="flex items-start gap-2.5 p-2.5 rounded-xl border border-[var(--border-base)] bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-all duration-200"
              >
                <UserAvatar
                  :user="item.user"
                  size="sm"
                  class="shrink-0 w-6 h-6 cursor-pointer hover:opacity-85 transition-opacity"
                  @click="handleShowUserProfile(item.user.id)"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span
                      class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer hover:text-accent transition-colors"
                      @click="handleShowUserProfile(item.user.id)"
                    >
                      {{ item.user.name }}
                      <span
                        v-if="item.userId === detailNote.userId"
                        class="text-[8px] font-black px-1.5 py-0.2 bg-purple-500/10 text-purple-500 dark:text-purple-400 rounded-md"
                        >{{ t('notes.author') }}</span
                      >
                    </span>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] text-[var(--text-muted)]">{{
                        new Date(item.createdAt).toLocaleString('zh-CN')
                      }}</span>
                      <button
                        v-if="
                          item.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'
                        "
                        type="button"
                        class="p-1 text-[var(--text-muted)] hover:text-red-500 rounded transition-all cursor-pointer bg-transparent border-0"
                        :title="t('notes.deleteComment')"
                        @click="handleDeleteComment(item.id)"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p
                    class="text-xs text-[var(--text-secondary)] mt-1.5 whitespace-pre-wrap leading-relaxed"
                  >
                    {{ item.content }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Compact Footer End Stamp -->
          <footer class="mt-12 pt-6 border-t border-[var(--border-base)]">
            <div
              class="flex flex-col items-center justify-center gap-2 select-none text-[var(--text-muted)] opacity-60"
            >
              <BookOpen class="w-5 h-5 text-accent" />
              <span class="text-[10px] font-black tracking-widest">{{
                t('notes.endReading')
              }}</span>
            </div>
          </footer>
        </div>
      </div>
    </div>

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleChatWithMember"
    />
  </Modal>
</template>

<style scoped>
.dialog-close-btn {
  transition: all 0.2s ease-in-out;
}
@media (max-width: 767px) {
  .dialog-close-btn {
    top: calc(12px + env(safe-area-inset-top, 0px)) !important;
    right: 12px !important;
  }
  .dialog-content-wrapper {
    padding-top: calc(56px + env(safe-area-inset-top, 0px)) !important;
  }
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

/* Markdown scaling and layout overrides */
.modern-markdown-content :deep(.md-editor-preview),
.modern-markdown-content :deep(.md-preview),
.modern-markdown-content :deep(.mdw__preview-only) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: inherit !important;
  line-height: 1.8 !important;
  background-color: transparent !important;
  padding: 4px 8px !important;
}
@media (min-width: 768px) {
  .modern-markdown-content :deep(.md-editor-preview),
  .modern-markdown-content :deep(.md-preview),
  .modern-markdown-content :deep(.mdw__preview-only) {
    padding: 0 20px 20px 20px !important;
  }
}
.modern-markdown-content :deep(.md-editor-preview p),
.modern-markdown-content :deep(.md-preview p),
.modern-markdown-content :deep(.mdw__preview-only p) {
  margin-bottom: 0.8em !important;
}

.modern-markdown-content :deep(.md-editor-preview p),
.modern-markdown-content :deep(.md-editor-preview li),
.modern-markdown-content :deep(.md-editor-preview span),
.modern-markdown-content :deep(.md-editor-preview a),
.modern-markdown-content :deep(.md-editor-preview code),
.modern-markdown-content :deep(.md-preview p),
.modern-markdown-content :deep(.md-preview li),
.modern-markdown-content :deep(.md-preview span),
.modern-markdown-content :deep(.md-preview a),
.modern-markdown-content :deep(.md-preview code),
.modern-markdown-content :deep(.mdw__preview-only p),
.modern-markdown-content :deep(.mdw__preview-only li),
.modern-markdown-content :deep(.mdw__preview-only span),
.modern-markdown-content :deep(.mdw__preview-only a),
.modern-markdown-content :deep(.mdw__preview-only code) {
  font-size: inherit !important;
}

/* Headings proportional scaling */
.modern-markdown-content :deep(h1) {
  font-size: 1.85em !important;
  font-weight: 800 !important;
}
.modern-markdown-content :deep(h2) {
  font-size: 1.55em !important;
  font-weight: 800 !important;
  border-bottom: 1px dashed var(--border-base) !important;
  padding-bottom: 0.3em;
}
.modern-markdown-content :deep(h3) {
  font-size: 1.3em !important;
  font-weight: 700 !important;
}
.modern-markdown-content :deep(h4) {
  font-size: 1.15em !important;
  font-weight: 700 !important;
}

/* Responsive scrollable tables with premium styling on mobile */
.modern-markdown-content :deep(table) {
  display: block !important;
  width: 100% !important;
  overflow-x: auto !important;
  border-collapse: collapse !important;
  margin: 1.5rem 0 !important;
  -webkit-overflow-scrolling: touch;
}

.modern-markdown-content :deep(table th),
.modern-markdown-content :deep(table td) {
  padding: 8px 14px !important;
  border: 1px solid var(--border-base) !important;
  font-size: 0.95em !important;
  line-height: 1.6 !important;
}

.modern-markdown-content :deep(table th) {
  background-color: var(--bg-subtle) !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  white-space: nowrap !important;
}

@media (max-width: 767px) {
  .modern-markdown-content :deep(table th),
  .modern-markdown-content :deep(table td) {
    min-width: 85px;
    white-space: nowrap !important;
    word-break: keep-all !important;
  }
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Prevent code block elements from overlaying any headers */
.modern-markdown-content :deep(.md-editor-code),
.modern-markdown-content :deep(.md-editor-code-head),
.modern-markdown-content :deep(.md-editor-code-copy),
.modern-markdown-content :deep(.md-code),
.modern-markdown-content :deep(.md-code-head),
.modern-markdown-content :deep(.md-code-copy),
.modern-markdown-content :deep(pre) {
  z-index: 2 !important;
}

/* Enforce horizontal layout for action buttons in sidebar */
aside :deep(button > span) {
  flex-direction: row !important;
  gap: 6px !important;
}
</style>
