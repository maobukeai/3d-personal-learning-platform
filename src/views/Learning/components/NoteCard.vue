<script setup lang="ts">
import { formatDate } from '@/utils/format';
import { computed } from 'vue';
import {
  Eye,
  ThumbsUp,
  MessageSquare,
  Edit3,
  Trash2,
  Star,
  Flame,
  Share2,
  Calendar,
  Folder,
  Pin,
  FileText,
  Check,
  Github,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar.vue';
import { parseTags } from '@/utils/tags';

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
  isGithub?: boolean;
  githubRepo?: string;
  githubBranch?: string;
  githubPath?: string;
  createdAt: string;
  updatedAt: string;
}

const props = withDefaults(
  defineProps<{
    note: Note;
    index: number;
    activeTab: string;
    isMobile: boolean;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    viewMode?: 'grid' | 'list';
  }>(),
  {
    isSelectionMode: false,
    isSelected: false,
    viewMode: 'grid',
  },
);

const emit = defineEmits<{
  (e: 'click-detail', note: Note): void;
  (e: 'dragstart', event: DragEvent, note: Note): void;
  (e: 'edit', note: Note): void;
  (e: 'delete', note: Note): void;
  (e: 'popular-toggle', note: Note): void;
  (e: 'visibility-toggle', note: Note, visibility: string): void;
  (e: 'like', note: Note): void;
  (e: 'share', note: Note): void;
  (e: 'click-avatar', userId: string): void;
  (e: 'toggle-select', note: Note): void;
}>();

const authStore = useAuthStore();

const isDraggable = computed(() => {
  return (
    props.activeTab === 'MY' &&
    !props.isSelectionMode &&
    (props.note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN')
  );
});

const onDragStart = (event: DragEvent) => {
  emit('dragstart', event, props.note);
};

const getVisibilityLabel = (v: string) => (v === 'PUBLIC' ? '公开' : '私有');

const cleanSummary = computed(() => {
  if (props.note.summary) return props.note.summary;
  // Clean markdown notations to yield an elegant text preview
  return props.note.content
    .replace(/[#*`>_\-[\]()+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
});
const toggleVisibility = () => {
  if (props.note.userId !== authStore.user?.id) return;
  const newVisibility = props.note.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
  emit('visibility-toggle', props.note, newVisibility);
};
</script>

<template>
  <div
    class="bg-[var(--bg-card)] border rounded-xl p-3 sm:p-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex relative"
    :class="[
      isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      props.isSelected ? 'border-accent ring-1 ring-accent' : 'border-[var(--border-base)]',
      props.viewMode === 'list' && !props.isMobile
        ? 'flex-row items-center gap-4 w-full h-auto py-2.5 sm:py-3.5'
        : 'flex-col h-full',
    ]"
    :draggable="isDraggable"
    @click="
      props.isSelectionMode ? emit('toggle-select', props.note) : emit('click-detail', props.note)
    "
    @dragstart="onDragStart"
  >
    <!-- Batch Selection Checkbox overlay -->
    <div
      v-if="props.isSelectionMode"
      class="absolute top-3 left-3 z-30 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shadow-xs"
      :class="[
        props.isSelected
          ? 'bg-accent border-accent text-white'
          : 'bg-[var(--bg-card)] border-[var(--border-base)] text-transparent hover:border-accent',
      ]"
      @click.stop="emit('toggle-select', props.note)"
    >
      <Check class="w-3.5 h-3.5" />
    </div>

    <!-- Left Hover Glow Accent Line -->
    <div
      class="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-8 bg-accent rounded-r-md opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
      :class="{ hidden: props.isSelectionMode }"
    ></div>

    <!-- Pinned Note Corner Indicator -->
    <div
      v-if="props.note.isPinned"
      class="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-bl-xl transition-all"
      title="置顶笔记"
    >
      <Pin class="w-3.5 h-3.5 fill-current" />
    </div>

    <!-- Beautiful Glowing Rank Index on POPULAR leaderboard -->
    <div
      v-if="props.activeTab === 'POPULAR'"
      class="absolute -top-2 -left-2 z-10 flex items-center gap-1"
    >
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
      <span
        class="px-2 py-0.5 text-[8px] font-black text-red-500 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center gap-0.5 shadow-sm"
      >
        <Flame class="w-2.5 h-2.5 text-red-500 fill-current animate-pulse" />
        {{
          Math.round(
            props.note.views * 1 +
              props.note._count.likes * 5 +
              (props.note._count.comments || 0) * 10,
          )
        }}
        热度
      </span>
    </div>

    <!-- Header Meta Row -->
    <div
      class="mobile-row flex items-start justify-between gap-1.5 min-w-0"
      :class="props.viewMode === 'list' && !props.isMobile ? 'mb-0 shrink-0' : 'mb-3.5'"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span class="md:hidden shrink-0">
          <UserAvatar
            :user="props.note.user"
            size="xs"
            class="ring-1 ring-[var(--border-base)] cursor-pointer hover:ring-2 hover:ring-accent transition-all"
            @click.stop="emit('click-avatar', props.note.user.id)"
          />
        </span>
        <span class="hidden md:inline-flex shrink-0">
          <UserAvatar
            :user="props.note.user"
            size="sm"
            class="ring-1 ring-[var(--border-base)] cursor-pointer hover:ring-2 hover:ring-accent transition-all"
            @click.stop="emit('click-avatar', props.note.user.id)"
          />
        </span>
        <div class="min-w-0">
          <p
            class="text-xs md:text-sm font-bold text-[var(--text-primary)] leading-none truncate hover:text-accent transition-colors duration-300 cursor-pointer"
            @click.stop="emit('click-avatar', props.note.user.id)"
          >
            {{ props.note.user.name }}
          </p>
          <div
            class="flex items-center gap-1 text-[9px] md:text-[10px] text-[var(--text-muted)] mt-1.5 flex-wrap"
          >
            <Calendar class="w-2.5 h-2.5 shrink-0" />
            <span>{{ formatDate(props.note.createdAt) }}</span>
            <span
              v-if="props.note.category"
              class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold bg-accent/5 dark:bg-accent/15 border border-accent/15 text-accent shrink-0 truncate max-w-[80px] sm:max-w-[120px]"
            >
              <Folder class="w-2.5 h-2.5 text-accent shrink-0" />
              {{ props.note.category }}
            </span>
          </div>
        </div>
      </div>
      <div
        class="flex items-center gap-1 shrink-0 transition-all duration-300"
        :class="{
          'group-hover:opacity-0 group-hover:scale-90 group-hover:pointer-events-none':
            props.note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN',
        }"
      >
        <Badge
          v-if="props.note.isPopular && props.activeTab !== 'POPULAR'"
          type="warning"
          size="small"
          round
          effect="dark"
          class="px-1 md:px-2"
          >热</Badge
        >

        <Badge
          v-if="props.note.isGithub"
          type="info"
          size="small"
          round
          effect="plain"
          class="w-6 h-6 p-0 flex items-center justify-center border-slate-300/30 text-slate-600 dark:text-slate-400 shrink-0"
          title="GitHub 导入的笔记"
        >
          <Github class="w-3.5 h-3.5 shrink-0" />
        </Badge>

        <!-- Custom Visibility Badge -->
        <span
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold border transition-all duration-300"
          :class="[
            props.note.visibility === 'PUBLIC'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-500/10 border-slate-500/20 text-slate-500 dark:text-slate-400',
            props.note.userId === authStore.user?.id
              ? 'cursor-pointer hover:bg-emerald-500/20 hover:border-emerald-500/40 select-none'
              : 'cursor-default',
          ]"
          :title="props.note.userId === authStore.user?.id ? '点击切换公开/私密状态' : undefined"
          @click.stop="toggleVisibility"
        >
          <span
            class="w-1 h-1 rounded-full shrink-0"
            :class="
              props.note.visibility === 'PUBLIC' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            "
          ></span>
          {{ getVisibilityLabel(props.note.visibility) }}
        </span>
      </div>
    </div>

    <!-- Title -->
    <h3
      class="text-xs sm:text-sm md:text-base font-extrabold line-clamp-1 group-hover:text-accent transition-colors duration-300 flex items-center gap-1.5"
      :class="props.viewMode === 'list' && !props.isMobile ? 'mb-0 flex-1' : 'mb-1.5 md:mb-2'"
    >
      <FileText
        class="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-accent transition-colors shrink-0"
      />
      {{ props.note.title }}
    </h3>

    <!-- Summary Snippet -->
    <p
      v-if="props.viewMode !== 'list' || props.isMobile"
      class="text-[11px] sm:text-xs md:text-sm text-[var(--text-secondary)]/90 line-clamp-2 md:line-clamp-3 mb-3 md:mb-4 flex-1 leading-relaxed"
    >
      {{ cleanSummary }}
    </p>

    <!-- Tags Row -->
    <div
      v-if="parseTags(props.note.tags).length"
      class="flex flex-wrap gap-1"
      :class="
        props.viewMode === 'list' && !props.isMobile ? 'mb-0 hidden sm:flex' : 'mb-2.5 md:mb-3.5'
      "
    >
      <span
        v-for="tag in parseTags(props.note.tags).slice(0, props.isMobile ? 1 : 3)"
        :key="tag"
        class="px-2 py-0.5 rounded bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[9px] md:text-[10px] font-bold border border-purple-500/15 whitespace-nowrap truncate max-w-[80px] hover:bg-purple-500/10 transition-all duration-200"
      >
        #{{ tag }}
      </span>
    </div>

    <!-- Fading Gradient Divider Line -->
    <div
      v-if="props.viewMode !== 'list' || props.isMobile"
      class="h-[1px] bg-gradient-to-r from-transparent via-[var(--border-base)] to-transparent my-1.5 md:my-2"
    ></div>

    <!-- Footer Stats Row -->
    <div
      class="mobile-row flex items-center justify-between gap-1 shrink-0"
      :class="props.viewMode === 'list' && !props.isMobile ? 'mt-0' : 'mt-auto'"
    >
      <div
        class="flex items-center gap-2 md:gap-3.5 text-[9px] md:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0"
      >
        <span
          class="flex items-center gap-1 hover:text-purple-500 transition-colors duration-200"
          title="阅读量"
        >
          <Eye class="w-3.5 h-3.5" /> {{ props.note.views }}
        </span>
        <span
          class="flex items-center gap-1 cursor-pointer hover:text-red-500 hover:scale-105 active:scale-95 transition-all duration-200"
          :class="{ 'text-red-500': props.note.isLiked }"
          title="点赞"
          @click.stop="emit('like', props.note)"
        >
          <ThumbsUp
            class="w-3.5 h-3.5 transition-transform duration-200"
            :class="{ 'fill-current': props.note.isLiked }"
          />
          {{ props.note._count.likes }}
        </span>
        <span
          class="flex items-center gap-1 hover:text-blue-500 transition-colors duration-200"
          title="评论"
        >
          <MessageSquare class="w-3.5 h-3.5" /> {{ props.note._count.comments || 0 }}
        </span>
      </div>
    </div>

    <!-- Hover Glass Action Menu (Pill Bar) -->
    <div
      class="absolute top-2 right-2 flex gap-1 items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-[var(--border-base)] shadow-lg rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 z-20"
      :class="{ '!right-8': props.note.isPinned }"
      @click.stop
    >
      <!-- Share for Owner -->
      <button
        v-if="props.note.userId === authStore.user?.id"
        type="button"
        class="p-1 hover:text-purple-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-90"
        title="分享笔记"
        @click="emit('share', props.note)"
      >
        <Share2 class="w-3.5 h-3.5" />
      </button>

      <!-- Edit for Owner -->
      <button
        v-if="props.note.userId === authStore.user?.id"
        type="button"
        class="p-1 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-90"
        title="编辑笔记"
        @click="emit('edit', props.note)"
      >
        <Edit3 class="w-3.5 h-3.5" />
      </button>

      <!-- Popular toggle for Admin -->
      <button
        v-if="authStore.user?.role === 'ADMIN' && props.note.visibility === 'PUBLIC'"
        type="button"
        class="p-1 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-90"
        :class="{ 'text-amber-500': props.note.isPopular }"
        title="置顶/精选"
        @click="emit('popular-toggle', props.note)"
      >
        <Star class="w-3.5 h-3.5" :class="{ 'fill-current': props.note.isPopular }" />
      </button>

      <!-- Delete for Owner or Admin -->
      <button
        v-if="props.note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
        type="button"
        class="p-1 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-90"
        title="删除笔记"
        @click="emit('delete', props.note)"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Smooth micro-interaction transitions */
.group:hover {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border-base));
}
</style>
