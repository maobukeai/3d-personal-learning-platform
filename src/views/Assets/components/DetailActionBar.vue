<script setup lang="ts">
import {
  Download,
  ExternalLink,
  Heart,
  Edit3,
  Trash2,
  Share2,
  CheckCircle2,
  XCircle,
} from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import type { PluginItem } from './detailTypes';
interface Props {
  plugin: PluginItem;
  isExternal: boolean;
  isDownloading: boolean;
  isFavorited: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  isSavingReview: boolean;
  inline: boolean;
  isAuthenticated: boolean;
  favoriteCategories: string[];
  pluginFavCategory: string | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'download'): void;
  (e: 'edit', plugin: PluginItem): void;
  (e: 'delete', plugin: PluginItem): void;
  (e: 'share'): void;
  (e: 'review-approved', plugin: PluginItem): void;
  (e: 'review-rejected', plugin: PluginItem): void;
  (e: 'favorite-with-category', category: string): void;
  (e: 'create-and-favorite'): void;
}>();
const label = useLabel();
const showFavoriteCategorySelect = defineModel<boolean>('showFavoriteCategorySelect', {
  required: true,
});
const newFavoriteCategory = defineModel<string>('newFavoriteCategory', { required: true });
const formatSize = (size?: number | null) => {
  if (!size) return label('未知大小', 'Unknown size');
  if (size >= 1) return `${size.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size * 1024))} KB`;
};
</script>
<template>
  <!-- Author Profile Card -->
  <div
    v-if="props.plugin.user"
    class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 text-left shrink-0"
  >
    <div
      class="h-9 w-9 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center text-sm shrink-0"
    >
      <img
        v-if="props.plugin.user.avatarUrl"
        :src="getAssetUrl(props.plugin.user.avatarUrl)"
        class="h-full w-full object-cover"
      />
      <span v-else class="font-semibold uppercase text-xs text-[var(--text-secondary)]">{{
        props.plugin.user.name?.slice(0, 1) || 'A'
      }}</span>
    </div>
    <div class="text-left min-w-0">
      <div class="text-xs font-bold text-[var(--text-primary)] truncate">
        {{ props.plugin.user.name }}
      </div>
      <div class="text-[10px] text-[var(--text-muted)] mt-1 font-medium uppercase tracking-wider">
        {{ label('上传作者', 'Author') }}
      </div>
    </div>
  </div>
  <!-- Floating status badge / Quick download box -->
  <div class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 text-left">
    <div class="flex justify-between items-center">
      <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{{
        label('下载选项', 'Download Options')
      }}</span>
      <div>
        <span
          v-if="props.plugin.status === 'APPROVED'"
          class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
        >
          {{ label('已发布', 'Approved') }}
        </span>
        <span
          v-else-if="props.plugin.status === 'PENDING'"
          class="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold"
        >
          {{ label('审核中', 'Pending') }}
        </span>
        <span
          v-else
          class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-semibold"
        >
          {{ label('未通过', 'Rejected') }}
        </span>
      </div>
    </div>
    <!-- Primary Download Button -->
    <Button
      variant="primary"
      size="md"
      :loading="!props.isExternal && props.isDownloading"
      class="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] transition-all duration-300"
      @click="emit('download')"
    >
      <template v-if="props.isExternal">
        <ExternalLink class="h-4.5 w-4.5" />
        <span>{{ label('前往源站获取下载', 'Visit Source Site') }}</span>
      </template>
      <template v-else>
        <Download v-if="!props.isDownloading" class="h-4.5 w-4.5 animate-bounce-slow" />
        <span>{{ label('下载插件资源', 'Download Add-on') }}</span>
      </template>
    </Button>
    <!-- Quick Statistics -->
    <div class="grid grid-cols-2 gap-2 mt-1 pt-3 border-t border-white/5">
      <div class="flex flex-col gap-0.5">
        <span class="text-[10px] text-[var(--text-muted)]">{{
          label('下载次数', 'Downloads')
        }}</span>
        <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
          <Download class="h-3 w-3 text-teal-400" /> {{ props.plugin.downloads || 0 }}
        </span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[10px] text-[var(--text-muted)]">{{
          label('文件大小', 'File Size')
        }}</span>
        <span class="text-xs font-bold text-[var(--text-primary)]">
          {{ formatSize(props.plugin.fileSize) }}
        </span>
      </div>
    </div>
  </div>
  <!-- Control Action Buttons -->
  <div
    v-if="!props.inline"
    class="flex flex-col gap-2 p-3 bg-white/[0.01] border border-white/5 rounded-2xl text-left"
  >
    <span
      class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold px-1 mb-1"
      >{{ label('管理与操作', 'Actions') }}</span
    >
    <div class="grid grid-cols-2 gap-2">
      <Button
        v-if="props.canEdit"
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-400"
        @click="emit('edit', props.plugin)"
      >
        <Edit3 class="h-3.5 w-3.5 text-emerald-400" /> <span>{{ label('编辑', 'Edit') }}</span>
      </Button>
      <Button
        v-if="props.canEdit"
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5 hover:bg-rose-500/10 hover:text-rose-400"
        @click="emit('delete', props.plugin)"
      >
        <Trash2 class="h-3.5 w-3.5 text-rose-400" /> <span>{{ label('删除', 'Delete') }}</span>
      </Button>
      <div class="flex-1">
        <GlassPopover
          v-model:visible="showFavoriteCategorySelect"
          placement="top"
          :width="200"
          trigger="click"
          popper-class="!glass-panel !backdrop-blur-xl !rounded-2xl !p-3 !border-strong/10 shadow-[0_12px_30px_rgba(0,0,0,0.15)] text-left"
        >
          <template #reference>
            <Button
              variant="secondary"
              size="sm"
              class="w-full flex items-center justify-center gap-1.5"
              :class="{ 'text-rose-400 bg-rose-500/5': props.isFavorited }"
            >
              <Heart
                :class="[
                  'h-3.5 w-3.5',
                  props.isFavorited ? 'text-rose-500 fill-rose-500' : 'text-slate-400',
                ]"
              />
              <span>{{
                props.isFavorited ? label('已收藏', 'Saved') : label('收藏', 'Save')
              }}</span>
            </Button>
          </template>
          <!-- Category Dropdown Popover -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] text-slate-400 px-1 font-semibold uppercase tracking-wider">{{
              label('选择收藏分类', 'Select Category')
            }}</span>
            <div class="max-h-[120px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
              <button
                v-for="cat in props.favoriteCategories"
                :key="cat"
                class="w-full px-2 py-1.5 text-left text-xs rounded hover:bg-white/5 transition-colors border-0 bg-transparent text-[var(--text-secondary)] hover:text-white flex items-center justify-between cursor-pointer"
                @click="emit('favorite-with-category', cat)"
              >
                <span>{{ cat }}</span>
                <span
                  v-if="props.isFavorited && props.pluginFavCategory === cat"
                  class="w-1.5 h-1.5 rounded-full bg-rose-500"
                ></span>
              </button>
            </div>
            <div class="border-t border-white/5 my-1"></div>
            <!-- Add New Category -->
            <div class="flex items-center gap-1.5 px-1">
              <input
                v-model="newFavoriteCategory"
                type="text"
                :placeholder="label('新分类...', 'New Folder...')"
                class="flex-1 min-w-0 px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded focus:border-indigo-500 outline-none text-white placeholder-slate-500"
                @keyup.enter="emit('create-and-favorite')"
              />
              <button
                class="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors border-0 cursor-pointer flex items-center justify-center shrink-0"
                @click="emit('create-and-favorite')"
              >
                <CheckCircle2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </GlassPopover>
      </div>
      <Button
        v-if="props.isAuthenticated"
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5"
        @click="emit('share')"
      >
        <Share2 class="h-3.5 w-3.5 text-indigo-400" /> <span>{{ label('分享', 'Share') }}</span>
      </Button>
    </div>
    <!-- Admin actions block inside the actions card -->
    <div
      v-if="props.isAdmin && props.plugin.status === 'PENDING'"
      class="flex flex-col gap-2 mt-2 pt-3 border-t border-white/5 w-full"
    >
      <span class="text-[10px] text-amber-400 font-semibold px-1">{{
        label('管理员审核', 'Admin Review')
      }}</span>
      <div class="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          :disabled="props.isSavingReview"
          class="flex-1 flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 border-0"
          @click="emit('review-approved', props.plugin)"
        >
          <CheckCircle2 class="h-3.5 w-3.5 text-white" />
          <span>{{ label('通过', 'Approve') }}</span>
        </Button>
        <Button
          variant="danger"
          size="sm"
          :disabled="props.isSavingReview"
          class="flex-1 flex items-center justify-center gap-1"
          @click="emit('review-rejected', props.plugin)"
        >
          <XCircle class="h-3.5 w-3.5 text-white" /> <span>{{ label('驳回', 'Reject') }}</span>
        </Button>
      </div>
    </div>
  </div>
</template>
<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 99px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
