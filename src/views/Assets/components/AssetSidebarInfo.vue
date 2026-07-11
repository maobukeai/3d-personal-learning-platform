<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { Download, Edit3, Eye, FolderOpen, Heart, Lock, Share2, Trash2 } from 'lucide-vue-next';
import 'md-editor-v3/lib/preview.css';
import { useThemeObserver } from '@/composables/useThemeObserver';
import { getAssetUrl } from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import { useAuthStore } from '@/stores/auth';
import type { AssetDetailResource } from './types';
const MdPreview = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdPreview));
const { isDark } =
  useThemeObserver(); /** * Right-column upper block for AssetDetailModal: author card, download options * (source package + preview model) with quick stats, management action buttons * and the markdown description. All state is supplied via props; interactions * are emitted. The download action carries an `isPackage` flag so the parent * can pick the correct url. */
defineProps<{
  asset: AssetDetailResource;
  isDownloading: boolean;
  canDownload: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isLiked: boolean;
  likeCount: number;
  downloadCount: number;
  inline: boolean;
}>();
const emit = defineEmits<{
  (e: 'download', isPackage: boolean): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'like'): void;
  (e: 'share'): void;
}>();
const label = useLabel();
const authStore = useAuthStore();
</script>
<template>
  <!-- Author Profile Card -->
  <div
    v-if="asset.user"
    class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 text-left shrink-0"
  >
    <div
      class="h-9 w-9 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center text-sm shrink-0"
    >
      <img
        v-if="asset.user.avatarUrl"
        :src="getAssetUrl(asset.user.avatarUrl)"
        class="h-full w-full object-cover"
      />
      <span v-else class="font-semibold uppercase text-xs text-[var(--text-secondary)]">{{
        asset.user.name?.slice(0, 1) || 'A'
      }}</span>
    </div>
    <div class="text-left min-w-0">
      <div class="text-xs font-bold text-[var(--text-primary)] truncate">{{ asset.user.name }}</div>
      <div class="text-[10px] text-[var(--text-muted)] mt-1 font-medium uppercase tracking-wider">
        {{ label('上传作者', 'Author') }}
      </div>
    </div>
  </div>
  <!-- Download Options Box -->
  <div
    class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 text-left shrink-0"
  >
    <div class="flex justify-between items-center">
      <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{{
        label('下载选项', 'Download Options')
      }}</span>
      <div>
        <span
          v-if="asset.status === 'APPROVED'"
          class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
        >
          {{ label('已发布', 'Approved') }}
        </span>
        <span
          v-else-if="asset.status === 'PENDING'"
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
    <!-- Download Buttons vertically stacked -->
    <div class="flex flex-col gap-2.5">
      <!-- Source File Package (.zip) -->
      <Button
        v-if="asset.packageUrl"
        variant="primary"
        size="md"
        :disabled="isDownloading"
        class="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] transition-all duration-300"
        @click="emit('download', true)"
      >
        <Lock v-if="!canDownload" class="h-4.5 w-4.5 text-amber-300" />
        <FolderOpen v-else-if="!isDownloading" class="h-4.5 w-4.5 animate-bounce-slow text-white" />
        <span>
          {{ label('下载源文件包 (.zip)', 'Download Source (.zip)') }}
          <span v-if="!canDownload" class="text-[10px] text-amber-300 font-bold ml-1">(VIP)</span>
        </span>
      </Button>
      <!-- Preview Model (.glb) -->
      <Button
        v-if="asset.url"
        variant="secondary"
        size="md"
        :disabled="isDownloading"
        class="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all duration-300"
        @click="emit('download', false)"
      >
        <Lock v-if="!canDownload" class="h-4.5 w-4.5 text-amber-500/80" />
        <Download v-else-if="!isDownloading" class="h-4.5 w-4.5 text-slate-300" />
        <span>
          {{ label('下载预览模型 (.glb)', 'Download Preview (.glb)') }}
          <span v-if="!canDownload" class="text-[10px] text-amber-500/80 font-bold ml-1"
            >(VIP)</span
          >
        </span>
      </Button>
    </div>
    <!-- Quick Statistics -->
    <div class="grid grid-cols-3 gap-2 mt-1 pt-3 border-t border-white/5">
      <div class="flex flex-col gap-0.5">
        <span class="text-[10px] text-[var(--text-muted)]">{{ label('浏览次数', 'Views') }}</span>
        <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
          <Eye class="h-3 w-3 text-blue-400" /> {{ asset.viewCount || 0 }}
        </span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[10px] text-[var(--text-muted)]">{{
          label('下载次数', 'Downloads')
        }}</span>
        <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
          <Download class="h-3 w-3 text-teal-400" /> {{ downloadCount }}
        </span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[10px] text-[var(--text-muted)]">{{
          label('收藏人数', 'Favorites')
        }}</span>
        <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
          <Heart class="h-3 w-3 text-rose-400 fill-rose-400/20" /> {{ likeCount }}
        </span>
      </div>
    </div>
  </div>
  <!-- Control Action Buttons -->
  <div
    v-if="!inline"
    class="flex flex-col gap-2 p-3 bg-white/[0.01] border border-white/5 rounded-2xl text-left shrink-0"
  >
    <span
      class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold px-1 mb-1"
      >{{ label('管理与操作', 'Actions') }}</span
    >
    <div class="grid grid-cols-2 gap-2">
      <Button
        v-if="isOwner || isAdmin"
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-400 w-full"
        @click="emit('edit')"
      >
        <Edit3 class="h-3.5 w-3.5 text-emerald-400" /> <span>{{ label('编辑', 'Edit') }}</span>
      </Button>
      <Button
        v-if="isOwner || isAdmin"
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5 hover:bg-rose-500/10 hover:text-rose-400 w-full"
        @click="emit('delete')"
      >
        <Trash2 class="h-3.5 w-3.5 text-rose-400" /> <span>{{ label('删除', 'Delete') }}</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5 w-full"
        :class="{ 'text-rose-400 bg-rose-500/5': isLiked }"
        @click="emit('like')"
      >
        <Heart
          :class="['h-3.5 w-3.5', isLiked ? 'text-rose-500 fill-rose-500' : 'text-slate-400']"
        />
        <span>{{ isLiked ? label('已收藏', 'Saved') : label('收藏', 'Save') }}</span>
      </Button>
      <Button
        v-if="authStore.user"
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5 w-full"
        @click="emit('share')"
      >
        <Share2 class="h-3.5 w-3.5 text-indigo-400" /> <span>{{ label('分享', 'Share') }}</span>
      </Button>
    </div>
  </div>
  <!-- Description -->
  <div class="flex flex-col gap-1.5 text-left">
    <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
      {{ label('说明', 'Description') }}
    </h4>
    <div class="bg-white/[0.01] border border-white/5 rounded-xl p-3 overflow-hidden">
      <MdPreview
        :model-value="
          asset.description || label('作者很懒，什么都没有写。', 'No description provided.')
        "
        :theme="isDark ? 'dark' : 'light'"
        class="!bg-transparent !text-[var(--text-secondary)] !text-xs dark:invert-preview"
      />
    </div>
  </div>
</template>
