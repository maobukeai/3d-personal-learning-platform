<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { getApiErrorMessage } from '@/utils/error';
import { ref, watch } from 'vue';
import { X, Link2, Database, FileText, Trash2, Sparkles, Loader2 } from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage } from 'element-plus';

interface MirrorSource {
  id: string;
  name: string;
  displayName: string;
}

const props = defineProps<{
  modelValue: boolean;
  source: MirrorSource | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'matched'): void;
}>();

const excelFiles = ref<File[]>([]);
const isUploading = ref(false);
const matchResult = ref<{ totalLinks: number; matchedCount: number } | null>(null);

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      excelFiles.value = [];
      matchResult.value = null;
    }
  },
);

const handleClose = () => {
  emit('update:modelValue', false);
};

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const selected = Array.from(target.files);
    selected.forEach((file) => {
      const exists = excelFiles.value.some((f) => f.name === file.name && f.size === file.size);
      if (!exists) {
        excelFiles.value.push(file);
      }
    });
    target.value = '';
  }
}

function removeFile(index: number) {
  excelFiles.value.splice(index, 1);
}

async function uploadAndMatch() {
  if (excelFiles.value.length === 0 || !props.source) {
    ElMessage.warning(t('admin.please_select_the_excel'));
    return;
  }

  isUploading.value = true;
  const formData = new FormData();
  excelFiles.value.forEach((file) => {
    formData.append('files', file);
  });

  try {
    const res = await api.post(
      `/api/admin/mirror/sources/${props.source.id}/match-links`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    ElMessage.success(res.data.message || t('admin.match_successful'));
    matchResult.value = {
      totalLinks: res.data.totalLinks,
      matchedCount: res.data.matchedCount,
    };
    emit('matched');
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } } };
    ElMessage.error(getApiErrorMessage(err, t('admin.match_failed')));
  } finally {
    isUploading.value = false;
  }
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="handleClose"
  >
    <div
      class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md mx-4 shadow-2xl overflow-hidden"
    >
      <div
        class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
      >
        <h2
          class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"
        >
          <Link2 class="w-5 h-5 text-indigo-500 animate-none" />
          匹配提取链接 - {{ source?.displayName }}
        </h2>
        <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" @click="handleClose">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-5 space-y-4">
        <div
          class="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400 space-y-1.5"
        >
          <p class="font-bold text-slate-700 dark:text-slate-300">{{ $t('admin.upload_instructions') }}</p>
          <p>
            1. 支持 <strong class="text-slate-700 dark:text-slate-300">.xlsx</strong> 格式的
            Excel 数据。
          </p>
          <p>{{ $t('admin.2_the_data_table') }}</p>
          <ul class="list-disc pl-4 space-y-0.5 mt-1 text-slate-600 dark:text-slate-400">
            <li>
              <strong class="text-indigo-500">{{ $t('admin.course_name') }}</strong>（用于匹配系统内已有课程）
            </li>
            <li>
              <strong class="text-indigo-500">{{ $t('admin.link') }}</strong>（如百度网盘、夸克网盘链接）
            </li>
            <li><strong class="text-indigo-500">{{ $t('admin.link_password') }}</strong> {{ $t('admin.extraction_code_optional') }}</li>
            <li>
              <strong class="text-indigo-500">{{ $t('admin.course_notes') }}</strong> / 备注（包含原站链接如
              zycku.com/xxxx.html 可实现100%精准匹配）
            </li>
          </ul>
        </div>

        <div
          class="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer transition-all relative"
        >
          <input
            type="file"
            accept=".xlsx"
            multiple
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            @change="handleFileChange"
          />
          <div class="flex flex-col items-center justify-center space-y-2">
            <div
              class="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-full text-indigo-500 animate-none"
            >
              <Database class="w-6 h-6 animate-pulse" />
            </div>
            <div class="text-sm font-medium text-slate-700 dark:text-slate-200">
              点击或拖拽上传 Excel 文件
            </div>
            <div class="text-xs text-slate-400">{{ $t('admin.supports_multiple_selection_only') }}</div>
          </div>
        </div>

        <!-- Selected Files List -->
        <div
          v-if="excelFiles.length > 0"
          class="space-y-1.5 max-h-48 overflow-y-auto p-0.5"
        >
          <div
            class="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between px-1"
          >
            <span>{{ $t('admin.selected_files_excelfiles_length') }}</span>
            <button type="button" class="text-indigo-500 hover:text-indigo-600 transition-colors cursor-pointer" @click="excelFiles = []">
              清空全部
            </button>
          </div>
          <div
            v-for="(file, index) in excelFiles"
            :key="file.name + '-' + file.size + '-' + index"
            class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-lg text-xs"
          >
            <div class="flex items-center gap-2 overflow-hidden mr-2">
              <FileText class="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span
                class="text-slate-700 dark:text-slate-300 truncate font-medium max-w-[200px]"
                :title="file.name"
                >{{ file.name }}</span
              >
              <span class="text-slate-400 flex-shrink-0"
                >({{ (file.size / 1024).toFixed(1) }} KB)</span
              >
            </div>
            <button type="button" class="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0 cursor-pointer" @click="removeFile(index)">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Match Results -->
        <div
          v-if="matchResult"
          class="p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-lg text-sm text-emerald-600 dark:text-emerald-400"
        >
          <p class="font-semibold flex items-center gap-1.5 mb-1">
            <Sparkles class="w-4 h-4 text-emerald-500" />
            自动匹配完成！
          </p>
          <div class="grid grid-cols-2 gap-4 mt-2">
            <div
              class="bg-white dark:bg-slate-800/40 p-2.5 rounded-lg border border-emerald-100/50 dark:border-emerald-500/5 text-center"
            >
              <div class="text-xs text-slate-400">{{ $t('admin.discover_course_links') }}</div>
              <div class="text-lg font-bold text-slate-800 dark:text-slate-200">
                {{ matchResult.totalLinks }}
              </div>
            </div>
            <div
              class="bg-white dark:bg-slate-800/40 p-2.5 rounded-lg border border-emerald-100/50 dark:border-emerald-500/5 text-center"
            >
              <div class="text-xs text-slate-400">{{ $t('admin.successfully_matched_binding') }}</div>
              <div class="text-lg font-bold text-emerald-500">
                {{ matchResult.matchedCount }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
      >
        <button type="button" class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer" :disabled="isUploading" @click="handleClose">
          关闭
        </button>
        <button type="button" class="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer" :disabled="excelFiles.length === 0 || isUploading" @click="uploadAndMatch">
          <Loader2 v-if="isUploading" class="w-4 h-4 animate-spin" />
          {{ isUploading ? t('admin.matching') : $t('admin.start_matching') }}
        </button>
      </div>
    </div>
  </div>
</template>
