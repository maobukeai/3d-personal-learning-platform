<script setup lang="ts">
import { computed } from 'vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import ZipFileTreeViewer from '@/components/ZipFileTreeViewer.vue';
import { Sparkles } from 'lucide-vue-next';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import { useSystemStore } from '@/stores/system';
import type { CategoryType, UnifiedWork } from '../../myWorksModel';
import type { FlattenedNode } from '@/utils/zipHelper';
import type { EditForm, PluginVersionEntry } from './types';
import { BLENDER_VERSIONS } from './useEditWorkDialog';
const form = defineModel<EditForm>('form', { required: true });
defineProps<{
  work: UnifiedWork;
  assetCategories: CategoryType[];
  materialCategories: string[];
  pluginCategories: string[];
  fileProgress: number | null;
  packageProgress: number | null;
  thumbnailProgress: number | null;
  isParsingZip: boolean;
  parsedFileTree: FlattenedNode[];
  visibleFileNodes: FlattenedNode[];
  expandedFolders: Set<string>;
  hasPackageFiles: boolean;
  activeZipFile: File | null | undefined;
  existingVersions: PluginVersionEntry[];
  isAddingNewVersion: boolean;
}>();
const emit = defineEmits<{
  (e: 'file-change', event: Event): void;
  (e: 'package-change', event: Event): void;
  (e: 'thumbnail-change', event: Event): void;
  (e: 'toggle-folder', path: string): void;
  (e: 'open-ai-cover'): void;
  (e: 'switch-version-mode', mode: 'new' | 'existing'): void;
}>();
const systemStore = useSystemStore();
function emitUpdate(patch: Partial<EditForm>) {
  form.value = { ...form.value, ...patch };
}
const title = computed({ get: () => form.value.title, set: (v) => emitUpdate({ title: v }) });
const tags = computed({ get: () => form.value.tags, set: (v) => emitUpdate({ tags: v }) });
const categoryId = computed({
  get: () => form.value.categoryId,
  set: (v) => emitUpdate({ categoryId: v }),
});
const materialCategory = computed({
  get: () => form.value.materialCategory,
  set: (v) => emitUpdate({ materialCategory: v }),
});
const resolution = computed({
  get: () => form.value.resolution,
  set: (v) => emitUpdate({ resolution: v }),
});
const isProcedural = computed({
  get: () => form.value.isProcedural,
  set: (v) => emitUpdate({ isProcedural: v }),
});
const pluginCategory = computed({
  get: () => form.value.pluginCategory,
  set: (v) => emitUpdate({ pluginCategory: v }),
});
const pluginVersion = computed({
  get: () => form.value.pluginVersion,
  set: (v) => emitUpdate({ pluginVersion: v }),
});
const pluginCompatibility = computed({
  get: () => form.value.pluginCompatibility,
  set: (v) => emitUpdate({ pluginCompatibility: v }),
});
const fileUploadedName = computed(() => form.value.file?.name || '');
const packageUploadedName = computed(() => form.value.packageFile?.name || '');
const softwareCompatibilityOptions = [
  'Windows 10/11',
  'macOS',
  'Linux',
  'Android',
  'iOS',
  '跨平台',
];
const fallbackSoftwareCategories = [
  '3D 建模与雕刻软件',
  '渲染引擎与渲染器',
  '后期与图像处理',
  '游戏与交互引擎',
  '其他工具',
];
</script>
<template>
  <div class="space-y-3">
    <!-- Segment Switcher for Download Type -->
    <div
      class="flex p-0.5 mb-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-800/80"
    >
      <button
        type="button"
        :class="[
          'flex-1 py-1 text-xs font-semibold rounded-lg transition-all',
          form.downloadType === 'local'
            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400',
        ]"
        @click="form.downloadType = 'local'"
      >
        本地文件上传
      </button>
      <button
        type="button"
        :class="[
          'flex-1 py-1 text-xs font-semibold rounded-lg transition-all',
          form.downloadType === 'external'
            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400',
        ]"
        @click="form.downloadType = 'external'"
      >
        网盘链接 / 网页直达
      </button>
    </div>
    <!-- Local Upload Zone -->
    <div v-show="form.downloadType === 'local'">
      <!-- ASSET file uploaders -->
      <div v-if="work.kind === 'asset'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FileDropZone
          v-model="form.file"
          accept=".glb"
          height-class="h-24"
          :progress="fileProgress"
          :label="form.file ? form.file.name : fileUploadedName || '重新上传主预览模型 (.glb)'"
          sublabel="当前已有模型。留空将保留原模型。仅支持 .glb"
          @change="emit('file-change', $event)"
        />
        <FileDropZone
          v-model="form.packageFile"
          accept=".zip"
          height-class="h-24"
          :progress="packageProgress"
          :label="
            form.packageFile
              ? form.packageFile.name
              : packageUploadedName || '重新上传可选资源包 (.zip)'
          "
          sublabel="当前已有资源包。留空将保留原资源包。仅支持 .zip"
          @change="emit('package-change', $event)"
        />
      </div>
      <!-- MATERIAL file uploaders -->
      <div v-else-if="work.kind === 'material'" class="grid grid-cols-1 gap-4">
        <FileDropZone
          v-model="form.file"
          accept=".zip,.sbsar"
          height-class="h-24"
          :progress="fileProgress"
          :label="form.file ? form.file.name : fileUploadedName || '重新上传材质包 (.zip, .sbsar)'"
          sublabel="当前已有材质包。留空将保留原文件。支持 .zip, .sbsar"
          @change="emit('file-change', $event)"
        />
      </div>
      <!-- PLUGIN file uploaders -->
      <div
        v-else-if="work.kind === 'plugin' || work.kind === 'software'"
        class="grid grid-cols-1 gap-4"
      >
        <FileDropZone
          v-model="form.file"
          :accept="
            work.kind === 'plugin' ? '.zip,.py' : '.exe,.msi,.dmg,.pkg,.deb,.rpm,.zip,.rar,.7z'
          "
          height-class="h-24"
          :progress="fileProgress"
          :label="
            form.file
              ? form.file.name
              : fileUploadedName ||
                (work.kind === 'plugin'
                  ? '重新上传插件文件 (.zip, .py)'
                  : '重新上传软件文件 (.exe, .msi, .dmg, .zip)')
          "
          :sublabel="
            work.kind === 'plugin'
              ? '当前已有插件文件。留空将保留原文件。支持 .zip, .py'
              : '当前已有软件文件。留空将保留原文件。支持 .exe, .msi, .dmg, .zip'
          "
          @change="emit('file-change', $event)"
        />
      </div>
    </div>
    <!-- External Link Inputs -->
    <div v-show="form.downloadType === 'external'" class="space-y-2">
      <div class="grid grid-cols-3 gap-2">
        <div class="col-span-2">
          <input
            v-model="form.externalUrl"
            type="text"
            placeholder="如：https://pan.baidu.com/s/..."
            class="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800 text-[var(--text-primary)] outline-none transition-all focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800"
          />
        </div>
        <div>
          <input
            v-model="form.extractionCode"
            type="text"
            placeholder="提取码 (可选)"
            class="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800 text-[var(--text-primary)] outline-none transition-all focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800"
          />
        </div>
      </div>
    </div>
    <ZipFileTreeViewer
      :show="
        ['asset', 'material', 'plugin', 'software'].includes(work.kind) &&
        (isParsingZip || hasPackageFiles)
      "
      :file="activeZipFile"
      :is-parsing-zip="isParsingZip"
      :parsed-file-tree="parsedFileTree"
      :visible-file-nodes="visibleFileNodes"
      :expanded-folders="expandedFolders"
      @toggle="emit('toggle-folder', $event)"
    />
    <div><Input v-model="title" type="text" label="作品名称" required /></div>
    <!-- Category and Cover Image Selection -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label v-if="work.kind === 'asset'" class="form-field flex flex-col text-left">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >资源分类</span
        >
        <Select
          v-model="categoryId"
          size="large"
          class="w-full custom-dialog-input"
          placeholder="选择分类"
        >
          <SelectOption value="" label="选择分类" />
          <SelectOption
            v-for="category in assetCategories"
            :key="category.id"
            :label="category.name"
            :value="category.id"
          />
        </Select>
      </label>
      <label v-else-if="work.kind === 'material'" class="form-field flex flex-col text-left">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >材料分类</span
        >
        <Select
          v-model="materialCategory"
          size="large"
          class="w-full custom-dialog-input"
          placeholder="选择分类"
        >
          <SelectOption
            v-for="category in materialCategories"
            :key="category"
            :label="category"
            :value="category"
          />
        </Select>
      </label>
      <label
        v-else-if="work.kind === 'plugin' || work.kind === 'software'"
        class="form-field flex flex-col text-left"
      >
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >{{ work.kind === 'plugin' ? '插件分类' : '软件分类' }}</span
        >
        <Select
          v-model="pluginCategory"
          size="large"
          class="w-full custom-dialog-input"
          placeholder="选择分类"
        >
          <SelectOption
            v-for="category in work.kind === 'plugin'
              ? pluginCategories
              : systemStore.settings.SOFTWARE_CATEGORIES || fallbackSoftwareCategories"
            :key="category"
            :label="category"
            :value="category"
          />
        </Select>
      </label>
      <div class="flex flex-col text-left">
        <div class="flex items-center justify-between mb-2 ml-1">
          <span
            class="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
            >封面图</span
          >
          <button
            type="button"
            class="inline-flex items-center gap-1 text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer border-none bg-transparent"
            @click="emit('open-ai-cover')"
          >
            <Sparkles class="w-3 h-3 text-violet-400" /> AI 生成封面
          </button>
        </div>
        <FileDropZone
          v-model="form.thumbnail"
          accept="image/*"
          height-class="h-16"
          :progress="thumbnailProgress"
          :preview-url="work?.thumbnail"
          :label="form.thumbnail ? form.thumbnail.name : '重新上传可选预览图'"
          @change="emit('thumbnail-change', $event)"
        />
      </div>
    </div>
    <!-- MATERIAL specifications -->
    <div v-if="work.kind === 'material'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label class="form-field flex flex-col text-left">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >分辨率</span
        >
        <Select v-model="resolution" size="large" class="w-full custom-dialog-input">
          <SelectOption value="2K" label="2K" /> <SelectOption value="4K" label="4K" />
          <SelectOption value="8K" label="8K" /> <SelectOption value="矢量" label="矢量" />
          <SelectOption value="程序化" label="程序化" />
        </Select>
      </label>
      <div class="flex items-center pt-6 pl-1">
        <Checkbox v-model="isProcedural">程序化材质</Checkbox>
      </div>
    </div>
    <!-- PLUGIN specifications -->
    <div
      v-if="work.kind === 'plugin' || work.kind === 'software'"
      class="grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <div class="flex flex-col text-left col-span-1">
        <div
          v-if="existingVersions.length > 0 && !isAddingNewVersion"
          class="form-field flex flex-col text-left"
        >
          <div class="flex justify-between items-center mb-2">
            <span
              class="block text-xs font-bold uppercase tracking-wider ml-1 text-[var(--text-secondary)]"
              >版本</span
            >
            <button
              type="button"
              class="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
              @click="emit('switch-version-mode', 'new')"
            >
              输入新版本
            </button>
          </div>
          <Select
            v-model="pluginVersion"
            size="large"
            class="w-full custom-dialog-input"
            placeholder="选择已发布版本"
          >
            <SelectOption
              v-for="v in existingVersions"
              :key="v.id"
              :label="v.version"
              :value="v.version"
            />
          </Select>
        </div>
        <div v-else class="form-field flex flex-col text-left">
          <div class="flex justify-between items-center mb-2">
            <span
              class="block text-xs font-bold uppercase tracking-wider ml-1 text-[var(--text-secondary)]"
              >版本</span
            >
            <button
              v-if="existingVersions.length > 0"
              type="button"
              class="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
              @click="emit('switch-version-mode', 'existing')"
            >
              选择已发布版本
            </button>
          </div>
          <Input v-model="pluginVersion" type="text" placeholder="例如: 1.0.0" />
        </div>
      </div>
      <div class="flex flex-col text-left col-span-1">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >兼容版本</span
        >
        <Select
          v-model="pluginCompatibility"
          filterable
          allow-create
          default-first-option
          placeholder="选择或输入兼容版本"
          class="w-full custom-dialog-input"
          size="large"
        >
          <SelectOption
            v-for="ver in work.kind === 'plugin' ? BLENDER_VERSIONS : softwareCompatibilityOptions"
            :key="ver"
            :label="ver"
            :value="ver"
          />
        </Select>
      </div>
    </div>
    <!-- Tags -->
    <div><Input v-model="tags" type="text" label="标签" placeholder="用逗号分隔多个标签" /></div>
  </div>
</template>
<style scoped>
.form-field,
.file-picker {
  position: relative;
  display: grid;
  gap: 4px;
}
.form-field > span,
.file-picker > span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}
.form-field select {
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 0 10px;
  font-size: 12px;
}
</style>
