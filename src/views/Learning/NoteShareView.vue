<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent, onUnmounted } from 'vue';
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
  Quote
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { watch } from 'vue';

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
const fontSize = ref(12);
const readProgress = ref(0);
const isCopying = ref(false);
const isCloning = ref(false);

// Comments States & Functions
const comments = ref<any[]>([]);
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
      content: commentContent.value.trim()
    });
    comments.value.push(res.data);
    commentContent.value = '';
    ElMessage.success('发表评论成功！');
  } catch (err: any) {
    ElMessage.error(getApiErrorMessage(err, '发表评论失败'));
  } finally {
    submittingComment.value = false;
  }
};

const handleDeleteComment = async (commentId: string) => {
  try {
    await api.delete(`/api/notes/comment/${commentId}`);
    comments.value = comments.value.filter(c => c.id !== commentId);
    ElMessage.success('删除评论成功');
  } catch (err: any) {
    ElMessage.error(getApiErrorMessage(err, '删除评论失败'));
  }
};

const parseTags = (noteTags?: string): string[] => {
  if (!noteTags) return [];
  try {
    const parsed = JSON.parse(noteTags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return noteTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const goHome = () => {
  router.push('/dashboard');
};

const loadSharedNote = async () => {
  loading.value = true;
  errorMsg.value = '';
  isExpired.value = false;
  try {
    const res = await api.get(`/api/notes/share/${shareId}`);
    note.value = res.data.note;
    expiresAt.value = res.data.expiresAt;
    shareMessage.value = res.data.customText;
    
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
      visibility: 'PRIVATE'
    };
    await api.post('/api/notes', payload);
    ElMessage({
      message: '笔记成功保存到你的笔记本中！',
      type: 'success',
      duration: 3000
    });
  } catch {
    ElMessage.error('保存失败，请稍后重试');
  } finally {
    isCloning.value = false;
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
});
</script>

<template>
  <div 
    class="min-h-screen flex flex-col font-sans antialiased bg-[var(--bg-app)] text-[var(--text-primary)]"
  >
    <!-- Sticky Top Reading Progress -->
    <div class="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-transparent">
      <div 
        class="h-full bg-gradient-to-r from-purple-500 via-accent to-indigo-500 transition-all duration-75"
        :style="{ width: readProgress + '%' }"
      />
    </div>

    <!-- Clean Minimalist Header -->
    <header 
      class="sticky top-0 z-50 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between border-b shadow-xs transition-colors bg-[var(--bg-card)]/80 border-[var(--border-base)]"
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
        <span class="text-xs font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">
          {{ systemStore.settings.PLATFORM_NAME }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <el-button v-if="authStore.isAuthenticated" size="small" round class="font-bold flex items-center gap-1" @click="goHome">
          <Home class="w-3.5 h-3.5" />
          <span>控制台</span>
        </el-button>
        <el-button v-else size="small" type="primary" round class="font-bold" @click="router.push('/login')">
          登录 / 注册
        </el-button>
      </div>
    </header>

    <!-- Main Content Grid -->
    <main class="flex-1 max-w-[1040px] w-full mx-auto px-4 sm:px-6 py-6 lg:py-10 flex flex-col md:flex-row gap-6 relative items-start">
      
      <!-- Skeleton States -->
      <div v-if="loading" class="flex-1 w-full bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl p-6 md:p-10 shadow-sm">
        <el-skeleton animated :rows="8" />
      </div>

      <!-- Error / Expired States -->
      <div v-else-if="errorMsg || isExpired" class="flex-1 w-full flex flex-col items-center justify-center text-center py-16 sm:py-24 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl shadow-sm">
        <div class="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center mb-5">
          <AlertTriangle class="w-8 h-8 text-rose-500" />
        </div>
        <h2 class="text-lg sm:text-xl font-black mb-2">
          {{ isExpired ? '分享链接已失效' : '无法找到当前分享' }}
        </h2>
        <p class="text-xs text-[var(--text-secondary)] max-w-sm mb-6 leading-relaxed">
          {{ errorMsg || '作者已停止对此笔记的公共访问，或者此笔记的临时共享期限已到期。' }}
        </p>
        <el-button type="primary" round class="font-bold shadow-xs" @click="goHome">
          返回主页
        </el-button>
      </div>

      <!-- Left Column: Compact Reader Body -->
      <article 
        v-else-if="note" 
        class="flex-1 min-w-0 w-full rounded-3xl p-4 sm:p-8 lg:p-10 border shadow-md bg-[var(--bg-card)] border-[var(--border-base)]"
      >
        <!-- Floating status info for expiresAt -->
        <div 
          v-if="expiresAt" 
          class="mb-6 rounded-2xl px-4 py-2.5 flex items-center gap-1.5 text-[10px] sm:text-xs font-bold border bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-500/20 text-amber-600"
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
          <Quote class="absolute -right-3 -bottom-5 w-24 h-24 text-purple-500/[0.06] dark:text-purple-500/[0.08] pointer-events-none transform -rotate-12 transition-transform duration-500 group-hover:scale-110" />
          
          <div class="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400">
            <div class="p-1.5 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <MessageSquare class="w-4 h-4" />
            </div>
            <span class="text-xs font-black tracking-widest uppercase">分享寄语</span>
          </div>
          
          <div class="relative z-10 pl-2">
            <p class="text-xs sm:text-sm font-medium leading-relaxed text-[var(--text-primary)] italic relative">
              “ {{ shareMessage }} ”
            </p>
            
            <!-- Author attribution at the bottom of the card -->
            <div class="mt-4 flex items-center justify-end gap-2 border-t border-purple-500/10 pt-3">
              <span class="text-[10px] text-[var(--text-muted)]">分享自</span>
              <div class="flex items-center gap-1.5">
                <UserAvatar :user="note.user" size="xs" class="border border-purple-500/20" />
                <span class="text-[10px] font-bold text-[var(--text-secondary)]">{{ note.user.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Category & Date Header -->
        <div class="flex items-center gap-2 mb-3">
          <span 
            v-if="note.category" 
            class="px-2 py-0.5 rounded bg-accent/10 border border-accent/15 text-accent text-[9px] font-black uppercase tracking-wider"
          >
            {{ note.category }}
          </span>
          <span class="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
            <Calendar class="w-3 h-3" />
            {{ formatDate(note.createdAt) }}
          </span>
        </div>

        <!-- Title -->
        <h1 class="text-xl sm:text-2xl lg:text-3xl font-black leading-tight tracking-tight mb-5">
          {{ note.title }}
        </h1>

        <!-- Author Information Info card -->
        <div 
          class="flex items-center justify-between border-b pb-5 mb-6 border-[var(--border-base)]"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <UserAvatar :user="note.user" size="md" class="shrink-0 border-2 border-accent/10" />
            <div class="min-w-0">
              <h4 class="font-black text-xs leading-none flex items-center gap-1.5">
                {{ note.user.name }}
                <span class="text-[8px] px-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded">作者</span>
              </h4>
              <p class="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-1">{{ note.user.bio || '探索者' }}</p>
            </div>
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-3 text-[10px] font-black text-[var(--text-muted)]">
            <span class="flex items-center gap-1"><Eye class="w-3.5 h-3.5" /> {{ note.views }} 阅读</span>
          </div>
        </div>

        <!-- Abstract/Summary Card -->
        <div 
          v-if="note.summary" 
          class="mb-6 rounded-2xl p-4 text-xs sm:text-sm leading-relaxed border bg-slate-50 dark:bg-white/[0.02] border-[var(--border-base)] text-[var(--text-secondary)]"
        >
          <div class="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-accent mb-1.5">
            <Sparkles class="w-3.5 h-3.5" />
            <span>核心摘要</span>
          </div>
          {{ note.summary }}
        </div>

        <!-- Core Markdown Canvas -->
        <div 
          class="modern-markdown-content min-h-[350px] markdown-theme-default"
          :style="{ fontSize: fontSize + 'px' }"
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
            class="px-2 py-0.5 rounded-lg text-[9px] font-black border bg-slate-50 dark:bg-zinc-900/50 border-[var(--border-base)] text-[var(--text-secondary)]"
          >
            #{{ tag }}
          </span>
        </footer>

        <!-- Note Comments Section -->
        <div class="mt-12 pt-8 border-t border-[var(--border-base)] space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold flex items-center gap-2" style="color: var(--text-primary)">
              <MessageSquare class="w-4 h-4 text-accent" />
              <span>全部评论 ({{ comments.length }})</span>
            </h3>
          </div>

          <!-- Comment Input -->
          <div v-if="authStore.isAuthenticated" class="flex items-start gap-3">
            <UserAvatar :user="authStore.user" size="sm" class="shrink-0 w-6 h-6" />
            <div class="flex-1 space-y-2">
              <el-input
                v-model="commentContent"
                type="textarea"
                :rows="3"
                placeholder="写下你的想法，交流看法..."
                maxlength="500"
                show-word-limit
                class="custom-textarea"
              />
              <div class="flex justify-end">
                <el-button
                  type="primary"
                  size="small"
                  round
                  :loading="submittingComment"
                  @click="submitComment"
                >
                  发表评论
                </el-button>
              </div>
            </div>
          </div>
          <div v-else class="p-4 bg-slate-50 dark:bg-white/5 border border-dashed border-[var(--border-base)] rounded-2xl text-center">
            <p class="text-xs text-[var(--text-muted)] mb-2.5">您需要登录后才能发表评论</p>
            <el-button type="primary" size="small" round @click="router.push('/login')">去登录</el-button>
          </div>

          <!-- Comments List -->
          <div v-loading="loadingComments" class="space-y-4">
            <div v-if="comments.length === 0" class="text-center py-6 text-xs text-[var(--text-muted)]">
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
                  <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    {{ item.user.name }}
                    <span v-if="item.userId === note.userId" class="text-[8px] font-black px-1.5 py-0.2 bg-purple-500/10 text-purple-500 dark:text-purple-400 rounded-md">作者</span>
                  </span>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-[var(--text-muted)]">{{ new Date(item.createdAt).toLocaleString('zh-CN') }}</span>
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
                <p class="text-xs text-[var(--text-secondary)] mt-1.5 whitespace-pre-wrap leading-relaxed">{{ item.content }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Finish stamp -->
        <div 
          class="pt-8 text-center text-[var(--text-muted)] text-[10px] font-black tracking-widest flex items-center justify-center gap-2 select-none"
        >
          <BookOpen class="w-4 h-4 text-accent" />
          <span>阅读结束</span>
        </div>
      </article>

      <!-- Right Column: Sidebar Reading Console (Responsive Sticky) -->
      <aside v-if="note" class="w-full md:w-56 flex flex-col gap-4 md:sticky md:top-20 z-10 shrink-0">
        <!-- Floating Reading adjustments -->
        <div 
          class="w-full border rounded-3xl p-4 shadow-sm flex flex-col gap-4 bg-[var(--bg-card)] border-[var(--border-base)]"
        >
          <!-- Title -->
          <p class="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">阅读辅助控制</p>

          <!-- Divider -->
          <div class="h-[1px] bg-[var(--border-base)]" />

          <!-- Typo controls -->
          <div class="flex items-center justify-between text-xs">
            <span class="text-[10px] font-bold">正文字号</span>
            <div class="flex items-center gap-1 bg-slate-50 dark:bg-zinc-800/40 rounded-lg p-0.5 border border-[var(--border-base)]">
              <button type="button" class="w-5 h-5 flex items-center justify-center hover:bg-[var(--bg-card)] rounded transition-all cursor-pointer" @click="fontSize = Math.max(12, fontSize - 1)"><Minus class="w-2.5 h-2.5" /></button>
              <span class="text-[9px] font-black px-1">{{ fontSize }}px</span>
              <button type="button" class="w-5 h-5 flex items-center justify-center hover:bg-[var(--bg-card)] rounded transition-all cursor-pointer" @click="fontSize = Math.min(24, fontSize + 1)"><Plus class="w-2.5 h-2.5" /></button>
            </div>
          </div>
        </div>

        <!-- Import / Save actions -->
        <div 
          class="w-full border rounded-3xl p-4 shadow-sm flex flex-col gap-2.5 bg-[var(--bg-card)] border-[var(--border-base)]"
        >
          <p class="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">文章工具</p>
          <div class="h-[1px] bg-[var(--border-base)]" />

          <!-- Logged-in Clone Feature -->
          <button 
            type="button"
            class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black border transition-all active:scale-95 cursor-pointer"
            :class="[
              authStore.isAuthenticated ? 
              'bg-accent border-accent text-white hover:bg-accent/90 shadow-sm' : 
              'bg-transparent border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-zinc-800'
            ]"
            :loading="isCloning"
            @click="handleSaveToMyNotes"
          >
            <BookMarked class="w-3.5 h-3.5" />
            <span>{{ authStore.isAuthenticated ? '导入到我的笔记本' : '登录并导入收藏' }}</span>
          </button>

          <!-- Copy whole body -->
          <button 
            type="button"
            class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black border border-[var(--border-base)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer shadow-xs"
            @click="handleCopy"
          >
            <component :is="isCopying ? Check : Copy" class="w-3.5 h-3.5" />
            <span>{{ isCopying ? '已复制' : '复制全文' }}</span>
          </button>
        </div>
      </aside>

    </main>

    <!-- Clean Footer -->
    <footer 
      class="mt-auto py-6 text-center text-[10px] text-[var(--text-muted)] border-t bg-[var(--bg-card)]/50 select-none border-[var(--border-base)]"
    >
      <p class="mb-1">© {{ new Date().getFullYear() }} {{ systemStore.settings.PLATFORM_NAME }}. All rights reserved.</p>
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
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: inherit !important;
  line-height: 1.85 !important;
  background-color: transparent !important;
  padding: 4px 8px !important;
}
@media (min-width: 768px) {
  .modern-markdown-content :deep(.md-editor-preview),
  .modern-markdown-content :deep(.md-preview),
  .modern-markdown-content :deep(.mdw__preview-only) {
    padding: 20px !important;
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
.modern-markdown-content :deep(h1) { font-size: 1.85em !important; font-weight: 800 !important; }
.modern-markdown-content :deep(h2) { font-size: 1.55em !important; font-weight: 800 !important; border-bottom: 1px dashed var(--border-base) !important; padding-bottom: 0.3em; }
.modern-markdown-content :deep(h3) { font-size: 1.3em !important; font-weight: 700 !important; }
.modern-markdown-content :deep(h4) { font-size: 1.15em !important; font-weight: 700 !important; }
</style>
