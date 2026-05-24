<script setup lang="ts">
import { computed } from 'vue';
import {
  Heart,
  MessageSquare,
  Eye,
  Pin,
  Trash2,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import type { User } from '@/types';

interface DiscussionCardItem {
  id: string;
  title: string;
  content: string;
  tags: string | null;
  images: string | null;
  isPinned?: boolean;
  isLiked?: boolean;
  viewCount?: number;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatarUrl'> & { email?: string | null };
  comments: DiscussionCardComment[];
  _count: {
    likes: number;
    comments: number;
    replies: number;
  };
}

interface DiscussionCardComment {
  id: string;
  content: string;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatarUrl'> & { email?: string | null };
  parentId?: string | null;
  replies: DiscussionCardComment[];
  isLiked?: boolean;
  _count: {
    likes: number;
    comments: number;
    replies: number;
  };
}

const props = withDefaults(
  defineProps<{
    discussion: DiscussionCardItem;
    currentUserId?: string;
    isAdmin?: boolean;
  }>(),
  {
    currentUserId: '',
    isAdmin: false,
  }
);

const emit = defineEmits<{
  (e: 'click', id: string): void;
  (e: 'like', discussion: DiscussionCardItem, event: Event): void;
  (e: 'pin', discussion: DiscussionCardItem, event: Event): void;
  (e: 'delete', discussion: DiscussionCardItem, event: Event): void;
}>();

const isOwner = computed(() => {
  return props.currentUserId === props.discussion?.user?.id;
});

const parsedTags = computed(() => {
  try {
    const tagsStr = props.discussion?.tags;
    const parsed = tagsStr ? JSON.parse(tagsStr) : [];
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch (_e) {
    return [];
  }
});

const parsedImages = computed(() => {
  try {
    const imagesStr = props.discussion?.images;
    const parsed = imagesStr ? JSON.parse(imagesStr) : [];
    return Array.isArray(parsed) ? parsed.filter((img): img is string => typeof img === 'string') : [];
  } catch (_e) {
    return [];
  }
});

const formattedTime = computed(() => {
  if (!props.discussion?.createdAt) return '';
  const date = new Date(props.discussion.createdAt);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString();
});

function handleCardClick() {
  emit('click', props.discussion.id);
}

function handleLikeClick(event: Event) {
  emit('like', props.discussion, event);
}

function handlePinClick(event: Event) {
  emit('pin', props.discussion, event);
}

function handleDeleteClick(event: Event) {
  emit('delete', props.discussion, event);
}
</script>

<template>
  <div
    class="group p-2 sm:p-2.5 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-xl hover:shadow-lg hover:-translate-y-0.5 cursor-pointer relative transition-all duration-300"
    :class="discussion.isPinned ? 'ring-1 ring-accent' : ''"
    @click="handleCardClick"
  >
    <!-- Pinned Badge -->
    <div
      v-if="discussion.isPinned"
      class="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7.5px] sm:text-[8px] font-bold"
      style="background-color: var(--accent); color: white"
    >
      <Pin class="w-2 h-2" /> 置顶
    </div>

    <div class="flex gap-2 sm:gap-2.5">
      <UserAvatar :user="discussion.user" size="xs" class="shrink-0" />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 mb-0">
          <span
            class="text-[10px] sm:text-[11px] font-bold"
            style="color: var(--text-primary)"
          >
            {{ discussion.user?.name || '匿名用户' }}
          </span>
          <span class="text-[8px] sm:text-[9px]" style="color: var(--text-muted)">
            {{ formattedTime }}
          </span>
        </div>

        <h3
          class="text-[11px] sm:text-xs font-black mb-0 group-hover:text-accent transition-colors pr-10 sm:pr-14"
          style="color: var(--text-primary)"
        >
          {{ discussion.title }}
        </h3>
        <p
          class="text-[9px] sm:text-[10px] line-clamp-2 mb-1 sm:mb-1.5 leading-relaxed"
          style="color: var(--text-secondary)"
        >
          {{ discussion.content }}
        </p>

        <!-- Tags -->
        <div v-if="parsedTags.length > 0" class="flex flex-wrap gap-1 mb-1 sm:mb-1.5">
          <span
            v-for="tag in parsedTags"
            :key="tag"
            class="px-1 py-0.1 rounded-full text-[7.5px] sm:text-[8.5px] font-bold"
            style="background-color: var(--bg-app); color: var(--accent)"
          >
            #{{ tag }}
          </span>
        </div>

        <!-- Image Preview in List -->
        <div
          v-if="parsedImages.length > 0"
          class="flex gap-1 mb-1 sm:mb-1.5 overflow-hidden h-9 sm:h-10"
        >
          <div
            v-for="(img, idx) in parsedImages.slice(0, 3)"
            :key="idx"
            class="w-9 h-9 sm:w-10 sm:h-10 rounded-md overflow-hidden shrink-0 border border-slate-100 dark:border-white/5"
          >
            <img alt="" :src="img" class="w-full h-full object-cover" />
          </div>
          <div
            v-if="parsedImages.length > 3"
            class="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[8px] font-bold text-slate-400"
          >
            +{{ parsedImages.length - 3 }}
          </div>
        </div>

        <!-- Actions Bar -->
        <div
          class="flex items-center gap-3 text-[8.5px] sm:text-[9.5px] font-bold"
          style="color: var(--text-muted)"
        >
          <button type="button" class="flex items-center gap-0.5 hover:text-red-500 transition-colors cursor-pointer" :class="{ 'text-red-500': discussion.isLiked }" @click.stop="handleLikeClick">
            <Heart
              class="w-2.5 h-2.5 sm:w-3 sm:h-3"
              :class="{ 'fill-red-500': discussion.isLiked }"
            />
            <span>{{ discussion._count?.likes || 0 }}</span>
          </button>
          <div class="flex items-center gap-0.5">
            <MessageSquare class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            <span>{{ discussion._count?.comments || 0 }}</span>
          </div>
          <div class="flex items-center gap-0.5">
            <Eye class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            <span>{{ discussion.viewCount || 0 }}</span>
          </div>

          <!-- Admin/Owner Actions -->
          <div
            v-if="isOwner || isAdmin"
            class="flex items-center gap-1 ml-auto"
          >
            <button v-if="isAdmin" type="button" class="hover:text-accent transition-colors p-0.5 cursor-pointer" @click.stop="handlePinClick">
              <Pin class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
            <button type="button" class="hover:text-red-500 transition-colors p-0.5 cursor-pointer" @click.stop="handleDeleteClick">
              <Trash2 class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
