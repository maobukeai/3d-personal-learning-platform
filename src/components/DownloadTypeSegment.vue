<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import FileDropZone from './FileDropZone.vue';

const props = withDefaults(
  defineProps<{
    accept?: string;
    fileLabel?: string;
    dragLabel?: string;
    supportedLabel?: string;
    progress?: number | null;
  }>(),
  {
    accept: '.glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.blend,.usdz,.abc,.zip',
    progress: null,
  },
);

const downloadType = defineModel<'local' | 'external'>('downloadType', { required: true });
const file = defineModel<File | null>('file', { required: true });
const externalUrl = defineModel<string>('externalUrl', { required: true });
const extractionCode = defineModel<string>('extractionCode', { required: true });

const emit = defineEmits<{
  (e: 'change', event: Event): void;
}>();

const { t } = useI18n();

const handleFileChange = (e: Event) => {
  emit('change', e);
};
</script>

<template>
  <div>
    <label
      v-if="fileLabel"
      class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
    >
      {{ fileLabel }}
    </label>
    <!-- Segment Switcher for Download Type -->
    <div
      class="flex p-0.5 mb-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-800/80"
    >
      <button
        type="button"
        @click="downloadType = 'local'"
        :class="[
          'flex-1 py-1 text-xs font-semibold rounded-lg transition-all',
          downloadType === 'local'
            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400',
        ]"
      >
        本地文件上传
      </button>
      <button
        type="button"
        @click="downloadType = 'external'"
        :class="[
          'flex-1 py-1 text-xs font-semibold rounded-lg transition-all',
          downloadType === 'external'
            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400',
        ]"
      >
        网盘链接 / 网页直达
      </button>
    </div>

    <!-- Local Upload Zone -->
    <div v-show="downloadType === 'local'">
      <FileDropZone
        v-model="file"
        :accept="accept"
        height-class="h-20"
        :progress="progress"
        :label="file ? file.name : dragLabel || t('publishDialog.dragAssetFile')"
        :sublabel="supportedLabel"
        @change="handleFileChange"
      />
    </div>

    <!-- External URL Inputs -->
    <div v-show="downloadType === 'external'" class="space-y-2">
      <div class="grid grid-cols-3 gap-2">
        <div class="col-span-2">
          <input
            v-model="externalUrl"
            type="text"
            placeholder="如：https://pan.baidu.com/s/..."
            class="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800 text-[var(--text-primary)] outline-none transition-all focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800"
          />
        </div>
        <div>
          <input
            v-model="extractionCode"
            type="text"
            placeholder="提取码 (可选)"
            class="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800 text-[var(--text-primary)] outline-none transition-all focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800"
          />
        </div>
      </div>
    </div>
  </div>
</template>
