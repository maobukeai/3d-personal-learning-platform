<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref } from 'vue';
import { Upload, FileText, Trash2, AlertTriangle, RefreshCw } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { useSettingsSync } from '@/composables/useSettingsSync';

const props = defineProps<{
  settings: {
    MAX_UPLOAD_SIZE_MB: string;
    ALLOWED_FILE_TYPES: string;
  };
}>();

const emit = defineEmits<{
  (e: 'update:settings', val: typeof props.settings): void;
}>();

const { localSettings } = useSettingsSync(props, emit);

const isCleaning = ref(false);

const handleCleanupStorage = async () => {
  try {
    await ElMessageBox.confirm(
      t('admin.this_operation_will_scan'),
      t('admin.confirm_to_clear_storage'),
      {
        confirmButtonText: t('admin.clean_up_now'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );

    isCleaning.value = true;
    const { data } = await api.post('/api/admin/settings/cleanup-storage');
    const stats = data.stats || { scanned: 0, deleted: 0, errors: 0 };

    await ElMessageBox.alert(
      `<div class="space-y-2">
        <p class="text-sm font-bold text-emerald-600">${t('admin.storage_space_cleared_successfully')}</p>
        <div class="text-xs space-y-1 bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/10 font-mono">
          <p>${t('admin.number_of_scanned_files')} <span class="font-bold text-slate-800 dark:text-slate-200">${stats.scanned}</span></p>
          <p>${t('admin.number_of_files_to')} <span class="font-bold text-emerald-600">${stats.deleted}</span></p>
          <p>${t('admin.failed_or_skipped')} <span class="font-bold text-rose-500">${stats.errors}</span></p>
        </div>
        <p class="text-[10px] text-slate-400">${t('admin.local_disk_space_has')}</p>
      </div>`,
      t('admin.clean_results'),
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: t('admin.ok'),
        type: 'success',
      },
    );
  } catch (error) {
    if (error !== 'cancel') {
      logError(error, { operation: 'admin.cleanupStorage', component: 'UploadSettingsTab' });
      ElMessage.error(getApiErrorMessage(error, t('admin.failed_to_clear_storage')));
    }
  } finally {
    isCleaning.value = false;
  }
};
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <section
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 mb-8">
        <Upload class="w-5 h-5 text-emerald-500" />
        <h2 class="text-lg font-bold" style="color: var(--text-primary)">
          {{ $t('admin.upload_and_storage_limits') }}
        </h2>
      </div>

      <div class="space-y-6">
        <div class="space-y-2">
          <label
            class="text-xs font-bold px-1 flex items-center gap-2"
            style="color: var(--text-secondary)"
          >
            <Upload class="w-3.5 h-3.5" />
            单文件最大上传大小 (MB)
          </label>
          <input
            v-model="localSettings.MAX_UPLOAD_SIZE_MB"
            type="number"
            min="1"
            max="2048"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
          <p class="text-[10px] px-1" style="color: var(--text-muted)">
            限制用户上传的单个文件大小，建议不超过 500MB
          </p>
        </div>

        <div class="space-y-2">
          <label
            class="text-xs font-bold px-1 flex items-center gap-2"
            style="color: var(--text-secondary)"
          >
            <FileText class="w-3.5 h-3.5" />
            允许的文件类型 (使用逗号分隔)
          </label>
          <textarea
            v-model="localSettings.ALLOWED_FILE_TYPES"
            rows="2"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all resize-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          ></textarea>
          <p class="text-[10px] px-1" style="color: var(--text-muted)">
            仅允许上传指定扩展名的文件，留空则不限制
          </p>
        </div>
      </div>
    </section>

    <section
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 mb-8">
        <Trash2 class="w-5 h-5 text-rose-500" />
        <h2 class="text-lg font-bold" style="color: var(--text-primary)">
          {{ $t('admin.storage_space_cleanup') }}
        </h2>
      </div>

      <div class="space-y-6">
        <div
          class="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-amber-600 dark:text-amber-400 space-y-2"
        >
          <div class="flex items-start gap-2.5">
            <AlertTriangle class="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
            <div>
              <p class="text-xs font-bold">{{ $t('admin.important_tips_and_cleaning') }}</p>
              <p class="text-[10px] mt-1 leading-relaxed opacity-90">
                该操作将扫描服务器上的本地上传目录（如
                branding、discussions、feedback、messages、users
                等文件夹），比对数据库中的所有关联字段。任何在数据库中已无记录对应的残留本地物理文件（孤儿文件）都将被永久物理删除，以便释放磁盘存储空间。该操作不可逆，请谨慎执行。
              </p>
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent"
        >
          <div>
            <span class="text-xs font-bold" style="color: var(--text-primary)">{{
              $t('admin.clean_up_orphan_files')
            }}</span>
            <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
              安全清理无用的冗余文件资源，自动保留有效的品牌、课程与讨论资源
            </p>
          </div>
          <button
            type="button"
            :disabled="isCleaning"
            class="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-600/50 text-white rounded-xl font-bold text-xs transition-all shadow-sm shrink-0 cursor-pointer"
            @click="handleCleanupStorage"
          >
            <Trash2 v-if="!isCleaning" class="w-3.5 h-3.5" />
            <RefreshCw v-else class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isCleaning ? $t('admin.cleaning_up') : $t('admin.clean_up_now') }}</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
