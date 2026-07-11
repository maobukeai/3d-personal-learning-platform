<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import DownloadTypeSegment from '@/components/DownloadTypeSegment.vue';
import ZipFileTreeViewer from '@/components/ZipFileTreeViewer.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import CopyrightSpecsCard from './CopyrightSpecsCard.vue';
import type { FlattenedNode } from '@/utils/zipHelper';
import type { AssetCategory, PublishForm } from './publishWorkSchema';
const MarkdownEditor = defineAsyncComponent(
  () => import('@/components/MarkdownEditor.vue'),
); /** Asset (3D model) publish form. Extracted verbatim from PublishWorkDialog. */
const form = defineModel<PublishForm>('form', { required: true });
defineProps<{
  assetCategories: AssetCategory[];
  isMobile: boolean;
  assetUploadProgress: number | null;
  thumbnailUploadProgress: number | null;
  isParsingZip: boolean;
  parsedFileTree: FlattenedNode[];
  visibleFileNodes: FlattenedNode[];
  expandedFolders: Set<string>;
  activeSection: 'copyright' | 'specs' | null;
}>();
const emit = defineEmits<{
  (e: 'asset-file-change', event: Event): void;
  (e: 'thumbnail-change', event: Event): void;
  (e: 'toggle-folder', path: string): void;
  (e: 'toggle-section', section: 'copyright' | 'specs'): void;
  (e: 'toggle-pbr', map: string): void;
  (e: 'open-ai-cover', target: 'thumbnail' | 'pluginPreview'): void;
}>();
const { t } = useI18n();
</script>
<template>
  <div class="space-y-4">
    <!-- Top Row: Form Inputs (Left) and Description (Right) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <!-- Left Column Inputs -->
      <div class="space-y-2.5">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
            >{{ t('publishDialog.assetFileLabel') }}</label
          >
          <DownloadTypeSegment
            v-model:download-type="form.downloadType"
            v-model:file="form.assetFile"
            v-model:external-url="form.externalUrl"
            v-model:extraction-code="form.extractionCode"
            :progress="assetUploadProgress"
            accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.blend,.usdz,.abc,.zip"
            :drag-label="t('publishDialog.dragAssetFile')"
            :supported-label="t('publishDialog.supportedAssetFiles')"
            @change="emit('asset-file-change', $event)"
          />
          <ZipFileTreeViewer
            :file="form.assetFile"
            :is-parsing-zip="isParsingZip"
            :parsed-file-tree="parsedFileTree"
            :visible-file-nodes="visibleFileNodes"
            :expanded-folders="expandedFolders"
            @toggle="emit('toggle-folder', $event)"
          />
        </div>
        <div>
          <Input
            v-model="form.title"
            type="text"
            :label="t('publishDialog.titleLabel')"
            :placeholder="t('publishDialog.titlePlaceholder')"
            required
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >{{ t('publishDialog.categoryLabel') }}</label
            >
            <Select
              v-model="form.assetCategory"
              :placeholder="t('publishDialog.selectCategoryPlaceholder')"
              class="w-full custom-select-v2"
            >
              <SelectOption
                v-for="cat in assetCategories"
                :key="cat.id"
                :label="cat.name"
                :value="cat.id"
              />
            </Select>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1.5 ml-1">
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400"
                >{{ t('publishDialog.thumbnailOptionalLabel') }}</label
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
        </div>
        <div>
          <Input
            v-model="form.tags"
            type="text"
            :label="t('publishDialog.tagsLabel')"
            :placeholder="t('publishDialog.tagsCommaPlaceholder')"
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
          >{{ t('publishDialog.descriptionLabel') }}</label
        >
        <MarkdownEditor
          v-model="form.description"
          :placeholder="t('publishDialog.descriptionPlaceholder')"
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
