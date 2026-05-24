<script setup lang="ts">
import { computed } from 'vue';
import {
  Heart,
  Eye,
  Play,
  Box,
  MessageCircle,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';

const props = defineProps<{
  item: any;
}>();

const emit = defineEmits<{
  (e: 'click', item: any): void;
  (e: 'like', item: any): void;
  (e: 'user-click', userId: string): void;
}>();

const parsedTags = computed(() => {
  if (!props.item?.tags) return [];
  return props.item.tags
    .split(',')
    .map((t: string) => t.trim())
    .filter(Boolean);
});

const typeBgClass = computed(() => {
  switch (props.item?.type) {
    case 'MODEL':
      return 'bg-blue-600/80';
    case 'VIDEO':
      return 'bg-red-600/80';
    case 'IMAGE':
      return 'bg-emerald-600/80';
    case 'TEXT':
      return 'bg-amber-500/80';
    default:
      return 'bg-slate-500/80';
  }
});

const typeLabel = computed(() => {
  switch (props.item?.type) {
    case 'MODEL':
      return '3D模型';
    case 'VIDEO':
      return '视频';
    case 'IMAGE':
      return '图片';
    case 'TEXT':
      return '文本';
    case 'OTHER':
      return '其他';
    default:
      return '作品';
  }
});

function handleCardClick() {
  emit('click', props.item);
}

function handleLikeClick() {
  emit('like', props.item);
}

function handleUserClick() {
  if (props.item?.user?.id) {
    emit('user-click', props.item.user.id);
  }
}
</script>

<template>
  <div
    class="group glass-card glass-card-hover overflow-hidden flex flex-col cursor-pointer"
    @click="handleCardClick"
  >
    <!-- Cover -->
    <div
      v-if="item.type === 'TEXT' && !item.thumbnailUrl"
      class="aspect-video relative overflow-hidden flex items-center justify-center p-6"
      style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    >
      <p class="text-white text-sm font-bold text-center line-clamp-3">
        {{ item.title }}
      </p>
      <div class="absolute top-2 left-2">
        <span
          class="backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
          :class="typeBgClass"
        >
          {{ typeLabel }}
        </span>
      </div>
      <div
        class="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white"
      >
        <Eye class="w-3 h-3" /> {{ item.views || 0 }}
      </div>
    </div>
    <div
      v-else
      class="aspect-video relative overflow-hidden"
      style="background-color: var(--bg-app)"
    >
      <img alt="" :src="item.thumbnailUrl" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      <div
        v-if="item.isVideo"
        class="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1"
      >
        <Play class="w-2.5 h-2.5 fill-white" /> 视频
      </div>
      <div class="absolute top-2 left-2">
        <span
          class="backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
          :class="typeBgClass"
        >
          {{ typeLabel }}
        </span>
      </div>
      <div
        v-if="item.asset"
        class="absolute bottom-2 left-2 bg-blue-500/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1"
      >
        <Box class="w-2.5 h-2.5" /> 关联3D模型
      </div>
      <div
        class="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white"
      >
        <Eye class="w-3 h-3" /> {{ item.views || 0 }}
      </div>
      <div
        class="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"
      ></div>
    </div>

    <!-- Content -->
    <div class="p-3.5 flex-1 flex flex-col">
      <h3
        class="text-xs sm:text-sm font-bold mb-1.5 line-clamp-1 group-hover:text-indigo-600 transition-colors"
        style="color: var(--text-primary)"
      >
        {{ item.title }}
      </h3>

      <div v-if="parsedTags.length" class="flex items-center gap-1 mb-2 flex-wrap">
        <span
          v-for="tag in parsedTags.slice(0, 3)"
          :key="tag"
          class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
        >
          {{ tag }}
        </span>
      </div>

      <div class="flex items-center justify-between mt-auto">
        <div
          class="flex items-center gap-1.5 cursor-pointer group/author"
          @click.stop="handleUserClick"
        >
          <UserAvatar
            :user="item.user"
            size="sm"
            class="group-hover/author:ring-2 group-hover/author:ring-indigo-500 transition-all"
          />
          <span
            class="text-[10px] font-bold group-hover/author:text-indigo-600 transition-colors truncate max-w-[80px]"
            style="color: var(--text-secondary)"
          >
            {{ item.user?.name || item.user?.email || '匿名用户' }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" class="flex items-center gap-1 text-[9px] font-bold transition-all hover:scale-105 active:scale-95" :class="item.isLiked ? 'text-rose-500' : 'text-slate-400'" @click.stop="handleLikeClick">
            <Heart class="w-3 h-3" :class="item.isLiked ? 'fill-rose-500' : ''" />
            {{ item.likesCount }}
          </button>
          <div class="flex items-center gap-1 text-[9px] font-bold text-slate-400">
            <MessageCircle class="w-3 h-3" /> {{ item.commentsCount }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
