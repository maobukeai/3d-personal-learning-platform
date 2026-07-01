<script setup lang="ts">
import { Link2, Database, FileText, Trash2, Loader2, Sparkles } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import type { MirrorSource } from '../AdminMirrorView.vue';

defineProps<{
  selectedSource: MirrorSource | null;
  isUploading: boolean;
  matchResult: { totalLinks: number; matchedCount: number } | null;
}>();

const show = defineModel<boolean>('show', { required: true });
const files = defineModel<File[]>('files', { required: true });

const emit = defineEmits<{
  upload: [];
}>();

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const selected = Array.from(target.files);
    selected.forEach((file) => {
      const exists = files.value.some((f) => f.name === file.name && f.size === file.size);
      if (!exists) {
        files.value.push(file);
      }
    });
    target.value = '';
  }
}

function removeFile(index: number) {
  files.value.splice(index, 1);
}
</script>

<template>
  <Modal :show="show" size="sm" glass-card padding="md" @close="show = false">
    <template #header>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Link2 class="w-5 h-5 text-indigo-500" />
        匹配提取链接 - {{ selectedSource?.displayName }}
      </h2>
    </template>

    <div class="space-y-4">
      <div
        class="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400 space-y-1.5"
      >
        <p class="font-bold text-slate-700 dark:text-slate-300">💡 上传说明：</p>
        <p>
          1. 支持 <strong class="text-slate-700 dark:text-slate-300">.xlsx</strong> 格式的 Excel
          数据。
        </p>
        <p>2. 数据表中应包含以下列头名称：</p>
        <ul class="list-disc pl-4 space-y-0.5 mt-1 text-slate-600 dark:text-slate-400">
          <li><strong class="text-indigo-500">课程名称</strong>（用于匹配系统内已有课程）</li>
          <li><strong class="text-indigo-500">链接</strong>（如百度网盘、夸克网盘链接）</li>
          <li><strong class="text-indigo-500">链接密码</strong> / 提取码（选填）</li>
          <li>
            <strong class="text-indigo-500">课程备注</strong> / 备注（包含原站链接如
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
          <div class="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-full text-indigo-500">
            <Database class="w-6 h-6 animate-pulse" />
          </div>
          <div class="text-sm font-medium text-slate-700 dark:text-slate-200">
            点击或拖拽上传 Excel 文件
          </div>
          <div class="text-xs text-slate-400">支持多选，仅限 .xlsx 格式文件</div>
        </div>
      </div>

      <!-- Selected Files List -->
      <div v-if="files.length > 0" class="space-y-1.5 max-h-48 overflow-y-auto p-0.5">
        <div
          class="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between px-1"
        >
          <span>已选择的文件 ({{ files.length }})</span>
          <button
            type="button"
            class="text-indigo-500 hover:text-indigo-600 transition-colors"
            @click="files = []"
          >
            清空全部
          </button>
        </div>
        <div
          v-for="(file, index) in files"
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
          <button
            type="button"
            class="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
            @click="removeFile(index)"
          >
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
        <div class="grid grid-cols-2 gap-4 mt-2 mobile-grid">
          <div
            class="bg-white dark:bg-slate-800/40 p-2.5 rounded-lg border border-emerald-100/50 dark:border-emerald-500/5 text-center"
          >
            <div class="text-xs text-slate-400">发现课程链接</div>
            <div class="text-lg font-bold text-slate-800 dark:text-slate-200">
              {{ matchResult.totalLinks }}
            </div>
          </div>
          <div
            class="bg-white dark:bg-slate-800/40 p-2.5 rounded-lg border border-emerald-100/50 dark:border-emerald-500/5 text-center"
          >
            <div class="text-xs text-slate-400">成功匹配绑定</div>
            <div class="text-lg font-bold text-emerald-500">
              {{ matchResult.matchedCount }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        :disabled="isUploading"
        @click="show = false"
      >
        关闭
      </button>
      <button
        type="button"
        class="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-500"
        :disabled="files.length === 0 || isUploading"
        @click="emit('upload')"
      >
        <Loader2 v-if="isUploading" class="w-4 h-4 animate-spin" />
        {{ isUploading ? '匹配中...' : '开始匹配' }}
      </button>
    </template>
  </Modal>
</template>
