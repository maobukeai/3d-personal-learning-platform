<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, ThumbsUp, Check, Copy, Star, BookOpen } from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar.vue';
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
}>();

const authStore = useAuthStore();
const visible = ref(false);
const detailNote = ref<Note | null>(null);
const isCopying = ref(false);

const open = async (note: Note) => {
  try {
    const res = await api.get(`/api/notes/${note.id}`);
    detailNote.value = res.data;
    visible.value = true;
    emit('views-updated', {
      id: note.id,
      views: res.data.views
    });
    emit('like-updated', {
      id: note.id,
      isLiked: res.data.isLiked,
      likesCount: res.data._count.likes
    });
  } catch {
    ElMessage.error('加载笔记详情失败');
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
      likesCount: detailNote.value._count.likes
    });
  } catch {
    ElMessage.error('操作失败');
  }
};

const handleTogglePopular = async () => {
  if (!detailNote.value) return;
  try {
    const res = await api.post(`/api/notes/${detailNote.value.id}/popular`);
    detailNote.value.isPopular = res.data.isPopular;
    ElMessage.success(detailNote.value.isPopular ? '已推荐该笔记为热门！' : '已取消该热门推荐');
    emit('popular-updated', {
      id: detailNote.value.id,
      isPopular: detailNote.value.isPopular
    });
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '操作失败'));
  }
};

const handleCopy = async () => {
  if (!detailNote.value) return;
  try {
    await navigator.clipboard.writeText(detailNote.value.content);
    isCopying.value = true;
    ElMessage.success('已复制全文到剪贴板');
    setTimeout(() => {
      isCopying.value = false;
    }, 2000);
  } catch {
    ElMessage.error('复制失败');
  }
};

const parseTags = (note: Note): string[] => {
  if (!note.tags) return [];
  try {
    const parsed = JSON.parse(note.tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return note.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
};

defineExpose({ open });
</script>

<template>
  <el-dialog
    v-model="visible"
    width="95%"
    top="2vh"
    class="modern-note-dialog"
    destroy-on-close
    :show-close="false"
  >
    <div v-if="detailNote" class="flex flex-col md:flex-row h-[92vh] overflow-hidden">
      <!-- Sidebar -->
      <aside class="w-full md:w-72 bg-slate-50/50 dark:bg-white/[0.02] p-3.5 md:p-5 flex flex-col shrink-0 border-b md:border-b-0 md:border-r" style="border-color: var(--border-base)">
        <div class="mb-3 md:mb-5 flex items-center justify-between">
          <el-button circle class="hover:bg-white dark:hover:bg-white/10 shadow-sm" @click="visible = false">
            <Plus class="w-5 h-5 rotate-45 text-[var(--text-secondary)]" />
          </el-button>
          <div class="md:hidden flex gap-2">
            <el-button circle :type="detailNote.isLiked ? 'danger' : ''" @click="handleLike">
              <ThumbsUp class="w-4 h-4" :class="{ 'fill-current': detailNote.isLiked }" />
            </el-button>
            <el-button circle @click="handleCopy">
              <component :is="isCopying ? Check : Copy" class="w-4 h-4" />
            </el-button>
          </div>
        </div>

        <div class="mb-4 md:mb-6 flex items-center md:items-start md:flex-col gap-2.5 md:gap-0">
          <UserAvatar :user="detailNote.user" size="md" md-size="lg" class="md:mb-3 shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-[var(--text-primary)] mb-0.5 truncate">{{ detailNote.user.name }}</h4>
            <p class="text-[10px] md:text-xs text-[var(--text-muted)] line-clamp-1 md:line-clamp-2 leading-relaxed">
              {{ detailNote.user.bio || '探索者' }}
            </p>
          </div>
        </div>

        <div class="hidden md:block space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-hide">
          <div>
            <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2.5">数据统计</p>
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-white dark:bg-white/5 p-2.5 rounded-xl border border-[var(--border-base)]">
                <p class="text-[10px] text-[var(--text-muted)] mb-0.5">阅读</p>
                <p class="text-xs font-black text-[var(--text-primary)]">{{ detailNote.views }}</p>
              </div>
              <div class="bg-white dark:bg-white/5 p-2.5 rounded-xl border border-[var(--border-base)]">
                <p class="text-[10px] text-[var(--text-muted)] mb-0.5">点赞</p>
                <p class="text-xs font-black text-[var(--text-primary)]">{{ detailNote._count.likes }}</p>
              </div>
            </div>
          </div>
          <div>
            <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2.5">分类标签</p>
            <div class="flex flex-wrap gap-1.5">
              <span v-if="detailNote.category" class="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold">{{ detailNote.category }}</span>
              <span v-for="tag in parseTags(detailNote)" :key="tag" class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-[var(--text-secondary)] text-[10px] font-bold border border-[var(--border-base)]">#{{ tag }}</span>
            </div>
          </div>
        </div>

        <div class="hidden md:flex pt-4 border-t border-[var(--border-base)] flex-col gap-2">
          <!-- Popular Toggle for Admins -->
          <el-button
            v-if="authStore.user?.role === 'ADMIN' && detailNote.visibility === 'PUBLIC'"
            class="w-full !rounded-xl font-bold"
            :type="detailNote.isPopular ? 'warning' : ''"
            @click="handleTogglePopular"
          >
            <Star class="w-3.5 h-3.5 mr-1.5" :class="{ 'fill-current': detailNote.isPopular }" />
            {{ detailNote.isPopular ? '取消热门' : '推荐热门' }}
          </el-button>

          <el-button class="w-full !rounded-xl font-bold" :type="detailNote.isLiked ? 'danger' : ''" @click="handleLike">
            <ThumbsUp class="w-3.5 h-3.5 mr-1.5" :class="{ 'fill-current': detailNote.isLiked }" />
            {{ detailNote.isLiked ? '已赞' : '点赞' }}
          </el-button>
          <el-button class="w-full !rounded-xl font-bold" :loading="isCopying" @click="handleCopy">
            <component :is="isCopying ? Check : Copy" class="w-3.5 h-3.5 mr-1.5" />
            {{ isCopying ? '已复制' : '复制全文' }}
          </el-button>
        </div>
      </aside>

      <div class="flex-1 bg-white dark:bg-[var(--bg-card)] overflow-y-auto custom-scrollbar">
        <div class="max-w-[800px] mx-auto px-3.5 md:px-8 py-5 md:py-10">
          <header class="mb-5 md:mb-8">
            <h1 class="text-xl md:text-3xl font-extrabold text-[var(--text-primary)] leading-tight mb-2 md:mb-3.5">{{ detailNote.title }}</h1>
            <div v-if="detailNote.summary" class="bg-slate-50 dark:bg-white/[0.02] rounded-xl p-3 md:p-4.5 text-[var(--text-secondary)] text-xs md:text-sm leading-relaxed border-l-4 border-l-accent">
              <span class="block text-[8px] md:text-[10px] font-black text-accent mb-1 tracking-widest uppercase">Abstract</span>
              {{ detailNote.summary }}
            </div>
          </header>
          <div class="modern-markdown-content">
            <MarkdownEditor :model-value="detailNote.content" preview-only />
          </div>
          <footer class="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-[var(--border-base)] text-center">
            <div class="inline-flex items-center gap-2 text-[var(--text-muted)] text-xs md:text-sm font-medium">
              <BookOpen class="w-4 h-4" />
              <span>END OF ARTICLE</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:deep(.modern-note-dialog) {
  border-radius: 1.5rem;
  overflow: hidden;
  border: none !important;
}
:deep(.modern-note-dialog .el-dialog__header) {
  display: none;
}
:deep(.modern-note-dialog .el-dialog__body) {
  padding: 0;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.modern-markdown-content :deep(.md-preview-custom) {
  font-size: 15px !important;
  line-height: 1.7 !important;
  color: var(--text-primary) !important;
}
:deep(.md-preview-custom h2) {
  font-size: 1.75rem !important;
  border-bottom: 1px solid var(--border-base) !important;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
