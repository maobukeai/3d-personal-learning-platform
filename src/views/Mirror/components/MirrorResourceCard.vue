<script setup lang="ts">
import { computed } from 'vue';
import {
  Clock,
  Eye,
  ExternalLink,
  Sparkles,
  Video,
  Box,
  Palette,
  Layers,
  EyeIcon,
} from 'lucide-vue-next';
import { formatDate } from '@/utils/format';
import { parseTags } from '@/utils/tags';
import { getAssetUrl } from '@/utils/api';
import type { MirrorResource } from '@/stores/mirror';
import type { ViewModeType } from './MirrorFilterBar.vue';

const props = defineProps<{
  resource: MirrorResource;
  viewMode: ViewModeType;
}>();

const emit = defineEmits<{
  (e: 'click', resource: MirrorResource): void;
  (e: 'preview', resource: MirrorResource): void;
  (e: 'tag-click', tag: string): void;
}>();

const tagsList = computed(() => parseTags(props.resource.tags));

// Detect Resource Type Badge
const typeBadge = computed(() => {
  const text =
    `${props.resource.title} ${props.resource.category?.name || ''} ${props.resource.tags || ''}`.toLowerCase();
  if (/(视频|课程|教程|期|讲|全流程|合集)/.test(text)) {
    return { label: '视频课程', icon: Video, color: 'bg-indigo-500/90 text-white' };
  }
  if (/(模型|3d|资产|场景|角色|fbx|obj|blend)/.test(text)) {
    return { label: '3D资产', icon: Box, color: 'bg-emerald-600/90 text-white' };
  }
  if (/(笔刷|画笔|预设|立绘|插画|图包)/.test(text)) {
    return { label: '美术预设', icon: Palette, color: 'bg-pink-600/90 text-white' };
  }
  if (/(贴图|材质|纹理|pbr)/.test(text)) {
    return { label: '材质纹理', icon: Layers, color: 'bg-amber-600/90 text-white' };
  }
  return { label: '资源包', icon: Sparkles, color: 'bg-blue-600/90 text-white' };
});

// Detect Software Badge
const softwareBadge = computed(() => {
  const text = `${props.resource.title} ${props.resource.tags || ''}`.toLowerCase();
  if (/blender/.test(text))
    return {
      name: 'Blender',
      cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
    };
  if (/(photoshop|\bps\b|sai|优动漫|csp)/.test(text))
    return {
      name: 'PS/插画',
      cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    };
  if (/procreate/.test(text))
    return {
      name: 'Procreate',
      cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20',
    };
  if (/(after effects|\bae\b)/.test(text))
    return {
      name: 'AE特效',
      cls: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    };
  if (/(c4d|cinema 4d)/.test(text))
    return {
      name: 'C4D',
      cls: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    };
  if (/(aigc|midjourney|sd|ai)/.test(text))
    return {
      name: 'AI工具',
      cls: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20',
    };
  return null;
});

// Detect Course Features
const courseFeature = computed(() => {
  const title = props.resource.title;
  if (/带课件|带素材|含素材|带课件笔刷/.test(title)) return '含课件素材';
  if (/高清画质/.test(title)) return '超清原画';
  if (/共\d+节|共\d+讲|全\d+集/.test(title)) {
    const match = title.match(/共\d+节|共\d+讲|全\d+集/);
    return match ? match[0] : null;
  }
  return null;
});
</script>

<template>
  <!-- List View Mode -->
  <div
    v-if="viewMode === 'list'"
    class="group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer overflow-hidden"
    @click="emit('click', resource)"
  >
    <!-- Thumbnail for List -->
    <div
      class="relative w-full sm:w-44 sm:h-28 aspect-video sm:aspect-auto rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0"
    >
      <img
        v-if="resource.thumbnailUrl"
        :src="getAssetUrl(resource.thumbnailUrl)"
        :alt="resource.title"
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"
      >
        <ExternalLink class="w-8 h-8" />
      </div>

      <!-- Type Badge -->
      <div
        class="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md shadow-xs"
        :class="typeBadge.color"
      >
        <component :is="typeBadge.icon" class="w-3 h-3" />
        <span>{{ typeBadge.label }}</span>
      </div>

      <!-- Feature Pill -->
      <div
        v-if="courseFeature"
        class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-xs text-[10px] font-medium text-amber-300"
      >
        {{ courseFeature }}
      </div>
    </div>

    <!-- Content for List -->
    <div class="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
      <div>
        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
          <span
            v-if="resource.category"
            class="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20"
          >
            {{ resource.category.name }}
          </span>
          <span
            v-if="softwareBadge"
            class="px-2 py-0.5 text-xs font-bold rounded-md border"
            :class="softwareBadge.cls"
          >
            {{ softwareBadge.name }}
          </span>
        </div>

        <h3
          class="text-sm md:text-base font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
        >
          {{ resource.title }}
        </h3>

        <p
          v-if="resource.description"
          class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1"
        >
          {{ resource.description }}
        </p>
      </div>

      <div class="flex items-center justify-between mt-3 text-xs text-slate-400">
        <div class="flex items-center gap-4">
          <span v-if="resource.publishedAt" class="flex items-center gap-1">
            <Clock class="w-3.5 h-3.5" />
            {{ formatDate(resource.publishedAt) }}
          </span>
          <span class="flex items-center gap-1">
            <Eye class="w-3.5 h-3.5" />
            {{ resource.viewCount }} 次浏览
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-2.5 py-1 text-xs rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors font-medium flex items-center gap-1"
            @click.stop="emit('preview', resource)"
          >
            <EyeIcon class="w-3.5 h-3.5" />
            预览
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Grid View Mode (Comfortable & Compact) -->
  <div
    v-else
    class="group relative flex flex-col bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
    @click="emit('click', resource)"
  >
    <!-- Card Media Area -->
    <div
      class="relative w-full aspect-video rounded-t-2xl overflow-hidden bg-slate-100 dark:bg-slate-700/80"
    >
      <img
        v-if="resource.thumbnailUrl"
        :src="getAssetUrl(resource.thumbnailUrl)"
        :alt="resource.title"
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
        loading="lazy"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"
      >
        <ExternalLink class="w-8 h-8" />
      </div>

      <!-- Top Left: Resource Type Badge -->
      <div
        class="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md shadow-xs"
        :class="typeBadge.color"
      >
        <component :is="typeBadge.icon" class="w-3 h-3" />
        <span>{{ typeBadge.label }}</span>
      </div>

      <!-- Top Right: Software Badge -->
      <div
        v-if="softwareBadge"
        class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-black border backdrop-blur-md bg-white/90 dark:bg-slate-900/90 shadow-xs"
        :class="softwareBadge.cls"
      >
        {{ softwareBadge.name }}
      </div>

      <!-- Bottom Right: Feature Pill -->
      <div
        v-if="courseFeature"
        class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-bold text-amber-300 shadow-xs"
      >
        {{ courseFeature }}
      </div>

      <!-- Hover Overlay Quick Look Button -->
      <div
        class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 backdrop-blur-[1.5px]"
      >
        <button
          type="button"
          class="px-3.5 py-1.5 rounded-xl bg-white/95 text-slate-900 hover:bg-blue-600 hover:text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 duration-200"
          @click.stop="emit('preview', resource)"
        >
          <EyeIcon class="w-3.5 h-3.5" />
          <span>快速大图</span>
        </button>
      </div>
    </div>

    <!-- Card Content Area -->
    <div class="p-3 md:p-4 flex-1 flex flex-col justify-between">
      <div>
        <!-- Category & Small tags -->
        <div class="flex items-center gap-1.5 mb-1.5">
          <span
            v-if="resource.category"
            class="px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
          >
            {{ resource.category.name }}
          </span>
        </div>

        <!-- Title -->
        <h3
          class="font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug"
          :class="viewMode === 'grid-compact' ? 'text-xs min-h-[2rem]' : 'text-sm min-h-[2.5rem]'"
          :title="resource.title"
        >
          {{ resource.title }}
        </h3>

        <!-- Tags Row -->
        <div v-if="tagsList.length > 0" class="flex flex-wrap gap-1 mt-2">
          <span
            v-for="t in tagsList.slice(0, 3)"
            :key="t"
            class="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            @click.stop="emit('tag-click', t)"
          >
            {{ t }}
          </span>
        </div>
      </div>

      <!-- Footer Metadata -->
      <div
        class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-3 mt-2 border-t border-slate-100 dark:border-slate-700/50"
      >
        <span v-if="resource.publishedAt" class="flex items-center gap-1 truncate">
          <Clock class="w-3 h-3" />
          {{ formatDate(resource.publishedAt) }}
        </span>
        <span class="flex items-center gap-1 shrink-0 ml-auto">
          <Eye class="w-3 h-3" />
          {{ resource.viewCount }}
        </span>
      </div>
    </div>
  </div>
</template>
