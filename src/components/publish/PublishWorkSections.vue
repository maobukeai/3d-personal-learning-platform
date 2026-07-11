<script setup lang="ts">
import AssetPublishSection from './AssetPublishSection.vue';
import PluginPublishSection from './PluginPublishSection.vue';
import MaterialPublishSection from './MaterialPublishSection.vue';
import type { FlattenedNode } from '@/utils/zipHelper';
import type {
  AssetCategory,
  PublishCategory,
  PublishForm,
} from './publishWorkSchema'; /** * Dispatcher for the three category-specific publish form sections. * The host dialog passes the shared form + section state; this component * forwards everything to the active category section and re-emits actions. */
const form = defineModel<PublishForm>('form', { required: true });
defineProps<{
  category: PublishCategory;
  assetCategories: AssetCategory[];
  materialCategories: string[];
  pluginCategories: string[];
  softwareCategories: string[];
  blenderVersions: string[];
  softwareCompatibilityOptions: string[];
  resolutionOptions: string[];
  isMobile: boolean;
  assetUploadProgress: number | null;
  pluginUploadProgress: number | null;
  pluginPreviewUploadProgress: number | null;
  materialUploadProgress: number | null;
  thumbnailUploadProgress: number | null;
  isParsingZip: boolean;
  parsedFileTree: FlattenedNode[];
  visibleFileNodes: FlattenedNode[];
  expandedFolders: Set<string>;
  activeSection: 'copyright' | 'specs' | null;
}>();
const emit = defineEmits<{
  (e: 'asset-file-change', event: Event): void;
  (e: 'plugin-file-change', event: Event): void;
  (e: 'plugin-preview-change', event: Event): void;
  (e: 'material-file-change', event: Event): void;
  (e: 'thumbnail-change', event: Event): void;
  (e: 'toggle-folder', path: string): void;
  (e: 'toggle-section', section: 'copyright' | 'specs'): void;
  (e: 'toggle-pbr', map: string): void;
  (e: 'open-ai-cover', target: 'thumbnail' | 'pluginPreview'): void;
}>();
</script>
<template>
  <AssetPublishSection
    v-if="category === 'asset'"
    v-model:form="form"
    :asset-categories="assetCategories"
    :is-mobile="isMobile"
    :asset-upload-progress="assetUploadProgress"
    :thumbnail-upload-progress="thumbnailUploadProgress"
    :is-parsing-zip="isParsingZip"
    :parsed-file-tree="parsedFileTree"
    :visible-file-nodes="visibleFileNodes"
    :expanded-folders="expandedFolders"
    :active-section="activeSection"
    @asset-file-change="emit('asset-file-change', $event)"
    @thumbnail-change="emit('thumbnail-change', $event)"
    @toggle-folder="emit('toggle-folder', $event)"
    @toggle-section="emit('toggle-section', $event)"
    @toggle-pbr="emit('toggle-pbr', $event)"
    @open-ai-cover="emit('open-ai-cover', $event)"
  />
  <PluginPublishSection
    v-else-if="category === 'plugin' || category === 'software'"
    v-model:form="form"
    :category="category"
    :plugin-categories="pluginCategories"
    :software-categories="softwareCategories"
    :blender-versions="blenderVersions"
    :software-compatibility-options="softwareCompatibilityOptions"
    :is-mobile="isMobile"
    :plugin-upload-progress="pluginUploadProgress"
    :plugin-preview-upload-progress="pluginPreviewUploadProgress"
    :is-parsing-zip="isParsingZip"
    :parsed-file-tree="parsedFileTree"
    :visible-file-nodes="visibleFileNodes"
    :expanded-folders="expandedFolders"
    :active-section="activeSection"
    @plugin-file-change="emit('plugin-file-change', $event)"
    @plugin-preview-change="emit('plugin-preview-change', $event)"
    @toggle-folder="emit('toggle-folder', $event)"
    @toggle-section="emit('toggle-section', $event)"
    @toggle-pbr="emit('toggle-pbr', $event)"
    @open-ai-cover="emit('open-ai-cover', $event)"
  />
  <MaterialPublishSection
    v-else-if="category === 'material'"
    v-model:form="form"
    :material-categories="materialCategories"
    :resolution-options="resolutionOptions"
    :is-mobile="isMobile"
    :material-upload-progress="materialUploadProgress"
    :thumbnail-upload-progress="thumbnailUploadProgress"
    :is-parsing-zip="isParsingZip"
    :parsed-file-tree="parsedFileTree"
    :visible-file-nodes="visibleFileNodes"
    :expanded-folders="expandedFolders"
    :active-section="activeSection"
    @material-file-change="emit('material-file-change', $event)"
    @thumbnail-change="emit('thumbnail-change', $event)"
    @toggle-folder="emit('toggle-folder', $event)"
    @toggle-section="emit('toggle-section', $event)"
    @toggle-pbr="emit('toggle-pbr', $event)"
    @open-ai-cover="emit('open-ai-cover', $event)"
  />
</template>
