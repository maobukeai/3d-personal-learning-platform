<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import {
  ThumbsUp,
  MessageSquare,
  Bookmark,
  Edit3,
  Trash2,
  Flame,
  BookOpen
} from 'lucide-vue-next';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar.vue';

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

interface NoteComment {
  id: string;
  content: string;
  userId: string;
  createdAt: string;
  user: Note['user'];
}

const props = defineProps<{
  notes: Note[];
  tags: string[];
  categories: string[];
  totalNotes: number;
  filterTag: string;
  filterCategory: string;
}>();

const emit = defineEmits<{
  (e: 'click-detail', note: Note): void;
  (e: 'like', note: Note): void;
  (e: 'clone', note: Note): void;
  (e: 'edit', note: Note): void;
  (e: 'delete', note: Note): void;
  (e: 'filter-tag', tag: string): void;
  (e: 'filter-category', category: string): void;
}>();

const authStore = useAuthStore();

// Comment states
const noteCommentsMap = ref<Record<string, NoteComment[]>>({});
const activeCommentsNoteId = ref<string | null>(null);
const commentInputText = ref('');
const commentsLoading = ref<Record<string, boolean>>({});

const toggleComments = async (note: Note) => {
  if (activeCommentsNoteId.value === note.id) {
    activeCommentsNoteId.value = null;
    return;
  }
  activeCommentsNoteId.value = note.id;
  if (!noteCommentsMap.value[note.id]) {
    commentsLoading.value[note.id] = true;
    try {
      const res = await api.get(`/api/notes/${note.id}/comments`);
      noteCommentsMap.value[note.id] = res.data;
    } catch {
      ElMessage.error('加载评论失败');
    } finally {
      commentsLoading.value[note.id] = false;
    }
  }
};

const submitComment = async (note: Note) => {
  if (!commentInputText.value.trim()) return;
  try {
    const res = await api.post(`/api/notes/${note.id}/comment`, {
      content: commentInputText.value.trim(),
    });
    if (!noteCommentsMap.value[note.id]) {
      noteCommentsMap.value[note.id] = [];
    }
    noteCommentsMap.value[note.id].push(res.data);
    commentInputText.value = '';
    
    // Increment comments count locally
    if (note._count) {
      note._count.comments = (note._count.comments || 0) + 1;
    } else {
      note._count = { likes: 0, comments: 1 };
    }
    ElMessage.success('发布评论成功');
  } catch {
    ElMessage.error('发布评论失败');
  }
};

const handleDeleteComment = async (note: Note, commentId: string) => {
  try {
    await api.delete(`/api/notes/comment/${commentId}`);
    noteCommentsMap.value[note.id] = noteCommentsMap.value[note.id].filter(
      (c) => c.id !== commentId
    );
    if (note._count && note._count.comments > 0) {
      note._count.comments--;
    }
    ElMessage.success('评论已删除');
  } catch {
    ElMessage.error('删除评论失败');
  }
};

const dailyQuotes = [
  "学而不思则罔，思而不学则殆。记录每一次心得，都是成长的印记。",
  "成功的秘诀在于持之以恒的积累。每一篇笔记都是通往精通的阶梯。",
  "将复杂的知识写下来、讲出来，这是最顶级的学习方法——费曼学习法。",
  "智能的本质不在于获取多少现成答案，而在于探索未知的过程。—— 爱因斯坦",
  "精于工，匠于心；创于想，行于行。保持好奇，不断打磨你的3D视界！"
];
const dailyQuote = computed(() => {
  const day = new Date().getDate();
  return dailyQuotes[day % dailyQuotes.length];
});

const topContributors = computed(() => {
  const counts: Record<string, { user: Note['user']; count: number }> = {};
  props.notes.forEach((note) => {
    if (note.user && note.user.id) {
      const uid = note.user.id;
      if (!counts[uid]) {
        counts[uid] = { user: note.user, count: 0 };
      }
      counts[uid].count++;
    }
  });
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
});

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
</script>

<template>
  <div class="flex flex-col xl:flex-row gap-5 items-start w-full animate-fade-in">
    <!-- Central Timeline Column -->
    <div class="flex-1 min-w-0 w-full space-y-3.5">
      <div
        v-for="note in props.notes"
        :key="note.id"
        class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-3 sm:p-3.5 md:p-4 shadow-sm flex flex-col gap-2.5 relative transition-all hover:shadow-md cursor-default animate-fade-in"
      >
        <!-- Top Author & Info (Inline single row Twitter-style) -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <UserAvatar :user="note.user" size="xs" class="shrink-0" />
            <div class="flex items-center gap-1.5 text-xs font-black text-[var(--text-primary)]">
              <span>{{ note.user.name }}</span>
              <span class="text-[9px] text-[var(--text-muted)] font-normal">• {{ formatDate(note.createdAt) }}</span>
            </div>
          </div>
          <!-- Right Tag -->
          <span
            v-if="note.category"
            class="text-[8px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded-full uppercase shrink-0"
          >
            {{ note.category }}
          </span>
        </div>

        <!-- Title & Markdown content snippet (Line clamp 2 for tight density) -->
        <div class="cursor-pointer" @click="emit('click-detail', note)">
          <h3 class="text-xs sm:text-sm md:text-base font-extrabold text-[var(--text-primary)] hover:text-accent transition-colors leading-snug">
            {{ note.title }}
          </h3>
          <p class="text-[11px] sm:text-xs md:text-sm text-[var(--text-secondary)] mt-1 leading-relaxed line-clamp-2">
            {{ note.summary || note.content.replace(/[#*`>]/g, '').slice(0, 200) }}
          </p>
        </div>

        <!-- Tags (Super compact) -->
        <div v-if="parseTags(note).length" class="flex flex-wrap gap-1 my-0.5">
          <span
            v-for="tag in parseTags(note)"
            :key="tag"
            class="px-2 py-0.5 rounded-full bg-slate-50 dark:bg-white/5 text-[var(--text-muted)] text-[9px] font-bold border border-[var(--border-base)]"
          >
            #{{ tag }}
          </span>
        </div>

        <!-- Bottom Social Toolbar -->
        <div class="flex items-center justify-between mt-1 pt-2.5 border-t border-[var(--border-base)]">
          <div class="flex items-center gap-5 text-[10px] md:text-xs font-bold text-[var(--text-muted)]">
            <!-- Likes -->
            <button type="button" class="flex items-center gap-1.5 cursor-pointer hover:text-red-500 transition-colors" :class="[note.isLiked ? 'text-red-500' : '']" @click.stop="emit('like', note)">
              <ThumbsUp class="w-3.5 h-3.5" :class="[note.isLiked ? 'fill-current' : '']" />
              <span>{{ note._count.likes }}</span>
            </button>

            <!-- Comments -->
            <button type="button" class="flex items-center gap-1.5 cursor-pointer hover:text-accent transition-colors" :class="[activeCommentsNoteId === note.id ? 'text-accent' : '']" @click.stop="toggleComments(note)">
              <MessageSquare class="w-3.5 h-3.5" />
              <span>{{ note._count.comments || 0 }}</span>
            </button>
          </div>

          <!-- 一键转存 (Clip/Save) button -->
          <button v-if="note.userId !== authStore.user?.id" type="button" class="flex items-center gap-1 text-[9px] font-black text-accent hover:text-accent-dark hover:bg-accent/5 px-2 py-0.5 rounded-lg transition-all cursor-pointer" @click.stop="emit('clone', note)">
            <Bookmark class="w-3 h-3" />
            <span>一键转存</span>
          </button>
          
          <div v-else class="flex gap-1">
            <button type="button" class="p-1 text-[var(--text-secondary)] hover:text-accent transition-all cursor-pointer" @click.stop="emit('edit', note)">
              <Edit3 class="w-3 h-3" />
            </button>
            <button type="button" class="p-1 text-red-500 hover:text-red-600 transition-all cursor-pointer" @click.stop="emit('delete', note)">
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>

        <!-- Comments Sub-drawer (Highly Compact chat bubbles) -->
        <Transition name="slide-fade">
          <div v-if="activeCommentsNoteId === note.id" class="mt-2.5 pt-2.5 border-t border-[var(--border-base)] flex flex-col gap-2.5">
            
            <!-- Loader -->
            <div v-if="commentsLoading[note.id]" class="flex justify-center py-2">
              <el-icon class="is-loading" :size="16"><Loading /></el-icon>
            </div>

            <!-- Empty state -->
            <div v-else-if="!noteCommentsMap[note.id] || !noteCommentsMap[note.id].length" class="text-center py-2 text-[10px] text-[var(--text-muted)] font-bold">
              暂无评论，留下你的一笔启发吧~
            </div>

            <!-- Comments List -->
            <div v-else class="flex flex-col gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              <div v-for="c in noteCommentsMap[note.id] || []" :key="c.id" class="flex gap-2 items-start">
                <UserAvatar :user="c.user" size="xs" class="shrink-0 mt-0.5" />
                <div class="flex-1 bg-slate-50 dark:bg-white/[0.02] border border-[var(--border-base)] rounded-xl p-2 relative group/comment">
                  <div class="flex items-center justify-between gap-2 leading-none">
                    <span class="text-[9px] font-black text-[var(--text-primary)]">{{ c.user?.name || '用户' }}</span>
                    <span class="text-[8px] text-[var(--text-muted)]">{{ formatDate(c.createdAt) }}</span>
                  </div>
                  <p class="text-[10px] md:text-[11px] text-[var(--text-secondary)] mt-1 whitespace-pre-line leading-relaxed">
                    {{ c.content }}
                  </p>
                  
                  <!-- Delete action -->
                  <button v-if="c.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'" type="button" class="absolute right-2 top-2 opacity-0 group-hover/comment:opacity-100 text-red-500 hover:text-red-600 transition-all cursor-pointer" title="删除评论" @click.stop="handleDeleteComment(note, c.id)">
                    <Trash2 class="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Write comment input box -->
            <div class="flex gap-2 items-center mt-0.5">
              <el-input
                v-model="commentInputText"
                placeholder="写下你的想法，一起讨论交流..."
                size="small"
                class="flex-1 rounded-xl"
                clearable
                @keyup.enter="submitComment(note)"
              />
              <el-button type="primary" size="small" round class="font-bold shrink-0 shadow-sm shadow-accent/10" @click="submitComment(note)">
                发送
              </el-button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Right Sidebar for ACTIVITY Tab on Desktop (xl and up) -->
    <aside class="hidden xl:flex flex-col w-80 shrink-0 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-4 space-y-4 shadow-sm sticky top-20">
      <div class="border-b border-[var(--border-base)] pb-2.5">
        <h3 class="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
          <Flame class="w-4 h-4 text-red-500 fill-current animate-pulse" /> 社区动态观察
        </h3>
      </div>

      <!-- Daily Quote (今日学习寄语) -->
      <div class="pt-0.5">
        <div class="bg-gradient-to-br from-accent/5 to-purple-500/5 dark:from-accent/10 dark:to-purple-500/10 border border-[var(--border-base)] p-3.5 rounded-xl relative overflow-hidden backdrop-blur-sm group/quote">
          <div class="absolute -right-3 -bottom-3 text-accent/10 pointer-events-none transition-transform group-hover/quote:scale-110 duration-500">
            <BookOpen class="w-16 h-16" />
          </div>
          <p class="text-[8px] font-black text-accent uppercase tracking-wider mb-1">今日灵感寄语</p>
          <p class="text-[10px] text-[var(--text-secondary)] font-bold leading-relaxed italic">
            “ {{ dailyQuote }} ”
          </p>
        </div>
      </div>

      <!-- Today Stats -->
      <div class="space-y-2 pt-1.5">
        <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">动态看板</p>
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-slate-50 dark:bg-white/[0.02] border border-[var(--border-base)] p-2 rounded-xl border-dashed">
            <p class="text-[8px] text-[var(--text-muted)] mb-0.5">全站动态</p>
            <p class="text-xs font-black text-[var(--text-primary)]">{{ props.totalNotes }} 条</p>
          </div>
          <div class="bg-slate-50 dark:bg-white/[0.02] border border-[var(--border-base)] p-2 rounded-xl border-dashed">
            <p class="text-[8px] text-[var(--text-muted)] mb-0.5">标签话题</p>
            <p class="text-xs font-black text-[var(--text-primary)]">{{ props.tags.length }} 个</p>
          </div>
        </div>
      </div>

      <!-- Top Contributors (活跃学霸榜) -->
      <div v-if="topContributors.length" class="space-y-2 pt-1.5">
        <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">活跃学霸榜</p>
        <div class="flex flex-col gap-1.5">
          <div v-for="(item, idx) in topContributors" :key="item.user.id" class="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
            <div class="flex items-center gap-2 min-w-0">
              <div class="relative shrink-0">
                <UserAvatar :user="item.user" size="xs" />
                <span class="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-accent/80 text-white flex items-center justify-center font-bold text-[8px] border border-white dark:border-slate-800 scale-90">
                  {{ idx + 1 }}
                </span>
              </div>
              <span class="text-[10px] font-bold text-[var(--text-primary)] truncate">{{ item.user.name }}</span>
            </div>
            <span class="text-[8px] font-black text-accent bg-accent/5 px-2 py-0.5 rounded-full shrink-0 border border-accent/10">
              {{ item.count }} 动态
            </span>
          </div>
        </div>
      </div>
      
      <!-- Tag cloud -->
      <div class="space-y-2 pt-1.5">
        <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">热门标签话题</p>
        <div class="flex flex-wrap gap-1">
          <button v-for="t in props.tags.slice(0, 12)" :key="t" type="button" class="px-2 py-0.5 rounded-full bg-slate-50 dark:bg-white/5 text-[var(--text-secondary)] text-[9px] font-bold border border-[var(--border-base)] hover:border-accent hover:text-accent transition-all cursor-pointer animate-fade-in" :class="[props.filterTag === t ? '!border-accent !text-accent bg-accent/5' : '']" @click="emit('filter-tag', props.filterTag === t ? '' : t)">
            #{{ t }}
          </button>
          <span v-if="!props.tags.length" class="text-[10px] text-[var(--text-muted)]">暂无话题</span>
        </div>
      </div>

      <!-- Active Category List -->
      <div class="space-y-2 pt-1.5">
        <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">推荐笔记本/分类</p>
        <div class="flex flex-col gap-1">
          <button v-for="c in props.categories.slice(0, 5)" :key="c" type="button" class="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[9px] font-bold transition-all text-left text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer border border-transparent" :class="[props.filterCategory === c ? '!border-accent !text-accent bg-accent/5 font-black' : '']" @click="emit('filter-category', props.filterCategory === c ? '' : c)">
            <span class="truncate">📁 {{ c }}</span>
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}

/* slide-fade transition */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.25s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
