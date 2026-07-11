<script setup lang="ts">
import { ref } from 'vue';
import { History, Plus, RefreshCw, FileArchive, Edit3, Trash2, Download } from 'lucide-vue-next';
import { formatDate } from '@/utils/format';
import { useLabel } from '@/utils/i18n';
import type { VersionItem } from '@/composables/useUnifiedDetail';
import type { PluginItem, VersionForm } from './detailTypes';
interface Props {
  plugin: PluginItem;
  canEdit: boolean;
  versionsList: VersionItem[];
  isVersionsLoading: boolean;
  isPublishingVersion: boolean;
  isUpdatingVersion: boolean;
  publishVersionFile: File | null;
}
const props = defineProps<Props>();
const editingVersionForm = defineModel<VersionForm>('editingVersionForm', { required: true });
const publishVersionForm = defineModel<VersionForm>('publishVersionForm', { required: true });
const emit = defineEmits<{
  (e: 'publish-file-change', event: Event): void;
  (e: 'publish-submit'): void;
  (e: 'edit-version', version: VersionItem): void;
  (e: 'update-version-submit', versionId: string): void;
  (e: 'delete-version', version: VersionItem): void;
  (e: 'version-download', version: VersionItem): void;
}>();
const label = useLabel();
const showVersionUploadPanel = defineModel<boolean>('showVersionUploadPanel', { required: true });
const editingVersionId = defineModel<string | null>('editingVersionId', { required: true });
const releaseFileInput = ref<HTMLInputElement | null>(null);
const formatSize = (size?: number | null) => {
  if (!size) return label('未知大小', 'Unknown size');
  if (size >= 1) return `${size.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size * 1024))} KB`;
};
</script>
<template>
  <div class="flex flex-col gap-4">
    <!-- Header row -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-bold text-[var(--text-primary)] border-l-2 border-indigo-500 pl-2">
        {{ label('历史发布版本', 'Version Release History') }}
      </h3>
      <button
        v-if="props.canEdit"
        class="flex items-center gap-1.5 text-[10px] font-extrabold px-3 py-1.5 rounded-xl bg-teal-600/15 hover:bg-teal-600/25 border border-teal-500/25 text-teal-800 dark:text-teal-400 transition-colors cursor-pointer"
        @click="showVersionUploadPanel = !showVersionUploadPanel"
      >
        <Plus class="w-3 h-3" /> <span>{{ label('上传新版本', 'Upload New Version') }}</span>
      </button>
    </div>
    <!-- Upload panel (collapsible, owner only) -->
    <div
      v-if="props.canEdit && showVersionUploadPanel"
      class="p-4 rounded-2xl bg-teal-600/5 border border-teal-500/15 flex flex-col gap-3"
    >
      <h4 class="text-xs font-bold text-teal-800 dark:text-teal-400 flex items-center gap-1.5">
        <History class="w-3.5 h-3.5" />
        <span>{{ label('上传新版本包', 'Upload New Version Package') }}</span>
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-3">
          <div>
            <label class="block text-[10px] font-semibold text-slate-400 mb-1.5">{{
              label('插件包文件 (.zip) *', 'Plugin Package (.zip) *')
            }}</label>
            <input
              ref="releaseFileInput"
              type="file"
              accept=".zip"
              class="hidden"
              @change="emit('publish-file-change', $event)"
            />
            <div
              class="border border-dashed border-white/10 hover:border-teal-500 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white/[0.02] transition-colors"
              @click="releaseFileInput?.click()"
            >
              <FileArchive class="w-6 h-6 text-teal-500" />
              <span class="text-[10px] text-[var(--text-secondary)] font-medium text-center">
                {{
                  props.publishVersionFile
                    ? props.publishVersionFile.name
                    : label('点击选择 zip 插件包', 'Click to choose zip')
                }}
              </span>
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-slate-400 mb-1.5">{{
              label('版本号 *', 'Version *')
            }}</label>
            <input
              v-model="publishVersionForm.version"
              type="text"
              placeholder="e.g. 1.1.0"
              class="w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/10 rounded-xl text-white outline-none focus:border-teal-500"
            />
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <div class="flex-1 flex flex-col">
            <label class="block text-[10px] font-semibold text-slate-400 mb-1.5">{{
              label('更新日志 / Changelog', 'Changelog')
            }}</label>
            <textarea
              v-model="publishVersionForm.changelog"
              placeholder="描述新版本的优化、Bug修复等内容..."
              class="flex-1 min-h-[100px] w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/10 rounded-xl text-white outline-none focus:border-teal-500 resize-none"
            ></textarea>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-1">
        <button
          class="text-[10px] px-3 py-1.5 rounded-xl border border-white/10 text-[var(--text-muted)] hover:text-white bg-transparent cursor-pointer transition-colors"
          @click="showVersionUploadPanel = false"
        >
          {{ label('取消', 'Cancel') }}
        </button>
        <Button
          variant="primary"
          size="sm"
          :loading="props.isPublishingVersion"
          :disabled="!props.publishVersionFile || !publishVersionForm.version.trim()"
          @click="emit('publish-submit')"
        >
          {{ label('上传此版本', 'Upload Version') }}
        </Button>
      </div>
    </div>
    <!-- Version cards list -->
    <div v-if="props.isVersionsLoading" class="flex justify-center py-6">
      <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
    </div>
    <div
      v-else-if="props.versionsList.length === 0"
      class="text-center py-6 text-xs text-[var(--text-muted)]"
    >
      {{ label('暂无历史发布版本。', 'No release history available.') }}
    </div>
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="v in props.versionsList"
        :key="v.id"
        class="flex flex-col gap-2 p-4 rounded-2xl border transition-colors"
        :class="
          v.version === props.plugin.version
            ? 'bg-indigo-600/8 border-indigo-500/30'
            : 'bg-white/[0.02] border-white/5'
        "
      >
        <!-- Edit mode form -->
        <div v-if="editingVersionId === v.id" class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <div class="flex-1">
              <label class="block text-[10px] font-semibold text-slate-400 mb-1">{{
                label('版本号', 'Version')
              }}</label>
              <input
                v-model="editingVersionForm.version"
                type="text"
                class="w-full px-3 py-1.5 text-xs bg-white/[0.03] border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-slate-400 mb-1">{{
              label('更新日志', 'Changelog')
            }}</label>
            <textarea
              v-model="editingVersionForm.changelog"
              class="w-full min-h-[60px] px-3 py-1.5 text-xs bg-white/[0.03] border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500 resize-none"
            ></textarea>
          </div>
          <div class="flex justify-end gap-2 mt-1">
            <button
              class="text-[10px] px-2.5 py-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white bg-transparent cursor-pointer transition-colors"
              @click="editingVersionId = null"
            >
              {{ label('取消', 'Cancel') }}
            </button>
            <Button
              variant="primary"
              size="sm"
              :loading="props.isUpdatingVersion"
              :disabled="!editingVersionForm.version.trim()"
              @click="emit('update-version-submit', v.id)"
            >
              {{ label('保存', 'Save') }}
            </Button>
          </div>
        </div>
        <!-- Display mode -->
        <template v-else>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span
                class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 border border-indigo-500/20 shrink-0"
              >
                v{{ v.version }}
              </span>
              <span
                v-if="v.version === props.plugin.version"
                class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
              >
                {{ label('当前推送', 'Active') }}
              </span>
              <span class="text-[10px] text-slate-500 dark:text-slate-300 font-mono truncate">
                {{ formatDate(v.createdAt) }}
              </span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <!-- Edit button -->
              <button
                v-if="props.canEdit"
                type="button"
                class="flex items-center justify-center p-1.5 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 cursor-pointer transition-colors"
                :title="label('编辑版本信息', 'Edit Version Info')"
                @click="emit('edit-version', v)"
              >
                <Edit3 class="w-3.5 h-3.5" />
              </button>
              <!-- Delete button -->
              <button
                v-if="props.canEdit"
                type="button"
                class="flex items-center justify-center p-1.5 text-[10px] font-bold text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 cursor-pointer transition-colors"
                :title="label('删除版本', 'Delete Version')"
                @click="emit('delete-version', v)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
              <!-- Download button -->
              <button
                type="button"
                class="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-400/20 hover:border-indigo-400/40 px-2 py-1 rounded-lg bg-transparent cursor-pointer"
                @click="emit('version-download', v)"
              >
                <Download class="w-3 h-3" /> <span>{{ formatSize(v.fileSize) }}</span>
              </button>
            </div>
          </div>
          <div
            class="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed"
          >
            {{ v.changelog || label('暂无更新说明。', 'No release notes.') }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
