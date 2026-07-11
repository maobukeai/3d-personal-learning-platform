<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import DownloadTypeSegment from '@/components/DownloadTypeSegment.vue';
import ZipFileTreeViewer from '@/components/ZipFileTreeViewer.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import CopyrightSpecsCard from './CopyrightSpecsCard.vue';
import type { FlattenedNode } from '@/utils/zipHelper';
import type { PublishForm } from './publishWorkSchema';
const MarkdownEditor = defineAsyncComponent(
  () => import('@/components/MarkdownEditor.vue'),
); /** Material publish form. Extracted verbatim from PublishWorkDialog. */
const form = defineModel<PublishForm>('form', { required: true });
defineProps<{
  materialCategories: string[];
  resolutionOptions: string[];
  isMobile: boolean;
  materialUploadProgress: number | null;
  thumbnailUploadProgress: number | null;
  isParsingZip: boolean;
  parsedFileTree: FlattenedNode[];
  visibleFileNodes: FlattenedNode[];
  expandedFolders: Set<string>;
  activeSection: 'copyright' | 'specs' | null;
}>();
const emit = defineEmits<{
  (e: 'material-file-change', event: Event): void;
  (e: 'thumbnail-change', event: Event): void;
  (e: 'toggle-folder', path: string): void;
  (e: 'toggle-section', section: 'copyright' | 'specs'): void;
  (e: 'toggle-pbr', map: string): void;
  (e: 'open-ai-cover', target: 'thumbnail' | 'pluginPreview'): void;
}>();
</script>
<template>
  <div class="space-y-4">
    <!-- Top Row: Form Inputs (Left) and Description (Right) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <div class="space-y-2.5">
        <!-- Material file upload -->
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
            >材质包文件 *</label
          >
          <DownloadTypeSegment
            v-model:download-type="form.downloadType"
            v-model:file="form.materialFile"
            v-model:external-url="form.externalUrl"
            v-model:extraction-code="form.extractionCode"
            :progress="materialUploadProgress"
            accept=".zip,.sbsar"
            supported-label="支持 .zip .sbsar 格式"
            @change="emit('material-file-change', $event)"
          />
          <ZipFileTreeViewer
            :file="form.materialFile"
            :is-parsing-zip="isParsingZip"
            :parsed-file-tree="parsedFileTree"
            :visible-file-nodes="visibleFileNodes"
            :expanded-folders="expandedFolders"
            @toggle="emit('toggle-folder', $event)"
          />
        </div>
        <!-- Material name -->
        <div>
          <Input
            v-model="form.title"
            type="text"
            label="材质名称"
            placeholder="如：磨砂金属 PBR 套装"
            required
          />
        </div>
        <!-- Category & Resolution -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col">
            <span
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
              >材质分类</span
            >
            <Select
              v-model="form.materialCategory"
              placeholder="请选择材质分类"
              class="w-full custom-select-v2"
            >
              <SelectOption
                v-for="cat in materialCategories"
                :key="cat"
                :label="cat"
                :value="cat"
              />
            </Select>
          </div>
          <div class="flex flex-col">
            <span
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
              >材质分辨率</span
            >
            <Select
              v-model="form.materialResolution"
              placeholder="请选择分辨率"
              class="w-full custom-select-v2"
            >
              <SelectOption v-for="res in resolutionOptions" :key="res" :label="res" :value="res" />
            </Select>
          </div>
        </div>
        <!-- Procedural Switch -->
        <div class="flex items-center gap-3 py-0.5">
          <Switch v-model="form.materialIsProcedural" active-color="var(--accent)" />
          <span class="text-xs font-bold text-slate-400">程序化材质 / SBSAR</span>
        </div>
        <!-- Preview image (Cover) -->
        <div>
          <div class="flex items-center justify-between mb-1 ml-1">
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400"
              >封面图（可选）</label
            >
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer border-none bg-transparent"
              @click="emit('open-ai-cover', 'thumbnail')"
            >
              <Sparkles class="w-3 h-3 text-violet-400" /> AI 生成封面
            </button>
          </div>
          <FileDropZone
            v-model="form.thumbnail"
            accept="image/*"
            height-class="h-16"
            hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
            :progress="thumbnailUploadProgress"
            :label="form.thumbnail ? form.thumbnail.name : '点击上传封面图'"
            @change="emit('thumbnail-change', $event)"
          />
        </div>
        <!-- Tags -->
        <div>
          <Input
            v-model="form.tags"
            type="text"
            label="标签"
            placeholder="用逗号分隔，如：PBR, 金属, 4K, 游戏资产"
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
          >材质说明</label
        >
        <MarkdownEditor
          v-model="form.description"
          placeholder="贴图通道、使用场景、授权或引擎导入注意事项... 支持 Markdown 格式"
          :height="isMobile ? '280px' : '340px'"
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
