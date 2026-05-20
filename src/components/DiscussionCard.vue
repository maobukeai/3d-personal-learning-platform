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

const props = withDefaults(
  defineProps<{
    discussion: any;
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
  (e: 'like', discussion: any, event: Event): void;
  (e: 'pin', discussion: any, event: Event): void;
  (e: 'delete', discussion: any, event: Event): void;
}>();

const isOwner = computed(() => {
  return props.currentUserId === props.discussion?.user?.id;
});

const parsedTags = computed(() => {
  try {
    const tagsStr = props.discussion?.tags;
    return tagsStr ? JSON.parse(tagsStr) : [];
  } catch (e) {
    return [];
  }
});

const parsedImages = computed(() => {
  try {
    const imagesStr = props.discussion?.images;
    return imagesStr ? JSON.parse(imagesStr) : [];
  } catch (e) {
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
    class="group p-3 sm:p-5 glass-card glass-card-hover cursor-pointer relative transition-all"
    :class="discussion.isPinned ? 'ring-1 ring-accent' : ''"
    @click="handleCardClick"
  >
    <!-- Pinned Badge -->
    <div
      v-if="discussion.isPinned"
      class="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
      style="background-color: var(--accent); color: white"
    >
      <Pin class="w-2.5 h-2.5" /> 置顶
    </div>

    <div class="flex gap-3 sm:gap-4">
      <UserAvatar :user="discussion.user" size="sm" class="shrink-0 sm:size-md" />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span
            class="text-xs sm:text-sm font-bold"
            style="color: var(--text-primary)"
          >
            {{ discussion.user?.name || '匿名用户' }}
          </span>
          <span class="text-[10px]" style="color: var(--text-muted)">
            {{ formattedTime }}
          </span>
        </div>

        <h3
          class="text-sm sm:text-base font-bold mb-1 group-hover:text-accent transition-colors pr-12 sm:pr-16"
        >
          {{ discussion.title }}
        </h3>
        <p
          class="text-[11px] sm:text-sm line-clamp-2 mb-2 sm:mb-3"
          style="color: var(--text-secondary)"
        >
          {{ discussion.content }}
        </p>

        <!-- Tags -->
        <div v-if="parsedTags.length > 0" class="flex flex-wrap gap-1 mb-2 sm:mb-3">
          <span
            v-for="tag in parsedTags"
            :key="tag"
            class="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium"
            style="background-color: var(--bg-app); color: var(--accent)"
          >
            #{{ tag }}
          </span>
        </div>

        <!-- Image Preview in List -->
        <div
          v-if="parsedImages.length > 0"
          class="flex gap-2 mb-2 sm:mb-3 overflow-hidden h-16 sm:h-20"
        >
          <div
            v-for="(img, idx) in parsedImages.slice(0, 3)"
            :key="idx"
            class="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 border border-slate-100 dark:border-white/5"
          >
            <img :src="img" class="w-full h-full object-cover" />
          </div>
          <div
            v-if="parsedImages.length > 3"
            class="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-bold text-slate-400"
          >
            +{{ parsedImages.length - 3 }}
          </div>
        </div>

        <!-- Actions Bar -->
        <div
          class="flex items-center gap-4 sm:gap-5 text-[10px] sm:text-[11px] font-bold"
          style="color: var(--text-muted)"
        >
          <button
            class="flex items-center gap-1 hover:text-red-500 transition-colors"
            :class="{ 'text-red-500': discussion.isLiked }"
            @click.stop="handleLikeClick"
          >
            <Heart
              class="w-3 h-3 sm:w-3.5 sm:h-3.5"
              :class="{ 'fill-red-500': discussion.isLiked }"
            />
            <span>{{ discussion._count?.likes || 0 }}</span>
          </button>
          <div class="flex items-center gap-1">
            <MessageSquare class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{{ discussion._count?.comments || 0 }}</span>
          </div>
          <div class="flex items-center gap-1">
            <Eye class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{{ discussion.viewCount || 0 }}</span>
          </div>

          <!-- Admin/Owner Actions -->
          <div
            v-if="isOwner || isAdmin"
            class="flex items-center gap-1.5 sm:gap-2 ml-auto"
          >
            <button
              v-if="isAdmin"
              class="hover:text-accent transition-colors p-1"
              @click.stop="handlePinClick"
            >
              <Pin class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
            <button
              class="hover:text-red-500 transition-colors p-1"
              @click.stop="handleDeleteClick"
            >
              <Trash2 class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
