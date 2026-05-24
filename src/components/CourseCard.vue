<script setup lang="ts">
import { computed } from 'vue';
import {
  Star,
  Users,
  BookOpen,
  ChevronRight,
  PlayCircle,
  Bookmark,
} from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    course: any;
    layout?: 'row-simple' | 'row-detailed' | 'card' | 'card-simple';
    enrolled?: boolean;
    bookmarked?: boolean;
    progress?: number;
  }>(),
  {
    layout: 'card',
    enrolled: false,
    bookmarked: false,
    progress: 0,
  }
);

const emit = defineEmits<{
  (e: 'click', id: string): void;
  (e: 'bookmark', id: string, event: Event): void;
}>();

const difficultyMap: Record<string, { label: string; color: string; bg: string }> = {
  BEGINNER: { label: '入门', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  INTERMEDIATE: { label: '进阶', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ADVANCED: { label: '高级', color: 'text-rose-500', bg: 'bg-rose-500/10' },
};

const diffInfo = computed(() => {
  return (
    difficultyMap[props.course?.difficulty] || {
      label: '入门',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    }
  );
});

const defaultThumbnail =
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60';

const firstTag = computed(() => {
  if (!props.course?.tags) return '';
  return props.course.tags.split(',')[0]?.trim() || '';
});

function handleCardClick() {
  emit('click', props.course.id);
}

function handleBookmarkClick(event: Event) {
  emit('bookmark', props.course.id, event);
}
</script>

<template>
  <!-- layout == 'row-simple' (e.g. Continue Learning) -->
  <div
    v-if="layout === 'row-simple'"
    class="group flex gap-3 p-2.5 sm:p-3 glass-card glass-card-hover overflow-hidden cursor-pointer"
    @click="handleCardClick"
  >
    <div
      class="w-20 sm:w-24 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 shrink-0"
    >
      <img
        :src="course.thumbnail || defaultThumbnail"
        referrerpolicy="no-referrer"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
    </div>
    <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
      <div>
        <h3
          class="text-sm font-bold line-clamp-1 group-hover:text-accent transition-colors"
          style="color: var(--text-primary)"
        >
          {{ course.title }}
        </h3>
        <p class="text-[10px] mt-1" style="color: var(--text-muted)">
          {{ course._count?.lessons || 0 }} 课时 ·
          {{ course.category?.name || '' }}
        </p>
      </div>
      <div class="mt-2">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[10px] font-bold text-emerald-500"
            >{{ progress }}% 完成</span
          >
        </div>
        <div class="h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full bg-emerald-500 rounded-full transition-all"
            :style="{ width: progress + '%' }"
          ></div>
        </div>
      </div>
    </div>
  </div>

  <!-- layout == 'row-detailed' (e.g. Featured Recommended) -->
  <div
    v-else-if="layout === 'row-detailed'"
    class="group flex flex-col sm:flex-row gap-3 sm:gap-3.5 p-3 sm:p-3.5 glass-card glass-card-hover overflow-hidden cursor-pointer"
    @click="handleCardClick"
  >
    <div
      class="w-full sm:w-36 lg:w-44 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 shrink-0"
    >
      <img
        :src="course.thumbnail || defaultThumbnail"
        referrerpolicy="no-referrer"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
    </div>
    <div class="flex-1 min-w-0 flex flex-col justify-between py-1">
      <div>
        <div class="flex items-center gap-2 mb-1.5">
          <span
            v-if="course.category"
            class="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold"
            >{{ course.category.name }}</span
          >
          <span
            :class="[diffInfo.bg, diffInfo.color]"
            class="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
          >
            {{ diffInfo.label }}
          </span>
        </div>
        <h3
          class="text-sm sm:text-base font-bold mb-1.5 line-clamp-2 leading-snug group-hover:text-accent transition-colors"
          style="color: var(--text-primary)"
        >
          {{ course.title }}
        </h3>
        <p class="text-xs line-clamp-2" style="color: var(--text-muted)">
          {{ course.description }}
        </p>
      </div>
      <div
        class="flex items-center gap-4 text-[10px] font-bold mt-2"
        style="color: var(--text-muted)"
      >
        <span class="flex items-center gap-1"
          ><Star class="w-3 h-3 text-amber-400 fill-amber-400" />
          {{ course.avgRating || '-' }}</span
        >
        <span class="flex items-center gap-1"
          ><Users class="w-3 h-3" /> {{ course._count?.enrollments || 0 }}</span
        >
        <span class="flex items-center gap-1"
          ><BookOpen class="w-3 h-3" /> {{ course._count?.lessons || 0 }} 课时</span
        >
      </div>
    </div>
  </div>

  <!-- layout == 'card-simple' (e.g. Recommended Courses) -->
  <div
    v-else-if="layout === 'card-simple'"
    class="group glass-card glass-card-hover overflow-hidden cursor-pointer"
    @click="handleCardClick"
  >
    <div class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5">
      <img
        :src="course.thumbnail || defaultThumbnail"
        referrerpolicy="no-referrer"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div
        class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <PlayCircle class="w-12 h-12 text-white drop-shadow-lg" />
      </div>
      <div class="absolute top-3 left-3">
        <span
          :class="[diffInfo.bg, diffInfo.color]"
          class="px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm"
        >
          {{ diffInfo.label }}
        </span>
      </div>
    </div>
    <div class="p-1.5 sm:p-2.5">
      <h3
        class="text-[10px] sm:text-sm font-bold mb-1 line-clamp-1 group-hover:text-accent transition-colors"
        style="color: var(--text-primary)"
      >
        {{ course.title }}
      </h3>
      <div
        class="flex items-center gap-1.5 sm:gap-3 text-[8px] sm:text-[10px] font-bold"
        style="color: var(--text-muted)"
      >
        <span class="flex items-center gap-0.5 sm:gap-1"
          ><Star class="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
          {{ course.avgRating || '-' }}</span
        >
        <span class="flex items-center gap-0.5 sm:gap-1"
          ><Users class="w-2.5 h-2.5" /> {{ course._count?.enrollments || 0 }}</span
        >
      </div>
    </div>
  </div>

  <!-- layout == 'card' (e.g. Standard Filtered Course Grid) -->
  <div
    v-else
    class="group glass-card glass-card-hover overflow-hidden cursor-pointer"
    @click="handleCardClick"
  >
    <!-- Course Cover -->
    <div class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5">
      <img
        :src="course.thumbnail || defaultThumbnail"
        referrerpolicy="no-referrer"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div
        class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <PlayCircle class="w-12 h-12 text-white drop-shadow-lg" />
      </div>
      <!-- Badges -->
      <div class="absolute top-3 left-3 flex items-center gap-1.5">
        <span
          :class="[diffInfo.bg, diffInfo.color]"
          class="px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm"
        >
          {{ diffInfo.label }}
        </span>
      </div>
      <slot name="right-badges">
        <div
          v-if="enrolled"
          class="absolute top-3 right-3 flex items-center gap-1.5"
        >
          <span
            class="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500 text-white"
          >
            已加入
          </span>
        </div>
        <!-- Bookmark button -->
        <button
          v-else
          class="absolute top-3 right-3 p-1.5 rounded-lg bg-black/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-black/50"
          @click.stop="handleBookmarkClick($event)"
        >
          <Bookmark
            class="w-3.5 h-3.5"
            :class="
              bookmarked ? 'text-amber-400 fill-amber-400' : 'text-white'
            "
          />
        </button>
      </slot>
      <!-- Progress bar for enrolled courses -->
      <div
        v-if="enrolled && progress > 0"
        class="absolute bottom-0 left-0 right-0 h-1 bg-black/20"
      >
        <div
          class="h-full bg-emerald-400 transition-all"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
    </div>

    <!-- Course Info -->
    <div class="p-1.5 sm:p-3.5">
      <div class="flex items-center gap-1 sm:gap-1.5 mb-1.5">
        <span
          v-if="course.category"
          class="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-bold"
          >{{ course.category.name }}</span
        >
        <span
          v-if="firstTag"
          class="hidden xs:inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-400 text-[9px] font-bold"
          >{{ firstTag }}</span
        >
      </div>
      <h3
        class="text-[10px] sm:text-sm font-bold mb-1.5 line-clamp-2 min-h-[24px] sm:min-h-[32px] leading-tight sm:leading-snug group-hover:text-accent transition-colors"
        style="color: var(--text-primary)"
      >
        {{ course.title }}
      </h3>

      <div class="flex items-center gap-1.5 mb-2">
        <div class="hidden xs:flex items-center gap-0.5">
          <Star
            v-for="i in 5"
            :key="i"
            class="w-3 h-3"
            :class="
              i <= Math.round(course.avgRating || 0)
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-200 dark:text-slate-700'
            "
          />
        </div>
        <span class="xs:hidden"><Star class="w-3 h-3 text-amber-400 fill-amber-400 inline-block align-middle mr-0.5" /></span>
        <span class="text-[10px] font-bold inline-block align-middle" style="color: var(--text-muted)">{{
          course.avgRating || '-'
        }}</span>
      </div>

      <div
        class="flex items-center justify-between pt-2 border-t transition-colors duration-300"
        style="border-color: var(--border-base)"
      >
        <div
          class="flex items-center gap-1.5 sm:gap-3 text-[8px] sm:text-[10px] font-bold"
          style="color: var(--text-muted)"
        >
          <span class="flex items-center gap-0.5 sm:gap-1"
            ><BookOpen class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" /> {{ course._count?.lessons || 0 }}<span class="hidden xs:inline"> 课时</span></span
          >
          <span class="flex items-center gap-0.5 sm:gap-1"
            ><Users class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" /> {{ course._count?.enrollments || 0 }}</span
          >
        </div>
        <ChevronRight
          class="hidden sm:block w-4 h-4 text-slate-300 group-hover:text-accent transition-colors"
        />
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
