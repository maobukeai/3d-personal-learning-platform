<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import {
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Heart,
  Share2,
  Trash2,
  XCircle,
} from 'lucide-vue-next';
import { useThemeObserver } from '@/composables/useThemeObserver';
import { getAssetUrl } from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import { useAuthStore } from '@/stores/auth';
import type { NormalizedMaterial } from '../materialAdapter';
const MdPreview = defineAsyncComponent(() =>
  import('md-editor-v3').then((m) => {
    import('md-editor-v3/lib/preview.css');
    return m.MdPreview;
  }),
);
const { isDark } =
  useThemeObserver(); /** * Right-column upper block for MaterialDetailPanel: author card, download * options + quick stats, management/admin actions, markdown description and * rejection reason. All state is supplied via props; interactions are emitted. */
defineProps<{
  material: NormalizedMaterial;
  isExternal: boolean;
  isDownloading: boolean;
  canDownload: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  isSavingReview: boolean;
  inline: boolean;
}>();
const emit = defineEmits<{
  (e: 'download'): void;
  (e: 'edit'): void;
  (e: 'favorite'): void;
  (e: 'delete'): void;
  (e: 'share'): void;
  (e: 'approve'): void;
  (e: 'reject'): void;
}>();
const label = useLabel();
const authStore = useAuthStore();
</script>
<template>
  <!-- Author Profile Card -->
  <div
    v-if="material.user"
    class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 text-left shrink-0"
  >
    <div
      class="h-9 w-9 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center text-sm shrink-0"
    >
      <img
        v-if="material.user.avatarUrl"
        :src="getAssetUrl(material.user.avatarUrl)"
        class="h-full w-full object-cover"
      />
      <span v-else class="font-semibold uppercase text-xs text-[var(--text-secondary)]">{{
        material.user.name?.slice(0, 1) || 'A'
      }}</span>
    </div>
    <div class="text-left min-w-0">
      <div class="text-xs font-bold text-[var(--text-primary)] truncate">
        {{ material.user.name }}
      </div>
      <div class="text-[10px] text-[var(--text-muted)] mt-1 font-medium uppercase tracking-wider">
        {{ label('上传作者', 'Author') }}
      </div>
    </div>
  </div>
  <!-- Download Options Box -->
  <div class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 text-left">
    <div class="flex justify-between items-center">
      <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{{
        label('下载选项', 'Download Options')
      }}</span>
      <div>
        <span
          v-if="material.status === 'APPROVED'"
          class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
        >
          {{ label('已发布', 'Approved') }}
        </span>
        <span
          v-else-if="material.status === 'PENDING'"
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
      :disabled="!isExternal && (!canDownload || isDownloading)"
      class="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] transition-all duration-300"
      @click="emit('download')"
    >
      <template v-if="isExternal">
        <ExternalLink class="h-4.5 w-4.5" />
        <span>{{ label('前往源站获取下载', 'Visit Source Site') }}</span>
      </template>
      <template v-else>
        <Download v-if="!isDownloading" class="h-4.5 w-4.5 animate-bounce-slow" />
        <span>{{ label('下载材质包', 'Download Material') }}</span>
      </template>
    </Button>
    <!-- Quick Statistics -->
    <div class="grid grid-cols-2 gap-2 mt-1 pt-3 border-t border-white/5">
      <div class="flex flex-col gap-0.5">
        <span class="text-[10px] text-[var(--text-muted)]">{{
          label('下载次数', 'Downloads')
        }}</span>
        <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
          <Download class="h-3 w-3 text-teal-400" /> {{ material.downloads || 0 }}
        </span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[10px] text-[var(--text-muted)]">{{
          label('收藏人数', 'Favorites')
        }}</span>
        <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
          <Heart class="h-3 w-3 text-rose-400 fill-rose-400/20" /> {{ material.favorites || 0 }}
        </span>
      </div>
    </div>
  </div>
  <!-- Control Action Buttons -->
  <div
    v-if="!inline"
    class="flex flex-col gap-2 p-3 bg-white/[0.01] border border-white/5 rounded-2xl text-left"
  >
    <span
      class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold px-1 mb-1"
      >{{ label('管理与操作', 'Actions') }}</span
    >
    <div class="grid grid-cols-2 gap-2">
      <Button
        v-if="canEdit"
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-400"
        @click="emit('edit')"
      >
        <Edit3 class="h-3.5 w-3.5 text-emerald-400" /> <span>{{ label('编辑', 'Edit') }}</span>
      </Button>
      <Button
        v-if="canEdit"
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5 hover:bg-rose-500/10 hover:text-rose-400"
        @click="emit('delete')"
      >
        <Trash2 class="h-3.5 w-3.5 text-rose-400" /> <span>{{ label('删除', 'Delete') }}</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-1.5"
        :class="{ 'text-rose-400 bg-rose-500/5': material.isFavorited }"
        @click="emit('favorite')"
      >
        <Heart
          :class="[
            'h-3.5 w-3.5',
            material.isFavorited ? 'text-rose-500 fill-rose-500' : 'text-slate-400',
          ]"
        />
        <span>{{ material.isFavorited ? label('已收藏', 'Saved') : label('收藏', 'Save') }}</span>
      </Button>
      <Button
        v-if="authStore.user"
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
      v-if="isAdmin && material.status === 'PENDING'"
      class="flex flex-col gap-2 mt-2 pt-3 border-t border-white/5 w-full"
    >
      <span class="text-[10px] text-amber-400 font-semibold px-1">{{
        label('管理员审核', 'Admin Review')
      }}</span>
      <div class="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          :disabled="isSavingReview"
          class="flex-1 flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 border-0"
          @click="emit('approve')"
        >
          <CheckCircle2 class="h-3.5 w-3.5 text-white" />
          <span>{{ label('通过', 'Approve') }}</span>
        </Button>
        <Button
          variant="danger"
          size="sm"
          :disabled="isSavingReview"
          class="flex-1 flex items-center justify-center gap-1"
          @click="emit('reject')"
        >
          <XCircle class="h-3.5 w-3.5 text-white" /> <span>{{ label('驳回', 'Reject') }}</span>
        </Button>
      </div>
    </div>
  </div>
  <!-- Description -->
  <div class="flex flex-col gap-1.5 text-left">
    <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
      {{ label('说明', 'Description') }}
    </h4>
    <div class="bg-white/[0.01] border border-white/5 rounded-2xl p-4 overflow-hidden">
      <MdPreview
        :model-value="
          material.description || label('作者很懒，什么都没有写。', 'No description provided.')
        "
        :theme="isDark ? 'dark' : 'light'"
        class="!bg-transparent !text-[var(--text-secondary)] !text-xs dark:invert-preview"
      />
    </div>
  </div>
  <!-- Reject Reason -->
  <div v-if="material.rejectReason" class="flex flex-col gap-1.5 text-left">
    <h4 class="text-xs font-bold text-rose-400 uppercase tracking-wider">
      {{ label('审核驳回原因', 'Rejection Reason') }}
    </h4>
    <p
      class="text-xs text-rose-300 leading-relaxed bg-rose-500/10 border border-rose-500/20 rounded-xl p-3"
    >
      {{ material.rejectReason }}
    </p>
  </div>
</template>
