<script setup lang="ts">
import { formatDate } from '@/utils/format';
import { ref, computed, onMounted, defineAsyncComponent, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Eye,
  Clock,
  Home,
  BookOpen,
  AlertTriangle,
  Sparkles,
  Calendar,
  Check,
  Copy,
  Minus,
  Plus,
  BookMarked,
  MessageSquare,
  Trash2,
  Quote,
  Loader2,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { watch } from 'vue';
import Button from '@/components/ui/Button.vue';
import { parseTags } from '@/utils/tags';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const logoLoadFailed = ref(false);

watch(
  () => systemStore.settings.PLATFORM_LOGO_URL,
  () => {
    logoLoadFailed.value = false;
  },
);

interface NoteUser {
  id: string;
  name: string;
  avatarUrl: string;
  bio?: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  summary?: string;
  tags?: string;
  category?: string;
  views: number;
  userId: string;
  user: NoteUser;
  createdAt: string;
}

const shareId = route.params.shareId as string;
const note = ref<Note | null>(null);
const expiresAt = ref<string | null>(null);
const shareMessage = ref<string | null>(null);
const loading = ref(true);
const errorMsg = ref('');
const isExpired = ref(false);

// Reading Toolbox States
const fontSize = ref(16);
const readProgress = ref(0);
const isCopying = ref(false);
const isCloning = ref(false);

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
    ElMessage.error('加载评论失败');
  } finally {
    loadingComments.value = false;
  }
};

const submitComment = async () => {
  if (!note.value) return;
  if (!commentContent.value || !commentContent.value.trim()) {
    ElMessage.warning('请输入评论内容');
    return;
  }
  submittingComment.value = true;
  try {
    const res = await api.post(`/api/notes/${note.value.id}/comment`, {
      content: commentContent.value.trim(),
    });
    comments.value.push(res.data);
    commentContent.value = '';
    ElMessage.success('发表评论成功！');
  } catch (err: unknown) {
    ElMessage.error(getApiErrorMessage(err, '发表评论失败'));
  } finally {
    submittingComment.value = false;
  }
};

const handleDeleteComment = async (commentId: string) => {
  try {
    await api.delete(`/api/notes/comment/${commentId}`);
    comments.value = comments.value.filter((c) => c.id !== commentId);
    ElMessage.success('删除评论成功');
  } catch (err: unknown) {
    ElMessage.error(getApiErrorMessage(err, '删除评论失败'));
  }
};

const goHome = () => {
  router.push('/dashboard');
};

const loadSharedNote = async () => {
  loading.value = true;
  errorMsg.value = '';
  isExpired.value = false;
  sessionSummary.value = '';
  isSummarizing.value = false;
  try {
    const res = await api.get(`/api/notes/share/${shareId}?t=${Date.now()}`);
    note.value = res.data.note;
    expiresAt.value = res.data.expiresAt;
    shareMessage.value = res.data.customText;
    if (res.data.note.summary && !isFallbackExcerpt(res.data.note.summary, res.data.note.content)) {
      sessionSummary.value = res.data.note.summary;
    } else {
      sessionSummary.value = '';
    }

    // Set dynamic browser tab title
    document.title = `${res.data.note.title} | ${systemStore.settings.PLATFORM_NAME}`;

    fetchComments(res.data.note.id);
  } catch (error) {
    const err = error as { response?: { status?: number; data?: { error?: string } } };
    if (err.response?.status === 410) {
      isExpired.value = true;
      errorMsg.value = '该分享链接已过期失效';
      document.title = `分享链接已过期 | ${systemStore.settings.PLATFORM_NAME}`;
    } else {
      errorMsg.value = err.response?.data?.error || '无法加载分享的笔记，链接可能不存在或已被取消';
      document.title = `无法找到分享笔记 | ${systemStore.settings.PLATFORM_NAME}`;
    }
  } finally {
    loading.value = false;
  }
};

// Copy function
const handleCopy = async () => {
  if (!note.value) return;
  try {
    await navigator.clipboard.writeText(note.value.content);
    isCopying.value = true;
    ElMessage.success('已复制全文到剪贴板');
    setTimeout(() => {
      isCopying.value = false;
    }, 2000);
  } catch {
    ElMessage.error('复制失败');
  }
};

// Save shared note to my notebook (Clone)
const handleSaveToMyNotes = async () => {
  if (!note.value) return;
  if (!authStore.isAuthenticated) {
    ElMessage.warning('请先登录再导入此笔记');
    router.push('/login');
    return;
  }

  isCloning.value = true;
  try {
    const payload = {
      title: `${note.value.title} (分享导入)`,
      content: note.value.content,
      summary: note.value.summary || null,
      tags: note.value.tags || null,
      category: note.value.category || '导入收藏',
      visibility: 'PRIVATE',
    };
    await api.post('/api/notes', payload);
    ElMessage({
      message: '笔记成功保存到你的笔记本中！',
      type: 'success',
      duration: 3000,
    });
  } catch {
    ElMessage.error('保存失败，请稍后重试');
  } finally {
    isCloning.value = false;
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

let progressInterval: ReturnType<typeof setInterval> | null = null;
let fillInterval: ReturnType<typeof setInterval> | null = null;

const currentThinkingStep = computed(() => {
  const percent = summaryProgress.value;
  if (percent < 12) return '分析段落结构';
  if (percent < 25) return '梳理核心要点';
  if (percent < 38) return '提取关键概念';
  if (percent < 50) return '生成摘要大纲';
  if (percent < 65) return '提炼要点内容';
  if (percent < 80) return '过滤冗余词句';
  if (percent < 92) return '润色语言表达';
  return '完成核心排版';
});

const generateAiSummary = async () => {
  if (isSummarizing.value) return;
  isSummarizing.value = true;
  summaryProgress.value = 0;
  sessionSummary.value = '';

  if (progressInterval) clearInterval(progressInterval);
  if (fillInterval) clearInterval(fillInterval);

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
    const res = await api.post(`/api/notes/share/${shareId}/ai-summarize`);
    if (res.data && res.data.summary) {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      // Smoothly accelerate to 100%
      const fillProgress = () => {
        return new Promise<void>((resolve) => {
          fillInterval = setInterval(() => {
            if (summaryProgress.value < 100) {
              summaryProgress.value += Math.min(5, 100 - summaryProgress.value);
            } else {
              if (fillInterval) {
                clearInterval(fillInterval);
                fillInterval = null;
              }
              resolve();
            }
          }, 30);
        });
      };
      await fillProgress();
      await new Promise((resolve) => setTimeout(resolve, 200));
      sessionSummary.value = res.data.summary;
    } else {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      ElMessage.error('未能获取生成摘要');
    }
  } catch (err: unknown) {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    ElMessage.error(getApiErrorMessage(err, '生成摘要失败，请重试'));
  } finally {
    isSummarizing.value = false;
  }
};

// Scroll Progress Tracker
const onWindowScroll = () => {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;
  const totalScroll = scrollHeight - clientHeight;
  if (totalScroll > 0) {
    readProgress.value = Math.min(Math.round((scrollTop / totalScroll) * 100), 100);
  } else {
    readProgress.value = 0;
  }
};

const handleContentClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const link = target.closest('a');
  if (link) {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      e.preventDefault();
      const targetId = decodeURIComponent(href.slice(1));

      // 1. Try to find by exact ID
      let targetEl = document.getElementById(targetId);

      // 2. If not found, try to find case-insensitively or with matching generated slug
      if (!targetEl) {
        const headings = document.querySelectorAll(
          '.modern-markdown-content h1, .modern-markdown-content h2, .modern-markdown-content h3, .modern-markdown-content h4, .modern-markdown-content h5, .modern-markdown-content h6',
        );
        const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
        const targetSlug = slugify(targetId);

        // First pass: Exact slug match
        for (const heading of headings) {
          const headingId = heading.getAttribute('id') || '';
          const headingText = heading.textContent || '';
          const headingSlug = slugify(headingText);
          const idSlug = slugify(headingId);

          if (headingSlug === targetSlug || idSlug === targetSlug) {
            targetEl = heading as HTMLElement;
            break;
          }
        }

        // Second pass: Substring match (for cases where TOC omits heading numbers/prefixes)
        if (!targetEl && targetSlug.length >= 2) {
          for (const heading of headings) {
            const headingText = heading.textContent || '';
            const headingSlug = slugify(headingText);
            if (headingSlug.includes(targetSlug)) {
              targetEl = heading as HTMLElement;
              break;
            }
          }
        }
      }

      // 3. Scroll to it
      if (targetEl) {
        const yOffset = -70; // 70px offset for sticky header
        const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  }
};

onMounted(async () => {
  if (!systemStore.isInitialized) {
    await systemStore.fetchSettings();
  }
  loadSharedNote();
  window.addEventListener('scroll', onWindowScroll);
});

onUnmounted(() => {
  window.removeEventListener('scroll', onWindowScroll);
  systemStore.updateBrowserBranding();
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (fillInterval) {
    clearInterval(fillInterval);
    fillInterval = null;
  }
});
</script>

<template>
  <div
    class="mobile-adaptive min-h-screen flex flex-col font-sans antialiased bg-[var(--bg-app)] text-[var(--text-primary)]"
  >
    <!-- Sticky Top Reading Progress -->
    <div class="fixed top-0 left-0 right-0 z-[110] h-0.5 bg-transparent">
      <div
        class="h-full bg-gradient-to-r from-purple-500 via-accent to-indigo-500 transition-all duration-75"
        :style="{ width: readProgress + '%' }"
      />
    </div>

    <!-- Clean Minimalist Header -->
    <header
      class="mobile-row sticky top-0 z-[100] backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between border-b shadow-xs transition-colors bg-[var(--bg-card)]/80 border-[var(--border-base)]"
    >
      <div class="flex items-center gap-2 cursor-pointer select-none" @click="goHome">
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden"
          :class="
            systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed
              ? 'bg-transparent'
              : 'bg-gradient-to-tr from-purple-500 to-indigo-600 shadow-sm'
          "
        >
          <img
            v-if="systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed"
            alt=""
            :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)"
            class="w-full h-full object-contain"
            @error="logoLoadFailed = true"
          />
          <Sparkles v-else class="w-4 h-4 text-white" />
        </div>
        <span
          class="text-xs font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400"
        >
          {{ systemStore.settings.PLATFORM_NAME }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="authStore.isAuthenticated"
          variant="secondary"
          size="sm"
          class="font-bold flex items-center gap-1"
          @click="goHome"
        >
          <Home class="w-3.5 h-3.5" />
        </Button>
        <Button v-else variant="primary" size="sm" class="font-bold" @click="router.push('/login')">
          登录 / 注册
        </Button>
      </div>
    </header>

    <!-- Main Content Grid -->
    <main
      class="flex-1 max-w-[1040px] w-full mx-auto px-4 sm:px-6 py-6 lg:py-10 flex flex-col md:flex-row gap-6 relative items-start"
    >
      <!-- Skeleton States -->
      <div
        v-if="loading"
        class="flex-1 w-full bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl p-6 md:p-10 shadow-sm"
      >
        <div class="space-y-4 animate-pulse">
          <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2"></div>
          <div class="space-y-2 pt-4">
            <div class="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
            <div class="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
            <div class="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-5/6"></div>
          </div>
        </div>
      </div>

      <!-- Error / Expired States -->
      <div
        v-else-if="errorMsg || isExpired"
        class="flex-1 w-full flex flex-col items-center justify-center text-center py-16 sm:py-24 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl shadow-sm"
      >
        <div
          class="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center mb-5"
        >
          <AlertTriangle class="w-8 h-8 text-rose-500" />
        </div>
        <h2 class="text-lg sm:text-xl font-black mb-2">
          {{ isExpired ? '分享链接已失效' : '无法找到当前分享' }}
        </h2>
        <p class="text-xs text-[var(--text-secondary)] max-w-sm mb-6 leading-relaxed">
          {{ errorMsg || '作者已停止对此笔记的公共访问，或者此笔记的临时共享期限已到期。' }}
        </p>
        <Button variant="primary" size="md" class="font-bold shadow-xs" @click="goHome">
          返回主页
        </Button>
      </div>

      <!-- Left Column: Compact Reader Body -->
      <article
        v-else-if="note"
        class="flex-1 min-w-0 w-full rounded-3xl p-4 sm:p-8 lg:p-10 border shadow-md bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-[var(--border-base)]"
      >
        <!-- Floating status info for expiresAt -->
        <div
          v-if="expiresAt"
          class="mb-6 rounded-2xl px-4 py-2.5 flex items-center gap-1.5 text-xs sm:text-sm font-bold border bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-500/20 text-amber-600"
        >
          <Clock class="w-3.5 h-3.5" />
          <span>临时共享文章，失效时间：{{ formatDate(expiresAt) }}</span>
        </div>

        <!-- Exquisite Custom Message/Note Share customText block -->
        <div
          v-if="shareMessage"
          class="mb-8 rounded-3xl p-6 border bg-gradient-to-br from-purple-500/[0.04] to-indigo-500/[0.04] dark:from-purple-500/[0.08] dark:to-indigo-500/[0.08] border-purple-500/15 dark:border-purple-500/25 text-[var(--text-secondary)] relative overflow-hidden backdrop-blur-md group shadow-sm hover:shadow-md transition-all duration-300"
        >
          <!-- Absolute positioned giant quote icon in the background -->
          <Quote
            class="absolute -right-3 -bottom-5 w-24 h-24 text-purple-500/[0.06] dark:text-purple-500/[0.08] pointer-events-none transform -rotate-12 transition-transform duration-500 group-hover:scale-110"
          />

          <div class="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400">
            <div class="p-1.5 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <MessageSquare class="w-4 h-4" />
            </div>
            <span class="text-sm font-bold tracking-widest uppercase">分享寄语</span>
          </div>

          <div class="relative z-10 pl-2">
            <p
              class="text-xs sm:text-sm font-medium leading-relaxed text-[var(--text-primary)] italic relative"
            >
              “ {{ shareMessage }} ”
            </p>

            <!-- Author attribution at the bottom of the card -->
            <div
              class="mt-4 flex items-center justify-end gap-2 border-t border-purple-500/10 pt-3"
            >
              <span class="text-xs text-[var(--text-muted)]">分享自</span>
              <div class="flex items-center gap-1.5">
                <UserAvatar :user="note.user" size="xs" class="border border-purple-500/20" />
                <span class="text-xs font-bold text-[var(--text-secondary)]">{{
                  note.user.name
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Category & Date Header -->
        <div class="flex items-center gap-2 mb-3">
          <span
            v-if="note.category"
            class="px-2 py-0.5 rounded bg-accent/10 border border-accent/15 text-accent text-xs font-bold uppercase tracking-wider"
          >
            {{ note.category }}
          </span>
          <span class="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <Calendar class="w-3.5 h-3.5" />
            {{ formatDate(note.createdAt) }}
          </span>
        </div>

        <!-- Title -->
        <h1 class="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight tracking-tight mb-4">
          {{ note.title }}
        </h1>

        <!-- Author Information Info card -->
        <div
          class="mobile-row flex items-center justify-between border-b pb-2.5 mb-3.5 border-[var(--border-base)]"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <UserAvatar :user="note.user" size="md" class="shrink-0 border-2 border-accent/10" />
            <div class="min-w-0">
              <div class="font-bold text-sm leading-none flex items-center gap-1.5">
                {{ note.user.name }}
                <span
                  class="text-[10px] px-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded"
                  >作者</span
                >
              </div>
              <p class="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">
                {{ note.user.bio || '探索者' }}
              </p>
            </div>
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-3 text-xs font-bold text-[var(--text-muted)]">
            <span class="flex items-center gap-1"
              ><Eye class="w-4 h-4" /> {{ note.views }} 阅读</span
            >
          </div>
        </div>

        <!-- Abstract/Summary Card -->
        <div
          class="mb-3 rounded-xl p-2.5 text-xs leading-relaxed border bg-slate-50/40 dark:bg-zinc-900/10 border-[var(--border-base)] text-[var(--text-secondary)]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <Sparkles class="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>核心摘要</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              :loading="isSummarizing"
              @click="generateAiSummary"
            >
              <Sparkles v-if="!isSummarizing" class="w-3.5 h-3.5 mr-1" />
              <span>{{
                isSummarizing ? '提炼中...' : sessionSummary ? '重新生成' : '生成 AI 摘要'
              }}</span>
            </Button>
          </div>

          <div
            v-if="sessionSummary"
            class="text-sm text-[var(--text-secondary)] mt-2 whitespace-pre-wrap leading-normal animate-fade-in"
          >
            {{ sessionSummary }}
          </div>
          <div v-else-if="isSummarizing" class="mt-2.5 space-y-1.5">
            <div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span class="flex items-center gap-1.5 font-bold text-[var(--text-secondary)]">
                <Loader2 class="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                AI 正在思考: {{ currentThinkingStep }}...
              </span>
              <span class="font-bold text-[var(--accent)]">{{ summaryProgress }}%</span>
            </div>
            <div class="h-1 w-full bg-slate-200/50 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-[var(--accent)] rounded-full transition-all duration-300 ease-out"
                :style="{ width: `${summaryProgress}%` }"
              ></div>
            </div>
          </div>
          <div v-else class="text-[var(--text-muted)] text-xs mt-1.5 py-0.5">待摘要</div>
        </div>

        <!-- Core Markdown Canvas -->
        <div
          class="modern-markdown-content min-h-[350px] markdown-theme-default"
          :style="{ fontSize: fontSize + 'px' }"
          @click="handleContentClick"
        >
          <MarkdownEditor :model-value="note.content" preview-only />
        </div>

        <!-- Tag badge footer -->
        <footer
          v-if="parseTags(note.tags).length"
          class="border-t pt-5 mt-8 flex flex-wrap gap-1.5 border-[var(--border-base)]"
        >
          <span
            v-for="tag in parseTags(note.tags)"
            :key="tag"
            class="px-2 py-0.5 rounded-lg text-xs font-bold border bg-slate-50 dark:bg-zinc-900/50 border-[var(--border-base)] text-[var(--text-secondary)]"
          >
            #{{ tag }}
          </span>
        </footer>

        <!-- Note Comments Section -->
        <div class="mt-12 pt-8 border-t border-[var(--border-base)] space-y-6">
          <div class="flex items-center justify-between">
            <h3
              class="text-sm font-bold flex items-center gap-2"
              style="color: var(--text-primary)"
            >
              <MessageSquare class="w-4 h-4 text-accent" />
              <span>全部评论 ({{ comments.length }})</span>
            </h3>
          </div>

          <!-- Comment Input -->
          <div v-if="authStore.isAuthenticated" class="flex items-start gap-3">
            <UserAvatar :user="authStore.user" size="sm" class="shrink-0 w-6 h-6" />
            <div class="flex-1 space-y-2">
              <textarea
                v-model="commentContent"
                rows="3"
                placeholder="写下你的想法，交流看法..."
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
                  发表评论
                </Button>
              </div>
            </div>
          </div>
          <div
            v-else
            class="p-4 bg-slate-50 dark:bg-white/5 border border-dashed border-[var(--border-base)] rounded-2xl text-center"
          >
            <p class="text-xs text-[var(--text-muted)] mb-2.5">您需要登录后才能发表评论</p>
            <Button variant="primary" size="sm" class="font-bold" @click="router.push('/login')"
              >去登录</Button
            >
          </div>

          <!-- Comments List -->
          <div v-loading="loadingComments" class="space-y-4">
            <div
              v-if="comments.length === 0"
              class="text-center py-6 text-sm text-[var(--text-muted)]"
            >
              暂无评论，快来发表第一条评论吧~
            </div>
            <div
              v-for="item in comments"
              :key="item.id"
              class="flex items-start gap-3 p-3 rounded-2xl border border-[var(--border-base)] bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-all duration-200"
            >
              <UserAvatar :user="item.user" size="sm" class="shrink-0 w-6 h-6" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span
                    class="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5"
                  >
                    {{ item.user.name }}
                    <span
                      v-if="item.userId === note.userId"
                      class="text-[10px] font-bold px-1.5 py-0.2 bg-purple-500/10 text-purple-500 dark:text-purple-400 rounded-md"
                      >作者</span
                    >
                  </span>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-[var(--text-muted)]">{{
                      new Date(item.createdAt).toLocaleString('zh-CN')
                    }}</span>
                    <button
                      v-if="item.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
                      type="button"
                      class="p-1 text-[var(--text-muted)] hover:text-red-500 rounded transition-all cursor-pointer bg-transparent border-0"
                      title="删除评论"
                      @click="handleDeleteComment(item.id)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p
                  class="text-sm text-[var(--text-secondary)] mt-1.5 whitespace-pre-wrap leading-relaxed"
                >
                  {{ item.content }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Finish stamp -->
        <div
          class="pt-8 text-center text-[var(--text-muted)] text-xs font-bold tracking-widest flex items-center justify-center gap-2 select-none"
        >
          <BookOpen class="w-4 h-4 text-accent" />
          <span>阅读结束</span>
        </div>
      </article>

      <!-- Right Column: Sidebar Reading Console (Responsive Sticky) -->
      <aside
        v-if="note"
        class="w-full md:w-56 flex flex-col gap-4 md:sticky md:top-20 z-10 shrink-0"
      >
        <!-- Floating Reading adjustments -->
        <div
          class="w-full border rounded-3xl p-4 shadow-sm flex flex-col gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-[var(--border-base)]"
        >
          <!-- Title -->
          <p class="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            阅读辅助控制
          </p>

          <!-- Divider -->
          <div class="h-[1px] bg-[var(--border-base)]" />

          <!-- Typo controls -->
          <div class="mobile-row flex items-center justify-between text-xs">
            <span class="text-xs font-semibold">正文字号</span>
            <div
              class="flex items-center gap-1 bg-slate-50 dark:bg-zinc-800/40 rounded-lg p-0.5 border border-[var(--border-base)]"
            >
              <button
                type="button"
                class="w-5 h-5 flex items-center justify-center hover:bg-[var(--bg-card)] rounded transition-all cursor-pointer"
                @click="fontSize = Math.max(12, fontSize - 1)"
              >
                <Minus class="w-2.5 h-2.5" />
              </button>
              <span class="text-xs font-bold px-1">{{ fontSize }}px</span>
              <button
                type="button"
                class="w-5 h-5 flex items-center justify-center hover:bg-[var(--bg-card)] rounded transition-all cursor-pointer"
                @click="fontSize = Math.min(24, fontSize + 1)"
              >
                <Plus class="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Import / Save actions -->
        <div
          class="w-full border rounded-3xl p-4 shadow-sm flex flex-col gap-2.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-[var(--border-base)]"
        >
          <p class="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            文章工具
          </p>
          <div class="h-[1px] bg-[var(--border-base)]" />

          <!-- Logged-in Clone Feature -->
          <Button
            :variant="authStore.isAuthenticated ? 'primary' : 'secondary'"
            size="sm"
            full-width
            :loading="isCloning"
            @click="handleSaveToMyNotes"
          >
            <BookMarked class="w-3.5 h-3.5 mr-1" />
            <span>{{ authStore.isAuthenticated ? '导入到我的笔记本' : '登录并导入收藏' }}</span>
          </Button>

          <Button variant="secondary" size="sm" full-width @click="handleCopy">
            <component :is="isCopying ? Check : Copy" class="w-3.5 h-3.5 mr-1" />
            <span>{{ isCopying ? '已复制' : '复制全文' }}</span>
          </Button>
        </div>
      </aside>
    </main>

    <!-- Clean Footer -->
    <footer
      class="mt-auto py-6 text-center text-xs text-[var(--text-muted)] border-t bg-[var(--bg-card)]/50 select-none border-[var(--border-base)]"
    >
      <p class="mb-1">
        © {{ new Date().getFullYear() }} {{ systemStore.settings.PLATFORM_NAME }}. All rights
        reserved.
      </p>
      <p>由公共分享密钥浏览 • 支持免登直接访问</p>
    </footer>
  </div>
</template>

<style scoped>
/* Custom Scrollbar for elements */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}

/* Markdown overrides based on reading mode */
.modern-markdown-content :deep(.md-editor-preview),
.modern-markdown-content :deep(.md-preview),
.modern-markdown-content :deep(.mdw__preview-only) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: inherit !important;
  line-height: 1.85 !important;
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

/* Prevent code block elements from overlaying the sticky header */
.modern-markdown-content :deep(.md-editor-code),
.modern-markdown-content :deep(.md-editor-code-head),
.modern-markdown-content :deep(.md-editor-code-copy),
.modern-markdown-content :deep(.md-code),
.modern-markdown-content :deep(.md-code-head),
.modern-markdown-content :deep(.md-code-copy),
.modern-markdown-content :deep(pre) {
  z-index: 2 !important;
}

/* Enforce horizontal layout for action buttons */
:deep(button > span) {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
}
</style>
