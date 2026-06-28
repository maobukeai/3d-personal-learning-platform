<script setup lang="ts">
import { getApiErrorMessage, logError } from '@/utils/error';
import { computed, ref, onMounted, watch, defineAsyncComponent } from 'vue';
import {
  UploadCloud,
  Layers,
  Puzzle,
  FileArchive,
  FolderOpen,
  Folder,
  RefreshCw,
  FileText,
  Box,
  Image as ImageIcon,
  Shield,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-vue-next';
import { parseZipFileNames, buildFileTree, flattenFileTree } from '@/utils/zipHelper';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useI18n } from 'vue-i18n';
import { useMobile } from '@/composables/useMobile';
import { useSystemStore } from '@/stores/system';
import FileDropZone from '@/components/FileDropZone.vue';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import { useLabel } from '@/utils/i18n';
import {
  ASSET_ORIGINALITY_OPTIONS,
  ASSET_LICENSE_OPTIONS,
  ASSET_MESHTYPE_OPTIONS,
  ASSET_PBR_MAPS_OPTIONS,
} from '@/views/Assets/assetLibraryModel';

const { t } = useI18n();

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

type PublishCategory = 'asset' | 'material' | 'plugin';

interface InitialPublishData {
  title?: string;
  description?: string;
  tags?: string;
  thumbnail?: File | null;
  assetFile?: File | null;
  assetCategory?: string;
  pluginFile?: File | null;
  pluginPreview?: File | null;
  pluginCategory?: string;
  pluginVersion?: string;
  pluginCompatibility?: string;
  pluginInstallGuide?: string;
  bilibiliUrl?: string;
  materialFile?: File | null;
  materialCategory?: string;
  materialResolution?: string;
  materialIsProcedural?: boolean;
}

const props = defineProps<{
  modelValue: boolean;
  defaultCategory?: string; // Accept any category string from legacy references and gracefully fallback
  initialData?: InitialPublishData;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'published'): void;
}>();

interface AssetCategory {
  id: string;
  name: string;
}

const isPublishing = ref(false);
const publishCategory = ref<PublishCategory>('asset');
const assetCategories = ref<AssetCategory[]>([]);
const { isMobile } = useMobile();
const systemStore = useSystemStore();

const activeCategoryLabel = computed(() => {
  switch (publishCategory.value) {
    case 'asset':
      return t('publishDialog.uploadModel') || '上传3D模型';
    case 'material':
      return t('publishDialog.uploadMaterial') || '上传材质';
    case 'plugin':
      return t('publishDialog.uploadPlugin') || '上传插件';
    default:
      return '';
  }
});

const categoryTabs = computed(() => [
  { value: 'asset', label: t('publishDialog.uploadModel') || '上传3D模型', icon: UploadCloud },
  { value: 'material', label: t('publishDialog.uploadMaterial') || '上传材质', icon: Layers },
  { value: 'plugin', label: t('publishDialog.uploadPlugin') || '上传插件', icon: Puzzle },
]);

const publishForm = ref({
  title: '',
  description: '',
  tags: '',
  thumbnail: null as File | null,
  // Asset
  assetFile: null as File | null,
  assetCategory: '',
  // Plugin
  pluginFile: null as File | null,
  pluginPreview: null as File | null,
  pluginCategory: '其他工具',
  pluginVersion: '1.0.0',
  pluginCompatibility: '',
  pluginInstallGuide: '',
  bilibiliUrl: '',
  // Material
  materialFile: null as File | null,
  materialCategory: '',
  materialResolution: '4K',
  materialIsProcedural: false,
  // Copyright & Tech Specs fields
  originality: '',
  originalAuthor: '',
  originalLink: '',
  license: '',
  isFree: null as boolean | null,
  meshType: '',
  uvUnwrapped: false,
  uvOverlapping: false,
  pbrChannels: [] as string[],
  rigged: false,
  gameReady: false,
});

const label = useLabel();
const activeSection = ref<'copyright' | 'specs' | null>(null);
const toggleSection = (section: 'copyright' | 'specs') => {
  activeSection.value = activeSection.value === section ? null : section;
};
const togglePbrChannel = (map: string) => {
  if (!publishForm.value.pbrChannels) publishForm.value.pbrChannels = [];
  const idx = publishForm.value.pbrChannels.indexOf(map);
  if (idx >= 0) {
    publishForm.value.pbrChannels.splice(idx, 1);
  } else {
    publishForm.value.pbrChannels.push(map);
  }
};

const packageFileList = ref<string[]>([]);
const isParsingZip = ref(false);
const expandedFolders = ref<Set<string>>(new Set());

const activeUploadFile = computed(() => {
  if (publishCategory.value === 'asset') return publishForm.value.assetFile;
  if (publishCategory.value === 'material') return publishForm.value.materialFile;
  if (publishCategory.value === 'plugin') return publishForm.value.pluginFile;
  return null;
});

const parsedFileTree = computed(() => {
  if (!activeUploadFile.value) return [];
  if (packageFileList.value.length > 0) {
    const tree = buildFileTree(packageFileList.value);
    return flattenFileTree(tree);
  }
  return [{
    name: activeUploadFile.value.name,
    path: activeUploadFile.value.name,
    isFolder: false,
    level: 0,
  }];
});

const toggleFolder = (path: string) => {
  if (expandedFolders.value.has(path)) {
    expandedFolders.value.delete(path);
  } else {
    expandedFolders.value.add(path);
  }
};

const visibleFileNodes = computed(() => {
  return parsedFileTree.value.filter(node => {
    const parts = node.path.split('/');
    if (parts.length <= 1) return true;
    let parentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      parentPath = parentPath ? `${parentPath}/${parts[i]}` : parts[i];
      if (!expandedFolders.value.has(parentPath)) {
        return false;
      }
    }
    return true;
  });
});

watch(activeUploadFile, async (newFile) => {
  expandedFolders.value.clear();
  if (!newFile) {
    packageFileList.value = [];
    return;
  }
  const isZip = newFile.name.toLowerCase().endsWith('.zip');
  if (isZip) {
    isParsingZip.value = true;
    try {
      const list = await parseZipFileNames(newFile);
      packageFileList.value = list;
    } catch (err) {
      logError('Error parsing zip file in publish dialog:', err);
      packageFileList.value = [];
    } finally {
      isParsingZip.value = false;
    }
  } else {
    packageFileList.value = [];
  }
});

const resolutionOptions = ['2K', '4K', '8K', '矢量', '程序化'];

const materialCategories = computed(() => {
  return (systemStore.settings.MATERIAL_CATEGORIES || []).filter(
    (cat) => cat !== '全部材料' && cat !== '全部',
  );
});

const fetchCategories = async () => {
  try {
    const response = await api.get('/api/assets/categories');
    assetCategories.value = response.data;
  } catch (error) {
    logError(error, { operation: 'publish.fetchCategories', component: 'PublishWorkDialog' });
  }
};

const initDialog = async () => {
  const cat = props.defaultCategory;
  if (cat === 'asset' || cat === 'material' || cat === 'plugin') {
    publishCategory.value = cat;
  } else {
    publishCategory.value = 'asset';
  }
  if (props.initialData) {
    publishForm.value = {
      ...publishForm.value,
      ...props.initialData,
    };
  }
  await Promise.all([fetchCategories(), systemStore.fetchSettings()]);
};

watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      await initDialog();
    }
  },
);

watch(
  () => props.defaultCategory,
  (category) => {
    if (props.modelValue && category) {
      if (category === 'asset' || category === 'material' || category === 'plugin') {
        publishCategory.value = category;
      } else {
        publishCategory.value = 'asset';
      }
    }
  },
);

const handleThumbnailChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.thumbnail = file;
  }
};

const handleAssetFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.assetFile = file;
    if (!publishForm.value.title) {
      publishForm.value.title = file.name.split('.')[0];
    }
  }
};

const handlePluginFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.pluginFile = file;
    if (!publishForm.value.title) {
      publishForm.value.title = file.name.replace(/\.[^.]+$/, '');
    }
  }
};

const handlePluginPreviewChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) publishForm.value.pluginPreview = file;
};

const handleMaterialFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.materialFile = file;
    if (!publishForm.value.title) {
      publishForm.value.title = file.name.replace(/\.[^.]+$/, '');
    }
  }
};

const handlePublish = async () => {
  if (!publishForm.value.title.trim()) {
    ElMessage.warning(t('publishDialog.titleRequired'));
    return;
  }

  isPublishing.value = true;

  try {
    if (publishCategory.value === 'asset') {
      if (!publishForm.value.assetFile) {
        ElMessage.warning(t('publishDialog.modelRequired'));
        isPublishing.value = false;
        return;
      }
      if (!publishForm.value.assetCategory) {
        ElMessage.warning(t('publishDialog.categoryRequired'));
        isPublishing.value = false;
        return;
      }

      const uploadFormData = new FormData();
      uploadFormData.append('asset', publishForm.value.assetFile);
      if (publishForm.value.thumbnail) {
        uploadFormData.append('thumbnail', publishForm.value.thumbnail);
      }
      uploadFormData.append('title', publishForm.value.title);
      uploadFormData.append('description', publishForm.value.description);
      uploadFormData.append('categoryId', publishForm.value.assetCategory);
      uploadFormData.append('originality', publishForm.value.originality || '');
      uploadFormData.append('originalAuthor', publishForm.value.originalAuthor || '');
      uploadFormData.append('originalLink', publishForm.value.originalLink || '');
      uploadFormData.append('license', publishForm.value.license || '');
      uploadFormData.append('isFree', publishForm.value.isFree === null || publishForm.value.isFree === undefined ? '' : String(publishForm.value.isFree));
      uploadFormData.append('meshType', publishForm.value.meshType || '');
      uploadFormData.append('uvUnwrapped', String(publishForm.value.uvUnwrapped ?? false));
      uploadFormData.append('uvOverlapping', String(publishForm.value.uvOverlapping ?? false));
      uploadFormData.append('pbrChannels', JSON.stringify(publishForm.value.pbrChannels || []));
      uploadFormData.append('rigged', String(publishForm.value.rigged ?? false));
      uploadFormData.append('gameReady', String(publishForm.value.gameReady ?? false));

      await api.post('/api/assets/upload', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (publishCategory.value === 'plugin') {
      if (!publishForm.value.pluginFile) {
        ElMessage.warning(t('publishDialog.pluginRequired') || '请上传插件文件');
        isPublishing.value = false;
        return;
      }
      if (!publishForm.value.title.trim()) {
        ElMessage.warning('请填写插件名称');
        isPublishing.value = false;
        return;
      }
      const pluginFormData = new FormData();
      pluginFormData.append('plugin_file', publishForm.value.pluginFile);
      if (publishForm.value.pluginPreview) {
        pluginFormData.append('plugin_preview', publishForm.value.pluginPreview);
      }
      pluginFormData.append('title', publishForm.value.title);
      pluginFormData.append('description', publishForm.value.description);
      pluginFormData.append('category', publishForm.value.pluginCategory);
      pluginFormData.append('version', publishForm.value.pluginVersion);
      pluginFormData.append('compatibility', publishForm.value.pluginCompatibility);
      pluginFormData.append('tags', publishForm.value.tags);
      pluginFormData.append('installGuide', '');
      if (publishForm.value.bilibiliUrl) {
        pluginFormData.append('bilibiliUrl', publishForm.value.bilibiliUrl);
      }
      await api.post('/api/plugins/upload', pluginFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (publishCategory.value === 'material') {
      if (!publishForm.value.materialFile) {
        ElMessage.warning(t('publishDialog.materialRequired') || '请上传材质包文件');
        isPublishing.value = false;
        return;
      }
      if (!publishForm.value.materialCategory) {
        ElMessage.warning('请选择材质分类');
        isPublishing.value = false;
        return;
      }

      const materialFormData = new FormData();
      materialFormData.append('material', publishForm.value.materialFile);
      if (publishForm.value.thumbnail) {
        materialFormData.append('preview', publishForm.value.thumbnail);
      }
      materialFormData.append('title', publishForm.value.title);
      materialFormData.append('description', publishForm.value.description);
      materialFormData.append('category', publishForm.value.materialCategory);
      materialFormData.append('resolution', publishForm.value.materialResolution);
      materialFormData.append('isProcedural', String(publishForm.value.materialIsProcedural));
      materialFormData.append('tags', publishForm.value.tags);
      materialFormData.append('originality', 'ORIGINAL');
      materialFormData.append('license', 'CC_BY');
      materialFormData.append('isFree', 'true');

      await api.post('/api/materials/upload', materialFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }

    ElMessage.success(t('publishDialog.publishSuccess') || '发布成功');
    closeDialog();
    emit('published');
  } catch (error) {
    const msg = getApiErrorMessage(error, t('publishDialog.publishFailed') || '发布失败');
    ElMessage.error(msg);
  } finally {
    isPublishing.value = false;
  }
};

const closeDialog = () => {
  emit('update:modelValue', false);
  // Reset form
  publishForm.value = {
    title: '',
    description: '',
    tags: '',
    thumbnail: null,
    assetFile: null,
    assetCategory: '',
    pluginFile: null,
    pluginPreview: null,
    pluginCategory: '其他工具',
    pluginVersion: '1.0.0',
    pluginCompatibility: '',
    pluginInstallGuide: '',
    bilibiliUrl: '',
    materialFile: null,
    materialCategory: '',
    materialResolution: '4K',
    materialIsProcedural: false,
  };
  publishCategory.value = 'asset';
};

onMounted(() => {
  if (props.modelValue) {
    initDialog();
  }
});
</script>

<template>
  <Modal :show="modelValue" size="xxl" glass-card @close="closeDialog">
    <template #header>
      <div>
        <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
          {{ t('publishDialog.title') }}
        </h3>
        <p class="text-xs text-[var(--text-muted)] mt-1">
          {{ activeCategoryLabel }}
        </p>
      </div>
    </template>

    <!-- Category Tabs -->
    <div class="mb-3 flex justify-center">
      <Tabs v-model="publishCategory" :options="categoryTabs" size="sm" />
    </div>

    <!-- Asset Category: Upload a new 3D model file -->
    <template v-if="publishCategory === 'asset'">
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
              <FileDropZone
                v-model="publishForm.assetFile"
                accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.blend,.usdz,.abc,.zip"
                height-class="h-20"
                :label="
                  publishForm.assetFile
                    ? publishForm.assetFile.name
                    : t('publishDialog.dragAssetFile')
                "
                :sublabel="t('publishDialog.supportedAssetFiles')"
                @change="handleAssetFileChange"
              />

              <!-- ZIP File Explorer / Package Contents Preview (Asset) -->
              <div v-if="publishForm.assetFile" class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left mt-3 shrink-0">
                <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
                  <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    {{ t('publishDialog.packageContents') || '压缩包包含' }}
                    <span v-if="!isParsingZip && parsedFileTree.length > 0">({{ parsedFileTree.length }})</span>
                  </span>
                  <RefreshCw v-if="isParsingZip" class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0" />
                </div>
                <div v-if="isParsingZip" class="p-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>{{ t('publishDialog.readingPackageContents') || '正在读取压缩包目录...' }}</span>
                </div>
                <div v-else-if="parsedFileTree.length > 0" class="p-3 flex flex-col gap-1 max-h-[180px] overflow-y-auto custom-scrollbar text-xs text-[var(--text-secondary)] font-mono">
                  <div 
                    v-for="node in visibleFileNodes" 
                    :key="node.path" 
                    class="flex items-center gap-1.5 py-1 hover:bg-white/[0.03] px-2 rounded transition-colors"
                    :class="{ 'cursor-pointer select-none': node.isFolder }"
                    :style="{ paddingLeft: (node.level * 14 + 6) + 'px' }"
                    @click="node.isFolder ? toggleFolder(node.path) : null"
                  >
                    <component
                      :is="expandedFolders.has(node.path) ? FolderOpen : Folder"
                      v-if="node.isFolder"
                      class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400/80 shrink-0"
                    />
                    <template v-else>
                      <svg v-if="node.name.toLowerCase().endsWith('.blend')" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M66.332 70.032c.24-4.242 2.327-7.987 5.485-10.634 3.094-2.602 7.248-4.193 11.809-4.193 4.537 0 8.69 1.59 11.78 4.193 3.163 2.647 5.237 6.392 5.485 10.634.24 4.35-1.523 8.41-4.605 11.417-3.158 3.05-7.627 4.977-12.66 4.977-5.037 0-9.526-1.915-12.664-4.977-3.094-3.006-4.853-7.044-4.606-11.397zm0 0" fill="#235785"/>
                        <path d="M39.245 79.002c.028 1.66.564 4.89 1.36 7.404 1.682 5.336 4.537 10.273 8.49 14.599 4.062 4.465 9.074 8.055 14.85 10.61 6.073 2.67 12.665 4.037 19.505 4.037 6.84-.009 13.432-1.4 19.504-4.102 5.776-2.582 10.79-6.168 14.85-10.657 3.974-4.374 6.82-9.307 8.491-14.647a37 37 0 001.595-8.163c.208-2.69.12-5.405-.263-8.12a37.535 37.535 0 00-5.417-14.714c-2.574-4.15-5.916-7.76-9.89-10.813l.012-.004-39.955-30.506c-.036-.028-.068-.056-.104-.08-2.619-2.002-7.044-1.994-9.91.008-2.914 2.031-3.25 5.385-.656 7.496l-.012.008 16.682 13.484-50.789.051h-.068c-4.197.004-8.239 2.739-9.03 6.213-.82 3.521 2.035 6.46 6.412 6.46l-.008.016 25.736-.048L4.58 82.524c-.056.044-.12.088-.176.132C.069 85.95-1.33 91.446 1.4 94.9c2.778 3.522 8.666 3.546 13.047.02L39.505 74.51s-.368 2.758-.336 4.397zm64.56 9.219c-5.168 5.228-12.416 8.21-20.227 8.21-7.831.012-15.079-2.918-20.248-8.142-2.526-2.559-4.377-5.473-5.528-8.591a22.202 22.202 0 01-1.271-9.602 22.446 22.446 0 012.778-9.039c1.507-2.714 3.59-5.18 6.14-7.267 5.033-4.058 11.42-6.28 18.1-6.28 6.709-.008 13.097 2.174 18.13 6.236 2.55 2.075 4.625 4.529 6.14 7.243a22.302 22.302 0 012.774 9.043 22.302 22.302 0 01-1.271 9.598c-1.147 3.142-3.002 6.056-5.533 8.615zm0 0" fill="#e87500"/>
                      </svg>
                      <Box v-else-if="node.name.toLowerCase().endsWith('.glb') || node.name.toLowerCase().endsWith('.gltf') || node.name.toLowerCase().endsWith('.fbx') || node.name.toLowerCase().endsWith('.obj')" class="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <ImageIcon v-else-if="node.name.toLowerCase().endsWith('.png') || node.name.toLowerCase().endsWith('.jpg') || node.name.toLowerCase().endsWith('.jpeg') || node.name.toLowerCase().endsWith('.tga') || node.name.toLowerCase().endsWith('.hdr')" class="h-3.5 w-3.5 text-teal-500 shrink-0" />
                      <FileArchive v-else-if="node.name.toLowerCase().endsWith('.zip') || node.name.toLowerCase().endsWith('.rar') || node.name.toLowerCase().endsWith('.7z')" class="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <FileText v-else class="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    </template>
                    <span class="truncate" :class="{ 'text-indigo-600 dark:text-indigo-300 font-semibold': !node.isFolder && (node.name.toLowerCase().endsWith('.glb') || node.name.toLowerCase().endsWith('.gltf') || node.name.toLowerCase().endsWith('.fbx') || node.name.toLowerCase().endsWith('.obj') || node.name.toLowerCase().endsWith('.blend')) }">
                      {{ node.name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Input
                v-model="publishForm.title"
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
                <el-select
                  v-model="publishForm.assetCategory"
                  :placeholder="t('publishDialog.selectCategoryPlaceholder')"
                  class="w-full custom-select-v2"
                >
                  <el-option
                    v-for="cat in assetCategories"
                    :key="cat.id"
                    :label="cat.name"
                    :value="cat.id"
                  />
                </el-select>
              </div>
              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                  >{{ t('publishDialog.thumbnailOptionalLabel') }}</label
                >
                <div class="relative group h-11">
                  <input
                    type="file"
                    accept="image/*"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    @change="handleThumbnailChange"
                  />
                  <div
                    class="w-full h-full border rounded-xl flex items-center justify-center gap-1 transition-all group-hover:border-indigo-500 bg-slate-100 dark:bg-white/5"
                    style="border-color: var(--border-base)"
                  >
                    <p class="text-xs truncate px-2" style="color: var(--text-secondary)">
                      {{
                        publishForm.thumbnail
                          ? publishForm.thumbnail.name
                          : t('publishDialog.uploadPreview')
                      }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Input
                v-model="publishForm.tags"
                type="text"
                :label="t('publishDialog.tagsLabel')"
                :placeholder="t('publishDialog.tagsCommaPlaceholder')"
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
              v-model="publishForm.description"
              :placeholder="t('publishDialog.descriptionPlaceholder')"
              :height="isMobile ? '280px' : '340px'"
              simple
            />
          </div>
        </div>

        <!-- Bottom Row: Horizontally Aligned Copyright & Tech Specs Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <!-- Copyright & License Section (Left) -->
          <div class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all">
            <div
              class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors"
              @click="toggleSection('copyright')"
            >
              <div class="flex items-center gap-2">
                <Shield class="h-4 w-4 text-indigo-500" />
                <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {{ label('版权与许可协议', 'Copyright & Licensing') }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 ml-auto mr-1">
                <span v-if="activeSection !== 'copyright'" class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {{ publishForm.originality ? (publishForm.originality === 'ORIGINAL' ? '原创' : '转载') : '未设置原创' }} · {{ publishForm.license || '未设置协议' }}
                </span>
                <component :is="activeSection === 'copyright' ? ChevronUp : ChevronDown" class="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
              </div>
            </div>
            
            <div v-show="activeSection === 'copyright'" class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4">
              <!-- Originality -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">原创属性</span>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_ORIGINALITY_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.originality === opt.value
                        ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                    ]"
                    @click="publishForm.originality = publishForm.originality === opt.value ? '' : opt.value"
                  >
                    {{ label(opt.label_zh, opt.label_en) }}
                  </button>
                </div>
              </div>

              <div v-if="publishForm.originality && publishForm.originality !== 'ORIGINAL'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all">
                <Input
                  v-model="publishForm.originalAuthor"
                  type="text"
                  :label="label('原作者姓名/署名', 'Original Author')"
                  placeholder="e.g. SketchUp Studio"
                />
                <Input
                  v-model="publishForm.originalLink"
                  type="url"
                  :label="label('原作者作品链接', 'Original URL')"
                  placeholder="https://..."
                />
              </div>

              <!-- License & Download -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">授权许可协议</span>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="opt in ASSET_LICENSE_OPTIONS"
                      :key="opt.value"
                      type="button"
                      :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                        publishForm.license === opt.value
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
                      ]"
                      @click="publishForm.license = publishForm.license === opt.value ? '' : opt.value"
                    >
                      {{ opt.value }}
                    </button>
                  </div>
                </div>

                <div class="flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">下载权限</span>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      :class="[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                        publishForm.isFree === true
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      ]"
                      @click="publishForm.isFree = publishForm.isFree === true ? null : true"
                    >
                      免费下载
                    </button>
                    <button
                      type="button"
                      :class="[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                        publishForm.isFree === false
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      ]"
                      @click="publishForm.isFree = publishForm.isFree === false ? null : false"
                    >
                      VIP 会员专享
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Technical Specs Section (Right) -->
          <div class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all">
            <div
              class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors"
              @click="toggleSection('specs')"
            >
              <div class="flex items-center gap-2">
                <Settings class="h-4 w-4 text-teal-500" />
                <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {{ label('技术参数与规格', 'Technical Specifications') }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 ml-auto mr-1">
                <span v-if="activeSection !== 'specs'" class="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                  {{ publishForm.meshType || '未设置网格' }} · PBR({{ publishForm.pbrChannels?.length || 0 }})
                </span>
                <component :is="activeSection === 'specs' ? ChevronUp : ChevronDown" class="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
              </div>
            </div>

            <div v-show="activeSection === 'specs'" class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4">
              <!-- Mesh Type -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">网格多边形类型</span>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_MESHTYPE_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.meshType === opt.value
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-600 dark:text-teal-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
                    ]"
                    @click="publishForm.meshType = publishForm.meshType === opt.value ? '' : opt.value"
                  >
                    {{ label(opt.label_zh, opt.label_en) }}
                  </button>
                </div>
              </div>

              <!-- UV & Features Toggles -->
              <div class="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.uvUnwrapped
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.uvUnwrapped = !publishForm.uvUnwrapped"
                >
                  <span>已展 UV</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.uvUnwrapped ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.uvOverlapping
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.uvOverlapping = !publishForm.uvOverlapping"
                >
                  <span>UV 重叠</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.uvOverlapping ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.rigged
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.rigged = !publishForm.rigged"
                >
                  <span>骨骼绑定</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.rigged ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.gameReady
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.gameReady = !publishForm.gameReady"
                >
                  <span>游戏引擎就绪</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.gameReady ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>
              </div>

              <!-- PBR Maps fast toggle tags -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">包含 PBR 材质通道</span>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="map in ASSET_PBR_MAPS_OPTIONS"
                    :key="map"
                    type="button"
                    :class="[
                      'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                      publishForm.pbrChannels?.includes(map)
                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-600 dark:text-teal-300 font-semibold shadow-sm scale-105'
                        : 'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-800 text-slate-400 hover:bg-slate-200/50'
                    ]"
                    @click="togglePbrChannel(map)"
                  >
                    <span class="mr-1">{{ publishForm.pbrChannels?.includes(map) ? '✓' : '+' }}</span>{{ map }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Plugin Category: Upload plugin file -->
    <template v-if="publishCategory === 'plugin'">
      <div class="space-y-4">
        <!-- Top Row: Form Inputs (Left) and Description (Right) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div class="space-y-2.5">
            <!-- Plugin file upload -->
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                >插件文件 *</label
              >
              <FileDropZone
                v-model="publishForm.pluginFile"
                accept=".zip,.rar,.7z,.blend,.js,.ts,.py,.lua,.mjs"
                height-class="h-20"
                hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
                icon-type="puzzle"
                :label="publishForm.pluginFile ? publishForm.pluginFile.name : '点击上传插件文件'"
                sublabel=".zip .blend .js .ts .py 等格式"
                @change="handlePluginFileChange"
              />

              <!-- ZIP File Explorer / Package Contents Preview (Plugin) -->
              <div v-if="publishForm.pluginFile" class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left mt-2 shrink-0">
                <div class="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 bg-white/[0.02]">
                  <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    {{ t('publishDialog.packageContents') || '压缩包包含' }}
                    <span v-if="!isParsingZip && parsedFileTree.length > 0">({{ parsedFileTree.length }})</span>
                  </span>
                  <RefreshCw v-if="isParsingZip" class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0" />
                </div>
                <div v-if="isParsingZip" class="p-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>{{ t('publishDialog.readingPackageContents') || '正在读取压缩包目录...' }}</span>
                </div>
                <div v-else-if="parsedFileTree.length > 0" class="p-2.5 flex flex-col gap-1 max-h-[150px] overflow-y-auto custom-scrollbar text-xs text-[var(--text-secondary)] font-mono">
                  <div 
                    v-for="node in visibleFileNodes" 
                    :key="node.path" 
                    class="flex items-center gap-1.5 py-0.5 hover:bg-white/[0.03] px-2 rounded transition-colors"
                    :class="{ 'cursor-pointer select-none': node.isFolder }"
                    :style="{ paddingLeft: (node.level * 14 + 6) + 'px' }"
                    @click="node.isFolder ? toggleFolder(node.path) : null"
                  >
                    <component
                      :is="expandedFolders.has(node.path) ? FolderOpen : Folder"
                      v-if="node.isFolder"
                      class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400/80 shrink-0"
                    />
                    <template v-else>
                      <svg v-if="node.name.toLowerCase().endsWith('.blend')" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M66.332 70.032c.24-4.242 2.327-7.987 5.485-10.634 3.094-2.602 7.248-4.193 11.809-4.193 4.537 0 8.69 1.59 11.78 4.193 3.163 2.647 5.237 6.392 5.485 10.634.24 4.35-1.523 8.41-4.605 11.417-3.158 3.05-7.627 4.977-12.66 4.977-5.037 0-9.526-1.915-12.664-4.977-3.094-3.006-4.853-7.044-4.606-11.397zm0 0" fill="#235785"/>
                        <path d="M39.245 79.002c.028 1.66.564 4.89 1.36 7.404 1.682 5.336 4.537 10.273 8.49 14.599 4.062 4.465 9.074 8.055 14.85 10.61 6.073 2.67 12.665 4.037 19.505 4.037 6.84-.009 13.432-1.4 19.504-4.102 5.776-2.582 10.79-6.168 14.85-10.657 3.974-4.374 6.82-9.307 8.491-14.647a37 37 0 001.595-8.163c.208-2.69.12-5.405-.263-8.12a37.535 37.535 0 00-5.417-14.714c-2.574-4.15-5.916-7.76-9.89-10.813l.012-.004-39.955-30.506c-.036-.028-.068-.056-.104-.08-2.619-2.002-7.044-1.994-9.91.008-2.914 2.031-3.25 5.385-.656 7.496l-.012.008 16.682 13.484-50.789.051h-.068c-4.197.004-8.239 2.739-9.03 6.213-.82 3.521 2.035 6.46 6.412 6.46l-.008.016 25.736-.048L4.58 82.524c-.056.044-.12.088-.176.132C.069 85.95-1.33 91.446 1.4 94.9c2.778 3.522 8.666 3.546 13.047.02L39.505 74.51s-.368 2.758-.336 4.397zm64.56 9.219c-5.168 5.228-12.416 8.21-20.227 8.21-7.831.012-15.079-2.918-20.248-8.142-2.526-2.559-4.377-5.473-5.528-8.591a22.202 22.202 0 01-1.271-9.602 22.446 22.446 0 012.778-9.039c1.507-2.714 3.59-5.18 6.14-7.267 5.033-4.058 11.42-6.28 18.1-6.28 6.709-.008 13.097 2.174 18.13 6.236 2.55 2.075 4.625 4.529 6.14 7.243a22.302 22.302 0 012.774 9.043 22.302 22.302 0 01-1.271 9.598c-1.147 3.142-3.002 6.056-5.533 8.615zm0 0" fill="#e87500"/>
                      </svg>
                      <Box v-else-if="node.name.toLowerCase().endsWith('.glb') || node.name.toLowerCase().endsWith('.gltf') || node.name.toLowerCase().endsWith('.fbx') || node.name.toLowerCase().endsWith('.obj')" class="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <ImageIcon v-else-if="node.name.toLowerCase().endsWith('.png') || node.name.toLowerCase().endsWith('.jpg') || node.name.toLowerCase().endsWith('.jpeg') || node.name.toLowerCase().endsWith('.tga') || node.name.toLowerCase().endsWith('.hdr')" class="h-3.5 w-3.5 text-teal-500 shrink-0" />
                      <FileArchive v-else-if="node.name.toLowerCase().endsWith('.zip') || node.name.toLowerCase().endsWith('.rar') || node.name.toLowerCase().endsWith('.7z')" class="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <FileText v-else class="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    </template>
                    <span class="truncate" :class="{ 'text-indigo-600 dark:text-indigo-300 font-semibold': !node.isFolder && (node.name.toLowerCase().endsWith('.glb') || node.name.toLowerCase().endsWith('.gltf') || node.name.toLowerCase().endsWith('.fbx') || node.name.toLowerCase().endsWith('.obj') || node.name.toLowerCase().endsWith('.blend')) }">
                      {{ node.name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Plugin name -->
            <div>
              <Input
                v-model="publishForm.title"
                type="text"
                label="插件名称"
                placeholder="如：材质批量导出工具"
                required
              />
            </div>

            <!-- Category & Version -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col">
                <span
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                  >插件分类</span
                >
                <el-select
                  v-model="publishForm.pluginCategory"
                  placeholder="请选择插件分类"
                  class="w-full custom-select-v2"
                >
                  <el-option
                    v-for="cat in systemStore.settings.PLUGIN_CATEGORIES"
                    :key="cat"
                    :label="cat"
                    :value="cat"
                  />
                </el-select>
              </div>
              <div>
                <Input
                  v-model="publishForm.pluginVersion"
                  type="text"
                  label="版本号"
                  placeholder="1.0.0"
                />
              </div>
            </div>

            <!-- Compatibility & Tags -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <Input
                  v-model="publishForm.pluginCompatibility"
                  type="text"
                  label="兼容性"
                  placeholder="如 Blender 3.x / 4.x"
                />
              </div>
              <div>
                <Input
                  v-model="publishForm.tags"
                  type="text"
                  label="标签"
                  placeholder="用逗号分隔，如：Blender, 材质"
                />
              </div>
            </div>

            <!-- Preview image -->
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                >封面图（可选）</label
              >
              <FileDropZone
                v-model="publishForm.pluginPreview"
                accept="image/*"
                height-class="h-16"
                hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
                :label="publishForm.pluginPreview ? publishForm.pluginPreview.name : '点击上传封面图'"
                @change="handlePluginPreviewChange"
              />
            </div>

            <!-- B站视频或分享链接 -->
            <div>
              <Input
                v-model="publishForm.bilibiliUrl"
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
              >插件简介</label
            >
            <MarkdownEditor
              v-model="publishForm.description"
              placeholder="简单描述插件的功能和用途"
              :height="isMobile ? '300px' : '400px'"
              simple
            />
          </div>
        </div>

        <!-- Bottom Row: Horizontally Aligned Copyright & Tech Specs Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <!-- Copyright & License Section (Left) -->
          <div class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all">
            <div
              class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors"
              @click="toggleSection('copyright')"
            >
              <div class="flex items-center gap-2">
                <Shield class="h-4 w-4 text-indigo-500" />
                <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {{ label('版权与许可协议', 'Copyright & Licensing') }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 ml-auto mr-1">
                <span v-if="activeSection !== 'copyright'" class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {{ publishForm.originality ? (publishForm.originality === 'ORIGINAL' ? '原创' : '转载') : '未设置原创' }} · {{ publishForm.license || '未设置协议' }}
                </span>
                <component :is="activeSection === 'copyright' ? ChevronUp : ChevronDown" class="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
              </div>
            </div>
            
            <div v-show="activeSection === 'copyright'" class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4">
              <!-- Originality -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">原创属性</span>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_ORIGINALITY_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.originality === opt.value
                        ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                    ]"
                    @click="publishForm.originality = publishForm.originality === opt.value ? '' : opt.value"
                  >
                    {{ label(opt.label_zh, opt.label_en) }}
                  </button>
                </div>
              </div>

              <div v-if="publishForm.originality && publishForm.originality !== 'ORIGINAL'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all">
                <Input
                  v-model="publishForm.originalAuthor"
                  type="text"
                  :label="label('原作者姓名/署名', 'Original Author')"
                  placeholder="e.g. SketchUp Studio"
                />
                <Input
                  v-model="publishForm.originalLink"
                  type="url"
                  :label="label('原作者作品链接', 'Original URL')"
                  placeholder="https://..."
                />
              </div>

              <!-- License & Download -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">授权许可协议</span>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="opt in ASSET_LICENSE_OPTIONS"
                      :key="opt.value"
                      type="button"
                      :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                        publishForm.license === opt.value
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
                      ]"
                      @click="publishForm.license = publishForm.license === opt.value ? '' : opt.value"
                    >
                      {{ opt.value }}
                    </button>
                  </div>
                </div>

                <div class="flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">下载权限</span>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      :class="[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                        publishForm.isFree === true
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      ]"
                      @click="publishForm.isFree = publishForm.isFree === true ? null : true"
                    >
                      免费下载
                    </button>
                    <button
                      type="button"
                      :class="[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                        publishForm.isFree === false
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      ]"
                      @click="publishForm.isFree = publishForm.isFree === false ? null : false"
                    >
                      VIP 会员专享
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Technical Specs Section (Right) -->
          <div class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all">
            <div
              class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors"
              @click="toggleSection('specs')"
            >
              <div class="flex items-center gap-2">
                <Settings class="h-4 w-4 text-teal-500" />
                <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {{ label('技术参数与规格', 'Technical Specifications') }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 ml-auto mr-1">
                <span v-if="activeSection !== 'specs'" class="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                  {{ publishForm.meshType || '未设置网格' }} · PBR({{ publishForm.pbrChannels?.length || 0 }})
                </span>
                <component :is="activeSection === 'specs' ? ChevronUp : ChevronDown" class="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
              </div>
            </div>

            <div v-show="activeSection === 'specs'" class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4">
              <!-- Mesh Type -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">网格多边形类型</span>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_MESHTYPE_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.meshType === opt.value
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-600 dark:text-teal-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
                    ]"
                    @click="publishForm.meshType = publishForm.meshType === opt.value ? '' : opt.value"
                  >
                    {{ label(opt.label_zh, opt.label_en) }}
                  </button>
                </div>
              </div>

              <!-- UV & Features Toggles -->
              <div class="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.uvUnwrapped
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.uvUnwrapped = !publishForm.uvUnwrapped"
                >
                  <span>已展 UV</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.uvUnwrapped ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.uvOverlapping
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.uvOverlapping = !publishForm.uvOverlapping"
                >
                  <span>UV 重叠</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.uvOverlapping ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.rigged
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.rigged = !publishForm.rigged"
                >
                  <span>骨骼绑定</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.rigged ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.gameReady
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.gameReady = !publishForm.gameReady"
                >
                  <span>游戏引擎就绪</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.gameReady ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>
              </div>

              <!-- PBR Maps fast toggle tags -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">包含 PBR 材质通道</span>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="map in ASSET_PBR_MAPS_OPTIONS"
                    :key="map"
                    type="button"
                    :class="[
                      'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                      publishForm.pbrChannels?.includes(map)
                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-600 dark:text-teal-300 font-semibold shadow-sm scale-105'
                        : 'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-800 text-slate-400 hover:bg-slate-200/50'
                    ]"
                    @click="togglePbrChannel(map)"
                  >
                    <span class="mr-1">{{ publishForm.pbrChannels?.includes(map) ? '✓' : '+' }}</span>{{ map }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Material Category: Upload material package -->
    <template v-if="publishCategory === 'material'">
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
              <FileDropZone
                v-model="publishForm.materialFile"
                accept=".zip,.sbsar"
                height-class="h-20"
                hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
                :label="publishForm.materialFile ? publishForm.materialFile.name : '点击上传材质包文件'"
                sublabel="支持 .zip .sbsar 格式"
                @change="handleMaterialFileChange"
              />

              <!-- ZIP File Explorer / Package Contents Preview (Material) -->
              <div v-if="publishForm.materialFile" class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left mt-2 shrink-0">
                <div class="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 bg-white/[0.02]">
                  <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    {{ t('publishDialog.packageContents') || '压缩包包含' }}
                    <span v-if="!isParsingZip && parsedFileTree.length > 0">({{ parsedFileTree.length }})</span>
                  </span>
                  <RefreshCw v-if="isParsingZip" class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0" />
                </div>
                <div v-if="isParsingZip" class="p-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>{{ t('publishDialog.readingPackageContents') || '正在读取压缩包目录...' }}</span>
                </div>
                <div v-else-if="parsedFileTree.length > 0" class="p-2.5 flex flex-col gap-1 max-h-[150px] overflow-y-auto custom-scrollbar text-xs text-[var(--text-secondary)] font-mono">
                  <div 
                    v-for="node in visibleFileNodes" 
                    :key="node.path" 
                    class="flex items-center gap-1.5 py-0.5 hover:bg-white/[0.03] px-2 rounded transition-colors"
                    :class="{ 'cursor-pointer select-none': node.isFolder }"
                    :style="{ paddingLeft: (node.level * 14 + 6) + 'px' }"
                    @click="node.isFolder ? toggleFolder(node.path) : null"
                  >
                    <component
                      :is="expandedFolders.has(node.path) ? FolderOpen : Folder"
                      v-if="node.isFolder"
                      class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400/80 shrink-0"
                    />
                    <template v-else>
                      <svg v-if="node.name.toLowerCase().endsWith('.blend')" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M66.332 70.032c.24-4.242 2.327-7.987 5.485-10.634 3.094-2.602 7.248-4.193 11.809-4.193 4.537 0 8.69 1.59 11.78 4.193 3.163 2.647 5.237 6.392 5.485 10.634.24 4.35-1.523 8.41-4.605 11.417-3.158 3.05-7.627 4.977-12.66 4.977-5.037 0-9.526-1.915-12.664-4.977-3.094-3.006-4.853-7.044-4.606-11.397zm0 0" fill="#235785"/>
                        <path d="M39.245 79.002c.028 1.66.564 4.89 1.36 7.404 1.682 5.336 4.537 10.273 8.49 14.599 4.062 4.465 9.074 8.055 14.85 10.61 6.073 2.67 12.665 4.037 19.505 4.037 6.84-.009 13.432-1.4 19.504-4.102 5.776-2.582 10.79-6.168 14.85-10.657 3.974-4.374 6.82-9.307 8.491-14.647a37 37 0 001.595-8.163c.208-2.69.12-5.405-.263-8.12a37.535 37.535 0 00-5.417-14.714c-2.574-4.15-5.916-7.76-9.89-10.813l.012-.004-39.955-30.506c-.036-.028-.068-.056-.104-.08-2.619-2.002-7.044-1.994-9.91.008-2.914 2.031-3.25 5.385-.656 7.496l-.012.008 16.682 13.484-50.789.051h-.068c-4.197.004-8.239 2.739-9.03 6.213-.82 3.521 2.035 6.46 6.412 6.46l-.008.016 25.736-.048L4.58 82.524c-.056.044-.12.088-.176.132C.069 85.95-1.33 91.446 1.4 94.9c2.778 3.522 8.666 3.546 13.047.02L39.505 74.51s-.368 2.758-.336 4.397zm64.56 9.219c-5.168 5.228-12.416 8.21-20.227 8.21-7.831.012-15.079-2.918-20.248-8.142-2.526-2.559-4.377-5.473-5.528-8.591a22.202 22.202 0 01-1.271-9.602 22.446 22.446 0 012.778-9.039c1.507-2.714 3.59-5.18 6.14-7.267 5.033-4.058 11.42-6.28 18.1-6.28 6.709-.008 13.097 2.174 18.13 6.236 2.55 2.075 4.625 4.529 6.14 7.243a22.302 22.302 0 012.774 9.043 22.302 22.302 0 01-1.271 9.598c-1.147 3.142-3.002 6.056-5.533 8.615zm0 0" fill="#e87500"/>
                      </svg>
                      <Box v-else-if="node.name.toLowerCase().endsWith('.glb') || node.name.toLowerCase().endsWith('.gltf') || node.name.toLowerCase().endsWith('.fbx') || node.name.toLowerCase().endsWith('.obj')" class="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <ImageIcon v-else-if="node.name.toLowerCase().endsWith('.png') || node.name.toLowerCase().endsWith('.jpg') || node.name.toLowerCase().endsWith('.jpeg') || node.name.toLowerCase().endsWith('.tga') || node.name.toLowerCase().endsWith('.hdr')" class="h-3.5 w-3.5 text-teal-500 shrink-0" />
                      <FileArchive v-else-if="node.name.toLowerCase().endsWith('.zip') || node.name.toLowerCase().endsWith('.rar') || node.name.toLowerCase().endsWith('.7z')" class="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <FileText v-else class="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    </template>
                    <span class="truncate" :class="{ 'text-indigo-600 dark:text-indigo-300 font-semibold': !node.isFolder && (node.name.toLowerCase().endsWith('.glb') || node.name.toLowerCase().endsWith('.gltf') || node.name.toLowerCase().endsWith('.fbx') || node.name.toLowerCase().endsWith('.obj') || node.name.toLowerCase().endsWith('.blend')) }">
                      {{ node.name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Material name -->
            <div>
              <Input
                v-model="publishForm.title"
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
                <el-select
                  v-model="publishForm.materialCategory"
                  placeholder="请选择材质分类"
                  class="w-full custom-select-v2"
                >
                  <el-option
                    v-for="cat in materialCategories"
                    :key="cat"
                    :label="cat"
                    :value="cat"
                  />
                </el-select>
              </div>
              <div class="flex flex-col">
                <span
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                  >材质分辨率</span
                >
                <el-select
                  v-model="publishForm.materialResolution"
                  placeholder="请选择分辨率"
                  class="w-full custom-select-v2"
                >
                  <el-option
                    v-for="res in resolutionOptions"
                    :key="res"
                    :label="res"
                    :value="res"
                  />
                </el-select>
              </div>
            </div>

            <!-- Procedural Switch -->
            <div class="flex items-center gap-3 py-0.5">
              <el-switch v-model="publishForm.materialIsProcedural" active-color="var(--accent)" />
              <span class="text-xs font-bold text-slate-400">程序化材质 / SBSAR</span>
            </div>

            <!-- Preview image (Cover) -->
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                >封面图（可选）</label
              >
              <FileDropZone
                v-model="publishForm.thumbnail"
                accept="image/*"
                height-class="h-16"
                hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
                :label="publishForm.thumbnail ? publishForm.thumbnail.name : '点击上传封面图'"
                @change="handleThumbnailChange"
              />
            </div>

            <!-- Tags -->
            <div>
              <Input
                v-model="publishForm.tags"
                type="text"
                label="标签"
                placeholder="用逗号分隔，如：PBR, 金属, 4K, 游戏资产"
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
              v-model="publishForm.description"
              placeholder="贴图通道、使用场景、授权或引擎导入注意事项... 支持 Markdown 格式"
              :height="isMobile ? '280px' : '340px'"
              simple
            />
          </div>
        </div>

        <!-- Bottom Row: Horizontally Aligned Copyright & Tech Specs Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <!-- Copyright & License Section (Left) -->
          <div class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all">
            <div
              class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors"
              @click="toggleSection('copyright')"
            >
              <div class="flex items-center gap-2">
                <Shield class="h-4 w-4 text-indigo-500" />
                <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {{ label('版权与许可协议', 'Copyright & Licensing') }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 ml-auto mr-1">
                <span v-if="activeSection !== 'copyright'" class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {{ publishForm.originality ? (publishForm.originality === 'ORIGINAL' ? '原创' : '转载') : '未设置原创' }} · {{ publishForm.license || '未设置协议' }}
                </span>
                <component :is="activeSection === 'copyright' ? ChevronUp : ChevronDown" class="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
              </div>
            </div>
            
            <div v-show="activeSection === 'copyright'" class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4">
              <!-- Originality -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">原创属性</span>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_ORIGINALITY_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.originality === opt.value
                        ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                    ]"
                    @click="publishForm.originality = publishForm.originality === opt.value ? '' : opt.value"
                  >
                    {{ label(opt.label_zh, opt.label_en) }}
                  </button>
                </div>
              </div>

              <div v-if="publishForm.originality && publishForm.originality !== 'ORIGINAL'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all">
                <Input
                  v-model="publishForm.originalAuthor"
                  type="text"
                  :label="label('原作者姓名/署名', 'Original Author')"
                  placeholder="e.g. SketchUp Studio"
                />
                <Input
                  v-model="publishForm.originalLink"
                  type="url"
                  :label="label('原作者作品链接', 'Original URL')"
                  placeholder="https://..."
                />
              </div>

              <!-- License & Download -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">授权许可协议</span>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="opt in ASSET_LICENSE_OPTIONS"
                      :key="opt.value"
                      type="button"
                      :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                        publishForm.license === opt.value
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
                      ]"
                      @click="publishForm.license = publishForm.license === opt.value ? '' : opt.value"
                    >
                      {{ opt.value }}
                    </button>
                  </div>
                </div>

                <div class="flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">下载权限</span>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      :class="[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                        publishForm.isFree === true
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      ]"
                      @click="publishForm.isFree = publishForm.isFree === true ? null : true"
                    >
                      免费下载
                    </button>
                    <button
                      type="button"
                      :class="[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                        publishForm.isFree === false
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      ]"
                      @click="publishForm.isFree = publishForm.isFree === false ? null : false"
                    >
                      VIP 会员专享
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Technical Specs Section (Right) -->
          <div class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all">
            <div
              class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors"
              @click="toggleSection('specs')"
            >
              <div class="flex items-center gap-2">
                <Settings class="h-4 w-4 text-teal-500" />
                <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {{ label('技术参数与规格', 'Technical Specifications') }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 ml-auto mr-1">
                <span v-if="activeSection !== 'specs'" class="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                  {{ publishForm.meshType || '未设置网格' }} · PBR({{ publishForm.pbrChannels?.length || 0 }})
                </span>
                <component :is="activeSection === 'specs' ? ChevronUp : ChevronDown" class="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
              </div>
            </div>

            <div v-show="activeSection === 'specs'" class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4">
              <!-- Mesh Type -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">网格多边形类型</span>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_MESHTYPE_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.meshType === opt.value
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-600 dark:text-teal-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
                    ]"
                    @click="publishForm.meshType = publishForm.meshType === opt.value ? '' : opt.value"
                  >
                    {{ label(opt.label_zh, opt.label_en) }}
                  </button>
                </div>
              </div>

              <!-- UV & Features Toggles -->
              <div class="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.uvUnwrapped
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.uvUnwrapped = !publishForm.uvUnwrapped"
                >
                  <span>已展 UV</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.uvUnwrapped ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.uvOverlapping
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.uvOverlapping = !publishForm.uvOverlapping"
                >
                  <span>UV 重叠</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.uvOverlapping ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.rigged
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.rigged = !publishForm.rigged"
                >
                  <span>骨骼绑定</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.rigged ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.gameReady
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500'
                  ]"
                  @click="publishForm.gameReady = !publishForm.gameReady"
                >
                  <span>游戏引擎就绪</span>
                  <span :class="['w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold', publishForm.gameReady ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700']">✓</span>
                </button>
              </div>

              <!-- PBR Maps fast toggle tags -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">包含 PBR 材质通道</span>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="map in ASSET_PBR_MAPS_OPTIONS"
                    :key="map"
                    type="button"
                    :class="[
                      'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                      publishForm.pbrChannels?.includes(map)
                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-600 dark:text-teal-300 font-semibold shadow-sm scale-105'
                        : 'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-800 text-slate-400 hover:bg-slate-200/50'
                    ]"
                    @click="togglePbrChannel(map)"
                  >
                    <span class="mr-1">{{ publishForm.pbrChannels?.includes(map) ? '✓' : '+' }}</span>{{ map }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Publish Button -->
    <Button
      type="button"
      variant="primary"
      size="lg"
      full-width
      :loading="isPublishing"
      class="sticky bottom-0 z-10 mt-4 publish-submit"
      @click="handlePublish"
    >
      {{ isPublishing ? t('publishDialog.publishing') : t('publishDialog.publishNow') }}
    </Button>
  </Modal>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.custom-select-v2 :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 44px;
}
.publish-dialog-shell {
  border: 1px solid var(--border-base);
}
.publish-submit {
  box-shadow: 0 -8px 20px color-mix(in srgb, var(--bg-card) 86%, transparent);
}
</style>
