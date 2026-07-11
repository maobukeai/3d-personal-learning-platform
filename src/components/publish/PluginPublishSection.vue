<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import DownloadTypeSegment from '@/components/DownloadTypeSegment.vue';
import ZipFileTreeViewer from '@/components/ZipFileTreeViewer.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import CopyrightSpecsCard from './CopyrightSpecsCard.vue';
import type { FlattenedNode } from '@/utils/zipHelper';
import type { PublishForm } from './publishWorkSchema';
const MarkdownEditor = defineAsyncComponent(
  () => import('@/components/MarkdownEditor.vue'),
); /** Plugin / Software publish form. Extracted verbatim from PublishWorkDialog. */
const form = defineModel<PublishForm>('form', { required: true });
const props = defineProps<{
  category: 'plugin' | 'software';
  pluginCategories: string[];
  softwareCategories: string[];
  blenderVersions: string[];
  softwareCompatibilityOptions: string[];
  isMobile: boolean;
  pluginUploadProgress: number | null;
  pluginPreviewUploadProgress: number | null;
  isParsingZip: boolean;
  parsedFileTree: FlattenedNode[];
  visibleFileNodes: FlattenedNode[];
  expandedFolders: Set<string>;
  activeSection: 'copyright' | 'specs' | null;
}>();
const emit = defineEmits<{
  (e: 'plugin-file-change', event: Event): void;
  (e: 'plugin-preview-change', event: Event): void;
  (e: 'toggle-folder', path: string): void;
  (e: 'toggle-section', section: 'copyright' | 'specs'): void;
  (e: 'toggle-pbr', map: string): void;
  (e: 'open-ai-cover', target: 'thumbnail' | 'pluginPreview'): void;
}>();
const isPlugin = computed(() => props.category === 'plugin');
const fileLabel = computed(() => (isPlugin.value ? '插件文件 *' : '软件文件 *'));
const namePlaceholder = computed(() =>
  isPlugin.value ? '如：材质批量导出工具' : '如：Blender 官方正式版',
);
const categoryLabel = computed(() => (isPlugin.value ? '插件分类' : '软件分类'));
const categoryPlaceholder = computed(() => (isPlugin.value ? '请选择插件分类' : '请选择软件分类'));
const descriptionLabel = computed(() => (isPlugin.value ? '插件简介' : '软件简介'));
const descriptionPlaceholder = computed(() =>
  isPlugin.value ? '简单描述插件的功能和用途' : '简单描述软件的功能和用途',
);
const accept = computed(() =>
  isPlugin.value
    ? '.zip,.rar,.7z,.blend,.js,.ts,.py,.lua,.mjs'
    : '.exe,.msi,.dmg,.pkg,.deb,.rpm,.zip,.rar,.7z',
);
const supportedLabel = computed(() =>
  isPlugin.value ? '.zip .blend .js .ts .py 等格式' : '.exe .msi .dmg .zip 等安装包或压缩包',
);
const dragLabel = computed(() =>
  isPlugin.value ? '点击或拖拽上传插件文件' : '点击或拖拽上传软件文件',
);
const categoryOptions = computed(() =>
  isPlugin.value ? props.pluginCategories : props.softwareCategories,
);
const compatibilityOptions = computed(() =>
  isPlugin.value ? props.blenderVersions : props.softwareCompatibilityOptions,
);
</script>
<template>
  <div class="space-y-4">
    <!-- Top Row: Form Inputs (Left) and Description (Right) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <div class="space-y-2.5">
        <!-- Plugin file upload -->
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
            >{{ fileLabel }}</label
          >
          <DownloadTypeSegment
            v-model:download-type="form.downloadType"
            v-model:file="form.pluginFile"
            v-model:external-url="form.externalUrl"
            v-model:extraction-code="form.extractionCode"
            :progress="pluginUploadProgress"
            :accept="accept"
            :supported-label="supportedLabel"
            :drag-label="dragLabel"
            @change="emit('plugin-file-change', $event)"
          />
          <!-- ZIP File Explorer / Package Contents Preview (Plugin) -->
          <ZipFileTreeViewer
            :file="form.pluginFile"
            :is-parsing-zip="isParsingZip"
            :parsed-file-tree="parsedFileTree"
            :visible-file-nodes="visibleFileNodes"
            :expanded-folders="expandedFolders"
            @toggle="emit('toggle-folder', $event)"
          />
        </div>
        <!-- Plugin name -->
        <div>
          <Input
            v-model="form.title"
            type="text"
            :label="isPlugin ? '插件名称' : '软件名称'"
            :placeholder="namePlaceholder"
            required
          />
        </div>
        <!-- Category & Version -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col">
            <span
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
              >{{ categoryLabel }}</span
            >
            <Select
              v-model="form.pluginCategory"
              :placeholder="categoryPlaceholder"
              class="w-full custom-select-v2"
            >
              <SelectOption v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
            </Select>
          </div>
          <div>
            <Input v-model="form.pluginVersion" type="text" label="版本号" placeholder="1.0.0" />
          </div>
        </div>
        <!-- Compatibility & Tags -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col">
            <span
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
              >兼容性</span
            >
            <Select
              v-model="form.pluginCompatibility"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入兼容版本"
              class="w-full custom-select-v2"
            >
              <SelectOption
                v-for="ver in compatibilityOptions"
                :key="ver"
                :label="ver"
                :value="ver"
              />
            </Select>
          </div>
          <div>
            <Input
              v-model="form.tags"
              type="text"
              label="标签"
              placeholder="用逗号分隔，如：Blender, 材质"
            />
          </div>
        </div>
        <!-- Preview image -->
        <div>
          <div class="flex items-center justify-between mb-1 ml-1">
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400"
              >封面图（可选）</label
            >
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer border-none bg-transparent"
              @click="emit('open-ai-cover', 'pluginPreview')"
            >
              <Sparkles class="w-3 h-3 text-violet-400" /> AI 生成封面
            </button>
          </div>
          <FileDropZone
            v-model="form.pluginPreview"
            accept="image/*"
            height-class="h-16"
            hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
            :progress="pluginPreviewUploadProgress"
            :label="form.pluginPreview ? form.pluginPreview.name : '点击上传封面图'"
            @change="emit('plugin-preview-change', $event)"
          />
        </div>
        <!-- B站视频或分享链接 -->
        <div>
          <Input
            v-model="form.bilibiliUrl"
            type="text"
            label="B站分享视频或主页链接（可选）"
            placeholder="如：https://www.bilibili.com/video/BV1xx... 或个人主页"
          />
        </div>
      </div>
      <!-- Right Column Description -->
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
          >{{ descriptionLabel }}</label
        >
        <MarkdownEditor
          v-model="form.description"
          :placeholder="descriptionPlaceholder"
          :height="isMobile ? '300px' : '400px'"
          simple
        />
      </div>
    </div>
    <!-- Bottom Row: Copyright & Tech Specs Cards -->
    <CopyrightSpecsCard
      v-model:form="form"
      :active-section="activeSection"
      @toggle-section="emit('toggle-section', $event)"
      @toggle-pbr="emit('toggle-pbr', $event)"
    />
  </div>
</template>
