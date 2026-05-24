<script setup lang="ts">
import { computed } from 'vue';
import { Eye, ThumbsUp, MessageSquare, Edit3, Trash2, Star, Flame } from 'lucide-vue-next';
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

const props = defineProps<{
  note: Note;
  index: number;
  activeTab: string;
  isMobile: boolean;
}>();

const emit = defineEmits<{
  (e: 'click-detail', note: Note): void;
  (e: 'dragstart', event: DragEvent, note: Note): void;
  (e: 'edit', note: Note): void;
  (e: 'delete', note: Note): void;
  (e: 'popular-toggle', note: Note): void;
  (e: 'like', note: Note): void;
}>();

const authStore = useAuthStore();

const isDraggable = computed(() => {
  return props.activeTab === 'MY' && (props.note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN');
});

const onDragStart = (event: DragEvent) => {
  emit('dragstart', event, props.note);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getVisibilityLabel = (v: string) => (v === 'PUBLIC' ? '公开' : '私有');
const getVisibilityTag = (v: string) => (v === 'PUBLIC' ? 'success' : 'info');

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
  <div
    class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-xl p-2.5 sm:p-3.5 lg:p-4 hover:shadow-xl hover:-translate-y-0.5 transition-all group flex flex-col h-full relative"
    :class="[isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer']"
    :draggable="isDraggable"
    @click="emit('click-detail', props.note)"
    @dragstart="onDragStart"
  >
    <!-- Beautiful Glowing Rank Index on POPULAR leaderboard -->
    <div v-if="props.activeTab === 'POPULAR'" class="absolute -top-2 -left-2 z-10 flex items-center gap-1">
      <span
        v-if="props.index === 0"
        class="px-2.5 py-0.5 text-[9px] font-black text-white rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 shadow-md shadow-amber-500/20 border border-yellow-300 flex items-center gap-0.5"
      >
        👑 #1
      </span>
      <span
        v-else-if="props.index === 1"
        class="px-2.5 py-0.5 text-[9px] font-black text-white rounded-full bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500 shadow-md shadow-slate-500/20 border border-slate-200 flex items-center gap-0.5"
      >
        🥈 #2
      </span>
      <span
        v-else-if="props.index === 2"
        class="px-2.5 py-0.5 text-[9px] font-black text-white rounded-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-800 shadow-md shadow-orange-500/20 border border-orange-500 flex items-center gap-0.5"
      >
        🥉 #3
      </span>
      <span
        v-else
        class="px-2 py-0.5 text-[8px] font-black text-[var(--text-secondary)] rounded-full bg-slate-100 dark:bg-white/10 border border-[var(--border-base)]"
      >
        #{{ props.index + 1 }}
      </span>

      <!-- Hotness Rating tag -->
      <span class="px-2 py-0.5 text-[8px] font-black text-red-500 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center gap-0.5 shadow-sm">
        <Flame class="w-2.5 h-2.5 text-red-500 fill-current animate-pulse" />
        {{ Math.round(props.note.views * 1 + props.note._count.likes * 5 + (props.note._count.comments || 0) * 10) }} 热度
      </span>
    </div>

    <div class="flex items-start justify-between mb-1.5 md:mb-2.5 gap-1 min-w-0">
      <div class="flex items-center gap-1.5 md:gap-2.5 min-w-0">
        <UserAvatar :user="props.note.user" size="xs" class="md:hidden shrink-0" />
        <UserAvatar :user="props.note.user" size="sm" class="hidden md:inline-flex shrink-0" />
        <div class="min-w-0">
          <p class="text-xs md:text-sm font-bold text-[var(--text-primary)] leading-none truncate">
            {{ props.note.user.name }}
          </p>
          <p class="hidden sm:block text-[9px] md:text-[10px] text-[var(--text-muted)] mt-1">
            {{ formatDate(props.note.createdAt) }}
          </p>
        </div>
      </div>
      <div
        class="flex items-center gap-1 shrink-0 transition-all duration-300"
        :class="{ 'group-hover:opacity-0 group-hover:scale-90 group-hover:pointer-events-none': props.note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN' }"
      >
        <el-tag v-if="props.note.isPopular && props.activeTab !== 'POPULAR'" type="warning" size="small" round effect="dark" class="px-1 md:px-2">热</el-tag>
        <el-tag :type="getVisibilityTag(props.note.visibility)" size="small" round class="px-1 md:px-2">
          <span class="hidden sm:inline">{{ getVisibilityLabel(props.note.visibility) }}</span>
          <span class="sm:hidden">{{ props.note.visibility === 'PUBLIC' ? '公' : '私' }}</span>
        </el-tag>
      </div>
    </div>

    <h3
      class="text-xs sm:text-sm md:text-base font-bold mb-1 md:mb-1.5 line-clamp-1 group-hover:text-accent transition-colors"
    >
      {{ props.note.title }}
    </h3>
    <p
      class="text-[11px] sm:text-xs md:text-sm text-[var(--text-secondary)] line-clamp-2 md:line-clamp-3 mb-1.5 md:mb-2.5 flex-1 leading-relaxed"
    >
      {{ props.note.summary || props.note.content.replace(/[#*`>]/g, '').slice(0, 150) }}
    </p>

    <div v-if="parseTags(props.note).length" class="flex flex-wrap gap-1 mb-2 md:mb-3">
      <span
        v-for="tag in parseTags(props.note).slice(0, props.isMobile ? 1 : 3)"
        :key="tag"
        class="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-white/5 text-[var(--text-muted)] text-[9px] md:text-[10px] font-bold border border-[var(--border-base)] whitespace-nowrap truncate max-w-[80px]"
      >
        #{{ tag }}
      </span>
    </div>

    <div
      class="flex items-center justify-between mt-auto pt-1.5 md:pt-3 border-t border-[var(--border-base)] gap-1"
    >
      <div
        class="flex items-center gap-2 md:gap-4 text-[9px] md:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0"
      >
        <span class="flex items-center gap-1">
          <Eye class="w-3 md:w-3.5 h-3 md:h-3.5" /> {{ props.note.views }}
        </span>
        <span
          class="flex items-center gap-1 cursor-pointer hover:text-red-500 transition-colors"
          :class="{ 'text-red-500': props.note.isLiked }"
          @click.stop="emit('like', props.note)"
        >
          <ThumbsUp class="w-3 md:w-3.5 h-3 md:h-3.5" :class="{ 'fill-current': props.note.isLiked }" />
          {{ props.note._count.likes }}
        </span>
        <span class="flex items-center gap-1">
          <MessageSquare class="w-3 md:w-3.5 h-3 md:h-3.5" /> {{ props.note._count.comments || 0 }}
        </span>
      </div>
      <span
        v-if="props.note.category"
        class="text-[8px] md:text-[10px] font-black text-accent bg-accent/10 px-1.5 py-0.5 rounded uppercase truncate max-w-[50px] sm:max-w-[80px]"
      >
        {{ props.note.category }}
      </span>
    </div>

    <!-- Hover Actions -->
    <div
      class="absolute top-1.5 md:top-2.5 right-1.5 md:right-2.5 flex gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0"
    >
      <!-- Edit for Owner -->
      <el-button
        v-if="props.note.userId === authStore.user?.id"
        circle
        size="small"
        class="!p-1"
        @click.stop="emit('edit', props.note)"
      >
        <Edit3 class="w-3 h-3 md:w-3.5 md:h-3.5" />
      </el-button>

      <!-- Popular toggle for Admin (on public notes) -->
      <el-button
        v-if="authStore.user?.role === 'ADMIN' && props.note.visibility === 'PUBLIC'"
        circle
        size="small"
        :type="props.note.isPopular ? 'warning' : ''"
        class="!p-1"
        @click.stop="emit('popular-toggle', props.note)"
      >
        <Star class="w-3 h-3 md:w-3.5 md:h-3.5" :class="{ 'fill-current': props.note.isPopular }" />
      </el-button>

      <!-- Delete for Owner or Admin -->
      <el-button
        v-if="props.note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
        circle
        size="small"
        type="danger"
        class="!p-1"
        @click.stop="emit('delete', props.note)"
      >
        <Trash2 class="w-3 h-3 md:w-3.5 md:h-3.5" />
      </el-button>
    </div>
  </div>
</template>
