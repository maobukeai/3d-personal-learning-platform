<script setup lang="ts">
import { formatFileSize, formatRelativeTime, stripMarkdown } from '@/utils/format';
import { parseTags } from '@/utils/tags';
import { computed } from 'vue';
import {
  Trash2,
  SendHorizonal,
  Box,
  Heart,
  Eye,
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  XCircle,
  Edit3,
  Download,
  Loader2,
  Play,
  Image as ImageIcon,
  Sparkles,
  Laptop,
} from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import { useLabel } from '@/utils/i18n';

const label = useLabel();

interface CardItem {
  id?: string | number;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  subtitle?: string | null;
  preview?: string | null;
  previewUrl?: string | null;
  thumbnail?: string | null;
  thumbnailUrl?: string | null;
  size?: number | string | null;
  fileSize?: number | string | null;
  sizeMb?: number | string | null;
  tags?: string | string[] | null;
  categoryName?: string | null;
  category?:
    | string
    | Record<string, unknown>
    | { name?: string | null; label?: string | null }
    | null;
  format?: string | null;
  resolution?: string | null;
  version?: string | null;
  downloads?: number | null;
  likes?: number | null;
  likesCount?: number | null;
  views?: number | null;
  viewCount?: number | null;
  isProcedural?: boolean | string | null;
  compatibility?: string | null;
  status?: string | null;
  rejectReason?: string | null;
  hasAnimations?: boolean | null;
  kind?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
  author?: string | null;
}

interface Props {
  item: CardItem;
  kind: 'asset' | 'material' | 'plugin' | 'software' | 'work' | 'showcase' | 'feed';
  viewMode?: 'grid' | 'list';
  isSelected?: boolean;
  isFavorited?: boolean;
  downloading?: boolean;
  activeTab?: string;
}

const props = withDefaults(defineProps<Props>(), {
  viewMode: 'grid',
  isSelected: false,
  isFavorited: false,
  downloading: false,
  activeTab: 'explore',
});

const emit = defineEmits<{
  (e: 'click', item: CardItem): void;
  (e: 'like', item: CardItem, event?: Event): void;
  (e: 'download', item: CardItem, event?: Event): void;
  (e: 'edit', item: CardItem, event?: Event): void;
  (e: 'select', item: CardItem, event?: Event): void;
  (e: 'share', item: CardItem, event?: Event): void;
  (e: 'user-click', userId: string): void;
}>();

// Kind Meta helper
const kindMeta = {
  asset: { label: label('资源', 'Asset'), tone: 'blue', icon: Box },
  material: { label: label('材质', 'Material'), tone: 'teal', icon: Sparkles },
  plugin: { label: label('插件', 'Plugin'), tone: 'purple', icon: Play },
  software: { label: label('软件', 'Software'), tone: 'sky', icon: Laptop },
  showcase: { label: label('展示', 'Showcase'), tone: 'orange', icon: ImageIcon },
};

// Status Meta helper
const getStatusMeta = (status?: string) => {
  const statusMap = {
    APPROVED: { label: label('已发布', 'Approved'), tone: 'success', icon: CheckCircle2 },
    PENDING: { label: label('待审核', 'Pending'), tone: 'warning', icon: Clock3 },
    REJECTED: { label: label('已驳回', 'Rejected'), tone: 'danger', icon: XCircle },
  };
  return (
    statusMap[(status || 'APPROVED') as 'APPROVED' | 'PENDING' | 'REJECTED'] || statusMap.APPROVED
  );
};

// Extracted tags
const tagsList = computed(() => parseTags(props.item?.tags).slice(0, 3));

// Normalized properties depending on kind
const title = computed(() => props.item?.title || props.item?.name || '---');
const description = computed(() =>
  stripMarkdown(props.item?.description || props.item?.subtitle || ''),
);
const previewUrl = computed(() => {
  const url =
    props.item?.preview ||
    props.item?.previewUrl ||
    props.item?.thumbnail ||
    props.item?.thumbnailUrl;
  return url ? getAssetUrl(url) : null;
});

const sizeLabel = computed(() => {
  const size = props.item?.size || props.item?.fileSize || props.item?.sizeMb;
  return formatFileSize(Number(size));
});

const dateLabel = computed(() => {
  const date = props.item?.updatedAt || props.item?.createdAt;
  return formatRelativeTime(date || undefined);
});

// Category name
const categoryLabel = computed(() => {
  const cat = props.item?.categoryName || props.item?.category;
  if (cat && typeof cat === 'object') {
    return cat.name || cat.label || '---';
  }
  return cat || kindMeta[props.kind as 'asset']?.label || '---';
});

// Format/version label
const formatOrVersion = computed(() => {
  if (props.kind === 'plugin' || props.kind === 'software')
    return `v${props.item?.version || '1.0.0'}`;
  return props.item?.format || props.item?.resolution || '';
});

// Downloads count
const downloadsCount = computed(() => {
  return props.item?.downloads || 0;
});

// Likes count
const likesCount = computed(() => {
  return props.item?.likes || props.item?.likesCount || 0;
});

// Views count
const viewsCount = computed(() => {
  return props.item?.views || props.item?.viewCount || 0;
});

// Check if is procedural (only for material)
const isProcedural = computed(() => {
  return props.item?.isProcedural === true || props.item?.isProcedural === 'true';
});

// Author display name
const authorName = computed(() => {
  return props.item?.user?.name || props.item?.user?.email || props.item?.author || '';
});

// Compatibility display
const compatibilityInfo = computed(() => {
  return props.item?.compatibility || '';
});
</script>

<template>
  <article
    :class="[
      viewMode === 'list'
        ? 'flex items-center gap-3 p-2 border border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/60 hover:shadow-md'
        : 'flex flex-col border border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/60 hover:shadow-lg hover:-translate-y-0.5',
      'rounded-xl backdrop-blur-md overflow-hidden transition-all duration-300 cursor-pointer relative group',
    ]"
    @click="emit('click', item)"
  >
    <!-- Multi-select dot (Material, Asset, Plugin specific for mine/drafts/favorites) -->
    <button
      v-if="
        (kind === 'material' || kind === 'asset' || kind === 'plugin' || kind === 'software') &&
        (activeTab === 'mine' || activeTab === 'drafts' || activeTab === 'favorites')
      "
      type="button"
      :class="[
        viewMode === 'list'
          ? 'w-5 h-5 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 text-slate-400 transition-all duration-300 flex-shrink-0 ml-1'
          : 'absolute left-2 top-2 z-30 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 border border-white/30 text-white backdrop-blur-sm transition-all duration-300',
        isSelected
          ? 'bg-accent text-white border-accent scale-110 shadow-md !text-white'
          : viewMode === 'list'
            ? ''
            : 'opacity-0 group-hover:opacity-100',
      ]"
      @click.stop="emit('select', item, $event)"
    >
      <CheckCircle2 class="w-3 h-3" />
    </button>

    <!-- Preview/Cover Area -->
    <div
      :class="[
        viewMode === 'list'
          ? 'w-24 h-15 rounded-lg overflow-hidden flex-shrink-0'
          : 'w-full aspect-[1.6] overflow-hidden',
        'relative bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-b border-slate-100 dark:border-slate-800/50',
      ]"
    >
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="title"
        loading="lazy"
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div v-else class="flex flex-col items-center justify-center gap-1.5 text-slate-400">
        <component :is="kindMeta[kind as 'asset']?.icon || Box" class="w-7 h-7 stroke-[1.5]" />
      </div>

      <!-- Format badge Overlay (Grid Mode) -->
      <div
        v-if="viewMode === 'grid' && formatOrVersion"
        class="absolute left-2 bottom-2 z-20 rounded-md bg-black/50 border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md"
      >
        {{ formatOrVersion }}
      </div>

      <!-- Has Animation Badge -->
      <div
        v-if="viewMode === 'grid' && item?.hasAnimations"
        class="absolute left-16 bottom-2 z-20 rounded-md bg-accent/80 border border-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md"
      >
        {{ label('动画', 'Animated') }}
      </div>

      <!-- Procedural Badge (Material spec) -->
      <div
        v-if="viewMode === 'grid' && isProcedural"
        class="absolute left-16 bottom-2 z-20 rounded-md bg-emerald-600/80 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md"
      >
        {{ label('程序化', 'Procedural') }}
      </div>

      <!-- Favorite overlay button (Assets, Materials, Plugins) -->
      <button
        v-if="
          viewMode === 'grid' &&
          (kind === 'asset' || kind === 'material' || kind === 'plugin' || kind === 'software')
        "
        type="button"
        :class="[
          'absolute right-2 top-2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 border border-white/10 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 shadow-md',
          isFavorited ? '!text-rose-500' : 'opacity-0 group-hover:opacity-100',
        ]"
        @click.stop="emit('like', item, $event)"
      >
        <Heart class="w-3.5 h-3.5" :class="{ 'fill-current': isFavorited }" />
      </button>

      <!-- Status badge (My Works spec or status filter) -->
      <div
        v-if="viewMode === 'grid' && (kind === 'work' || activeTab === 'mine') && item?.status"
        :class="[
          'absolute right-2 top-2 z-20 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm border',
          getStatusMeta(item.status).tone === 'success'
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            : getStatusMeta(item.status).tone === 'warning'
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        ]"
      >
        {{ getStatusMeta(item.status).label }}
      </div>
    </div>

    <!-- Content Area (Grid) -->
    <div v-if="viewMode === 'grid'" class="flex-1 flex flex-col p-2.5 sm:p-3 min-w-0">
      <!-- Title row -->
      <div class="flex items-start justify-between gap-1.5 mb-1">
        <h2
          class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate flex-1 leading-tight group-hover:text-primary transition-colors duration-300"
        >
          {{ title }}
        </h2>
        <!-- Version or secondary format text if work -->
        <span
          v-if="kind === 'plugin' || kind === 'software'"
          class="text-[9px] font-bold text-indigo-500 bg-indigo-500/15 border border-indigo-500/20 px-1 py-0.2 rounded-md"
        >
          v{{ item?.version }}
        </span>
      </div>

      <!-- Description -->
      <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-2">
        {{ description || label('暂无说明内容。', 'No description yet.') }}
      </p>

      <!-- Compatibility Info for Plugins -->
      <div
        v-if="(kind === 'plugin' || kind === 'software') && compatibilityInfo"
        class="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mb-2"
      >
        <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
        <span class="truncate">{{ compatibilityInfo }}</span>
      </div>

      <!-- Reject reason -->
      <div
        v-if="item?.status === 'REJECTED' && item?.rejectReason"
        class="text-[10px] text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 py-1 rounded-lg mb-2 flex items-start gap-1"
      >
        <XCircle class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p class="line-clamp-2 leading-snug">{{ item.rejectReason }}</p>
      </div>

      <!-- Tags row -->
      <div v-if="tagsList.length" class="flex flex-wrap gap-1.5 mb-2.5">
        <span
          v-for="tag in tagsList"
          :key="tag"
          class="text-[9px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md"
        >
          #{{ tag }}
        </span>
      </div>

      <!-- Spacer -->
      <div class="flex-grow"></div>

      <!-- Metadata & Metrics Row -->
      <div
        class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2 text-[10px] text-slate-500 dark:text-slate-400"
      >
        <!-- Category & size -->
        <div class="flex items-center gap-1.5 truncate flex-shrink min-w-0">
          <span class="truncate font-medium text-slate-700 dark:text-slate-300">{{
            categoryLabel
          }}</span>
          <span v-if="sizeLabel" class="text-slate-300 dark:text-slate-700 font-bold text-[8px]"
            >•</span
          >
          <span v-if="sizeLabel">{{ sizeLabel }}</span>
        </div>

        <!-- Metric badges / date -->
        <div class="flex items-center gap-2 flex-shrink-0 ml-1.5">
          <span class="hidden sm:inline">{{ dateLabel }}</span>
        </div>
      </div>

      <!-- Footer Action / Metrics Overlay -->
      <div
        class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2 mt-2"
      >
        <div class="flex items-center gap-2.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span
            v-if="downloadsCount > 0 || kind === 'plugin' || kind === 'software'"
            class="flex items-center gap-1"
          >
            <ArrowDownToLine class="w-3.5 h-3.5 stroke-[1.8]" />
            {{ downloadsCount }}
          </span>
          <span v-if="viewsCount > 0" class="flex items-center gap-1">
            <Eye class="w-3.5 h-3.5 stroke-[1.8]" />
            {{ viewsCount }}
          </span>
          <span v-if="likesCount > 0" class="flex items-center gap-1">
            <Heart class="w-3.5 h-3.5 stroke-[1.8]" />
            {{ likesCount }}
          </span>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1">
          <!-- Work specific actions -->
          <template v-if="kind === 'work'">
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="编辑"
              @click.stop="emit('edit', item, $event)"
            >
              <Edit3 class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="下载"
              @click.stop="emit('download', item, $event)"
            >
              <ArrowDownToLine class="w-3.5 h-3.5" />
            </button>
            <button
              v-if="item.kind === 'asset' && item.status === 'APPROVED'"
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="发布至展示"
              @click.stop="emit('share', item, $event)"
            >
              <SendHorizonal class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-red-200 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-500 transition-colors animate-fade-in"
              title="删除"
              @click.stop="emit('select', item, $event)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </template>

          <!-- Normal download button -->
          <button
            v-else-if="
              kind === 'asset' || kind === 'material' || kind === 'plugin' || kind === 'software'
            "
            type="button"
            class="px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 bg-accent hover:bg-accent-hover text-white transition-all shadow-sm"
            :disabled="downloading"
            @click.stop="emit('download', item, $event)"
          >
            <Loader2 v-if="downloading" class="w-3 h-3 spinning" />
            <Download v-else class="w-3 h-3" />
            {{
              kind === 'plugin' || kind === 'software'
                ? label('下载', 'Get')
                : label('下载', 'Download')
            }}
          </button>
        </div>
      </div>
    </div>

    <!-- Content Area (List Mode) -->
    <div v-else class="flex-1 flex items-center justify-between min-w-0 pr-2">
      <div class="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
        <div class="flex items-center gap-2">
          <h2
            class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px] leading-tight group-hover:text-primary transition-colors"
          >
            {{ title }}
          </h2>
          <span
            class="text-[9px] px-1 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 font-medium border border-slate-200/20"
          >
            {{ formatOrVersion || categoryLabel }}
          </span>
          <div
            v-if="(kind === 'work' || activeTab === 'mine') && item?.status"
            :class="[
              'rounded-md px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm border',
              getStatusMeta(item.status).tone === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : getStatusMeta(item.status).tone === 'warning'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30',
            ]"
          >
            {{ getStatusMeta(item.status).label }}
          </div>
        </div>

        <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[400px]">
          {{ description || label('暂无说明内容。', 'No description yet.') }}
        </p>

        <div class="flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400">
          <span>{{ categoryLabel }}</span>
          <span v-if="sizeLabel">•</span>
          <span v-if="sizeLabel">{{ sizeLabel }}</span>
          <span>•</span>
          <span>{{ dateLabel }}</span>
          <span v-if="authorName">•</span>
          <span v-if="authorName" class="font-medium text-slate-700 dark:text-slate-300">{{
            authorName
          }}</span>
        </div>
      </div>

      <!-- Action Area / Metrics (List Mode) -->
      <div class="flex items-center gap-4 flex-shrink-0">
        <div
          class="hidden md:flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400"
        >
          <span
            v-if="downloadsCount > 0 || kind === 'plugin' || kind === 'software'"
            class="flex items-center gap-1"
          >
            <ArrowDownToLine class="w-3.5 h-3.5 stroke-[1.8]" />
            {{ downloadsCount }}
          </span>
          <span v-if="likesCount > 0" class="flex items-center gap-1">
            <Heart class="w-3.5 h-3.5 stroke-[1.8]" />
            {{ likesCount }}
          </span>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1">
          <!-- Work specific actions -->
          <template v-if="kind === 'work'">
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="编辑"
              @click.stop="emit('edit', item, $event)"
            >
              <Edit3 class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="下载"
              @click.stop="emit('download', item, $event)"
            >
              <ArrowDownToLine class="w-3.5 h-3.5" />
            </button>
            <button
              v-if="item.kind === 'asset' && item.status === 'APPROVED'"
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="发布至展示"
              @click.stop="emit('share', item, $event)"
            >
              <SendHorizonal class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-red-200 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-500 transition-colors"
              title="删除"
              @click.stop="emit('select', item, $event)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </template>

          <!-- Normal download button -->
          <button
            v-else-if="
              kind === 'asset' || kind === 'material' || kind === 'plugin' || kind === 'software'
            "
            type="button"
            class="px-2 py-0.5 rounded-lg text-[9px] font-semibold flex items-center gap-0.5 bg-accent hover:bg-accent-hover text-white transition-all shadow-sm"
            :disabled="downloading"
            @click.stop="emit('download', item, $event)"
          >
            <Loader2 v-if="downloading" class="w-3 h-3 spinning" />
            <Download v-else class="w-3 h-3" />
            {{
              kind === 'plugin' || kind === 'software'
                ? label('下载', 'Get')
                : label('下载', 'Download')
            }}
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* .spinning + @keyframes spin provided globally by src/styles/layout.css */
</style>
