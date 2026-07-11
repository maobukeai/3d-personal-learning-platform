<script setup lang="ts">
import { getApiErrorMessage, logError } from '@/utils/error';
import { computed, ref, onMounted, watch, defineAsyncComponent } from 'vue';
import {
  UploadCloud,
  Layers,
  Puzzle,
  Laptop,
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
  Sparkles,
} from 'lucide-vue-next';
import { type Ref } from 'vue';
import AiImageGeneratorDialog from '@/components/AiImageGeneratorDialog.vue';
import { parseZipFileNames, buildFileTree, flattenFileTree } from '@/utils/zipHelper';
import { useFileTree } from '@/composables/useFileTree';
import { useTempUpload } from '@/composables/useTempUpload';
import DownloadTypeSegment from '@/components/DownloadTypeSegment.vue';
import ZipFileTreeViewer from '@/components/ZipFileTreeViewer.vue';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { useI18n } from 'vue-i18n';
import { useMobile } from '@/composables/useMobile';
import { useSystemStore } from '@/stores/system';
import FileDropZone from '@/components/FileDropZone.vue';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Input from '@/components/ui/Input.vue';
import { useLabel } from '@/utils/i18n';
import {
  ASSET_ORIGINALITY_OPTIONS,
  ASSET_LICENSE_OPTIONS,
  ASSET_MESHTYPE_OPTIONS,
  ASSET_PBR_MAPS_OPTIONS,
} from '@/views/Assets/assetLibraryModel';

const blenderVersions = [
  'Blender 5.2',
  'Blender 5.1',
  'Blender 5.0',
  'Blender 4.3',
  'Blender 4.2',
  'Blender 4.1',
  'Blender 4.0',
  'Blender 3.6',
  'Blender 3.5',
  'Blender 3.3',
  'Blender 3.0',
  'Blender 2.93',
  'Blender 4.x / 5.x',
  'Blender 3.x / 4.x',
];

const { t } = useI18n();

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

type PublishCategory = 'asset' | 'material' | 'plugin' | 'software';

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
  downloadType?: 'local' | 'external';
  externalUrl?: string;
  extractionCode?: string;
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
      return label('上传3D模型', 'Upload 3D Model');
    case 'material':
      return label('上传材质', 'Upload Material');
    case 'plugin':
      return label('上传插件', 'Upload Plugin');
    case 'software':
      return label('上传软件', 'Upload Software');
    default:
      return '';
  }
});

const categoryTabs = computed(() => [
  { value: 'asset', label: label('上传3D模型', 'Upload 3D Model'), icon: UploadCloud },
  { value: 'material', label: label('上传材质', 'Upload Material'), icon: Layers },
  { value: 'plugin', label: label('上传插件', 'Upload Plugin'), icon: Puzzle },
  { value: 'software', label: label('上传软件', 'Upload Software'), icon: Laptop },
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
  downloadType: 'local' as 'local' | 'external',
  externalUrl: '',
  extractionCode: '',
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

const tempAssetPath = ref<string | null>(null);
const assetUploadProgress = ref<number | null>(null);

const tempPluginPath = ref<string | null>(null);
const pluginUploadProgress = ref<number | null>(null);

const tempPluginPreviewPath = ref<string | null>(null);
const pluginPreviewUploadProgress = ref<number | null>(null);

const tempMaterialPath = ref<string | null>(null);
const materialUploadProgress = ref<number | null>(null);

const tempThumbnailPath = ref<string | null>(null);
const thumbnailUploadProgress = ref<number | null>(null);

const showAiCoverDialog = ref(false);
const activeCoverTarget = ref<'thumbnail' | 'pluginPreview'>('thumbnail');

const openAiCoverGenerator = (target: 'thumbnail' | 'pluginPreview' = 'thumbnail') => {
  activeCoverTarget.value = target;
  showAiCoverDialog.value = true;
};

const handleAiCoverSave = async (file: File) => {
  if (activeCoverTarget.value === 'pluginPreview') {
    publishForm.value.pluginPreview = file;
    const success = await uploadFile(
      file,
      pluginPreviewUploadProgress,
      tempPluginPreviewPath,
      'plugin_preview',
    );
    if (success) {
      ElMessage.success('已自动应用 AI 生成的封面图！');
    } else {
      publishForm.value.pluginPreview = null;
    }
  } else {
    publishForm.value.thumbnail = file;
    const success = await uploadFile(file, thumbnailUploadProgress, tempThumbnailPath, 'thumbnail');
    if (success) {
      ElMessage.success('已自动应用 AI 生成的封面图！');
    } else {
      publishForm.value.thumbnail = null;
    }
  }
};

const { uploadFile: doUpload, cancelUpload } = useTempUpload();

const uploadFile = async (
  file: File,
  progressRef: Ref<number | null>,
  pathRef: Ref<string | null>,
  fieldname?: string,
): Promise<boolean> => {
  return doUpload(
    file,
    progressRef,
    (filePath) => {
      pathRef.value = filePath;
    },
    () => pathRef.value,
    fieldname,
  );
};

const cancelAllTempUploads = () => {
  const paths = [
    tempAssetPath.value,
    tempPluginPath.value,
    tempPluginPreviewPath.value,
    tempMaterialPath.value,
    tempThumbnailPath.value,
  ].filter(Boolean) as string[];

  for (const path of paths) {
    cancelUpload(path);
  }

  tempAssetPath.value = null;
  assetUploadProgress.value = null;
  tempPluginPath.value = null;
  pluginUploadProgress.value = null;
  tempPluginPreviewPath.value = null;
  pluginPreviewUploadProgress.value = null;
  tempMaterialPath.value = null;
  materialUploadProgress.value = null;
  tempThumbnailPath.value = null;
  thumbnailUploadProgress.value = null;
};

const activeUploadFile = computed(() => {
  if (publishForm.value.downloadType === 'external') return null;
  if (publishCategory.value === 'asset') return publishForm.value.assetFile;
  if (publishCategory.value === 'material') return publishForm.value.materialFile;
  if (publishCategory.value === 'plugin' || publishCategory.value === 'software')
    return publishForm.value.pluginFile;
  return null;
});

const parsedFileTree = computed(() => {
  if (!activeUploadFile.value) return [];
  if (packageFileList.value.length > 0) {
    const tree = buildFileTree(packageFileList.value);
    return flattenFileTree(tree);
  }
  return [
    {
      name: activeUploadFile.value.name,
      path: activeUploadFile.value.name,
      isFolder: false,
      level: 0,
    },
  ];
});

const { expandedFolders, toggleFolder, visibleFileNodes, resetExpansion } =
  useFileTree(parsedFileTree);

watch(activeUploadFile, async (newFile) => {
  resetExpansion();
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
      logError(err, { operation: 'Error parsing zip file in publish dialog' });
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
  if (cat === 'asset' || cat === 'material' || cat === 'plugin' || cat === 'software') {
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
      if (
        category === 'asset' ||
        category === 'material' ||
        category === 'plugin' ||
        category === 'software'
      ) {
        publishCategory.value = category;
      } else {
        publishCategory.value = 'asset';
      }
    }
  },
);

const handleThumbnailChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.thumbnail = file;
    await uploadFile(file, thumbnailUploadProgress, tempThumbnailPath, 'thumbnail');
  }
};

const handleAssetFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.assetFile = file;
    if (!publishForm.value.title) {
      publishForm.value.title = file.name.split('.')[0];
    }
    await uploadFile(file, assetUploadProgress, tempAssetPath, 'asset');
  }
};

const handlePluginFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.pluginFile = file;
    if (!publishForm.value.title) {
      publishForm.value.title = file.name.replace(/\.[^.]+$/, '');
    }
    await uploadFile(file, pluginUploadProgress, tempPluginPath, 'plugin');
  }
};

const handlePluginPreviewChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.pluginPreview = file;
    await uploadFile(file, pluginPreviewUploadProgress, tempPluginPreviewPath, 'plugin_preview');
  }
};

const handleMaterialFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.materialFile = file;
    if (!publishForm.value.title) {
      publishForm.value.title = file.name.replace(/\.[^.]+$/, '');
    }
    await uploadFile(file, materialUploadProgress, tempMaterialPath, 'material');
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
      if (publishForm.value.downloadType === 'local') {
        if (!publishForm.value.assetFile && !tempAssetPath.value) {
          ElMessage.warning(t('publishDialog.modelRequired'));
          isPublishing.value = false;
          return;
        }
      } else {
        if (!publishForm.value.externalUrl.trim()) {
          ElMessage.warning('请填写网盘链接 or 外部下载链接');
          isPublishing.value = false;
          return;
        }
      }
      if (!publishForm.value.assetCategory) {
        ElMessage.warning(t('publishDialog.categoryRequired'));
        isPublishing.value = false;
        return;
      }

      const uploadFormData = new FormData();
      if (publishForm.value.downloadType === 'local') {
        if (tempAssetPath.value) {
          uploadFormData.append('tempAssetPath', tempAssetPath.value);
        } else if (publishForm.value.assetFile) {
          uploadFormData.append('asset', publishForm.value.assetFile);
        }
      } else {
        let finalUrl = publishForm.value.externalUrl.trim();
        if (publishForm.value.extractionCode?.trim()) {
          finalUrl += ` 提取码: ${publishForm.value.extractionCode.trim()}`;
        }
        uploadFormData.append('externalUrl', finalUrl);
      }

      if (tempThumbnailPath.value) {
        uploadFormData.append('tempThumbnailPath', tempThumbnailPath.value);
      } else if (publishForm.value.thumbnail) {
        uploadFormData.append('thumbnail', publishForm.value.thumbnail);
      }
      uploadFormData.append('title', publishForm.value.title);
      uploadFormData.append('description', publishForm.value.description);
      uploadFormData.append('categoryId', publishForm.value.assetCategory);
      uploadFormData.append('originality', publishForm.value.originality || '');
      uploadFormData.append('originalAuthor', publishForm.value.originalAuthor || '');
      uploadFormData.append('originalLink', publishForm.value.originalLink || '');
      uploadFormData.append('license', publishForm.value.license || '');
      uploadFormData.append(
        'isFree',
        publishForm.value.isFree === null || publishForm.value.isFree === undefined
          ? ''
          : String(publishForm.value.isFree),
      );
      uploadFormData.append('meshType', publishForm.value.meshType || '');
      uploadFormData.append('uvUnwrapped', String(publishForm.value.uvUnwrapped ?? false));
      uploadFormData.append('uvOverlapping', String(publishForm.value.uvOverlapping ?? false));
      uploadFormData.append('pbrChannels', JSON.stringify(publishForm.value.pbrChannels || []));
      uploadFormData.append('rigged', String(publishForm.value.rigged ?? false));
      uploadFormData.append('gameReady', String(publishForm.value.gameReady ?? false));
      if (publishForm.value.bilibiliUrl) {
        uploadFormData.append('bilibiliUrl', publishForm.value.bilibiliUrl);
      }
      if (publishForm.value.assetFile) {
        uploadFormData.append('fileSize', String(publishForm.value.assetFile.size));
      }
      if (packageFileList.value && packageFileList.value.length > 0) {
        uploadFormData.append('packageFilesList', JSON.stringify(packageFileList.value));
      }

      await api.post('/api/assets/upload', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (publishCategory.value === 'plugin' || publishCategory.value === 'software') {
      const isPlugin = publishCategory.value === 'plugin';
      if (publishForm.value.downloadType === 'local') {
        if (!publishForm.value.pluginFile && !tempPluginPath.value) {
          ElMessage.warning(
            isPlugin ? t('publishDialog.pluginRequired') || '请上传插件文件' : '请上传软件文件',
          );
          isPublishing.value = false;
          return;
        }
      } else {
        if (!publishForm.value.externalUrl.trim()) {
          ElMessage.warning('请填写网盘链接 or 外部下载链接');
          isPublishing.value = false;
          return;
        }
      }
      if (!publishForm.value.title.trim()) {
        ElMessage.warning(isPlugin ? '请填写插件名称' : '请填写软件名称');
        isPublishing.value = false;
        return;
      }
      const pluginFormData = new FormData();
      if (publishForm.value.downloadType === 'local') {
        if (tempPluginPath.value) {
          pluginFormData.append(
            isPlugin ? 'tempPluginPath' : 'tempSoftwarePath',
            tempPluginPath.value,
          );
        } else if (publishForm.value.pluginFile) {
          pluginFormData.append(
            isPlugin ? 'plugin_file' : 'software_file',
            publishForm.value.pluginFile,
          );
        }
      } else {
        let finalUrl = publishForm.value.externalUrl.trim();
        if (publishForm.value.extractionCode?.trim()) {
          finalUrl += ` 提取码: ${publishForm.value.extractionCode.trim()}`;
        }
        pluginFormData.append('externalUrl', finalUrl);
      }

      if (tempPluginPreviewPath.value) {
        pluginFormData.append(
          isPlugin ? 'tempPreviewPath' : 'tempPreviewPath',
          tempPluginPreviewPath.value,
        );
      } else if (publishForm.value.pluginPreview) {
        pluginFormData.append(
          isPlugin ? 'plugin_preview' : 'software_preview',
          publishForm.value.pluginPreview,
        );
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
      if (publishForm.value.pluginFile) {
        pluginFormData.append('fileSize', String(publishForm.value.pluginFile.size));
      }
      if (packageFileList.value && packageFileList.value.length > 0) {
        pluginFormData.append('packageFilesList', JSON.stringify(packageFileList.value));
      }
      const endpoint = isPlugin ? '/api/plugins/upload' : '/api/softwares/upload';
      await api.post(endpoint, pluginFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (publishCategory.value === 'material') {
      if (publishForm.value.downloadType === 'local') {
        if (!publishForm.value.materialFile && !tempMaterialPath.value) {
          ElMessage.warning(t('publishDialog.materialRequired') || '请上传材质包文件');
          isPublishing.value = false;
          return;
        }
      } else {
        if (!publishForm.value.externalUrl.trim()) {
          ElMessage.warning('请填写网盘链接 or 外部下载链接');
          isPublishing.value = false;
          return;
        }
      }
      if (!publishForm.value.materialCategory) {
        ElMessage.warning('请选择材质分类');
        isPublishing.value = false;
        return;
      }

      const materialFormData = new FormData();
      if (publishForm.value.downloadType === 'local') {
        if (tempMaterialPath.value) {
          materialFormData.append('tempMaterialPath', tempMaterialPath.value);
        } else if (publishForm.value.materialFile) {
          materialFormData.append('material', publishForm.value.materialFile);
        }
      } else {
        let finalUrl = publishForm.value.externalUrl.trim();
        if (publishForm.value.extractionCode?.trim()) {
          finalUrl += ` 提取码: ${publishForm.value.extractionCode.trim()}`;
        }
        materialFormData.append('externalUrl', finalUrl);
      }

      if (tempThumbnailPath.value) {
        materialFormData.append('tempPreviewPath', tempThumbnailPath.value);
      } else if (publishForm.value.thumbnail) {
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
      if (publishForm.value.bilibiliUrl) {
        materialFormData.append('bilibiliUrl', publishForm.value.bilibiliUrl);
      }
      if (publishForm.value.materialFile) {
        materialFormData.append('fileSize', String(publishForm.value.materialFile.size));
      }
      if (packageFileList.value && packageFileList.value.length > 0) {
        materialFormData.append('packageFilesList', JSON.stringify(packageFileList.value));
      }

      await api.post('/api/materials/upload', materialFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }

    ElMessage.success(t('publishDialog.publishSuccess') || '发布成功');
    // Clear temp paths so they aren't deleted in closeDialog
    tempAssetPath.value = null;
    tempPluginPath.value = null;
    tempPluginPreviewPath.value = null;
    tempMaterialPath.value = null;
    tempThumbnailPath.value = null;
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
  cancelAllTempUploads();
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
    originality: '',
    originalAuthor: '',
    originalLink: '',
    license: '',
    isFree: null,
    meshType: '',
    uvUnwrapped: false,
    uvOverlapping: false,
    pbrChannels: [],
    rigged: false,
    gameReady: false,
    downloadType: 'local',
    externalUrl: '',
    extractionCode: '',
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
  <Modal :show="modelValue" size="xxl" content-class="publish-work-modal" @close="closeDialog">
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
              <DownloadTypeSegment
                v-model:downloadType="publishForm.downloadType"
                v-model:file="publishForm.assetFile"
                v-model:externalUrl="publishForm.externalUrl"
                v-model:extractionCode="publishForm.extractionCode"
                :progress="assetUploadProgress"
                accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.blend,.usdz,.abc,.zip"
                :drag-label="t('publishDialog.dragAssetFile')"
                :supported-label="t('publishDialog.supportedAssetFiles')"
                @change="handleAssetFileChange"
              />

              <ZipFileTreeViewer
                :file="publishForm.assetFile"
                :is-parsing-zip="isParsingZip"
                :parsed-file-tree="parsedFileTree"
                :visible-file-nodes="visibleFileNodes"
                :expanded-folders="expandedFolders"
                @toggle="toggleFolder"
              />
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
                <Select
                  v-model="publishForm.assetCategory"
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
                    @click="openAiCoverGenerator('thumbnail')"
                  >
                    <Sparkles class="w-3 h-3 text-violet-400" />
                    AI 生成封面
                  </button>
                </div>
                <FileDropZone
                  v-model="publishForm.thumbnail"
                  accept="image/*"
                  height-class="h-16"
                  hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
                  :progress="thumbnailUploadProgress"
                  :label="publishForm.thumbnail ? publishForm.thumbnail.name : '点击上传封面图'"
                  @change="handleThumbnailChange"
                />
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
          <div
            class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all"
          >
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
                <span
                  v-if="activeSection !== 'copyright'"
                  class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20"
                >
                  {{
                    publishForm.originality
                      ? publishForm.originality === 'ORIGINAL'
                        ? '原创'
                        : '转载'
                      : '未设置原创'
                  }}
                  · {{ publishForm.license || '未设置协议' }}
                </span>
                <component
                  :is="activeSection === 'copyright' ? ChevronUp : ChevronDown"
                  class="h-4 w-4 text-[var(--text-secondary)] shrink-0"
                />
              </div>
            </div>

            <div
              v-show="activeSection === 'copyright'"
              class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4"
            >
              <!-- Originality -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                  >原创属性</span
                >
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_ORIGINALITY_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.originality === opt.value
                        ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800',
                    ]"
                    @click="
                      publishForm.originality =
                        publishForm.originality === opt.value ? '' : opt.value
                    "
                  >
                    {{ label(opt.label_zh, opt.label_en) }}
                  </button>
                </div>
              </div>

              <div
                v-if="publishForm.originality && publishForm.originality !== 'ORIGINAL'"
                class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all"
              >
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
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                    >授权许可协议</span
                  >
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="opt in ASSET_LICENSE_OPTIONS"
                      :key="opt.value"
                      type="button"
                      :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                        publishForm.license === opt.value
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50',
                      ]"
                      @click="
                        publishForm.license = publishForm.license === opt.value ? '' : opt.value
                      "
                    >
                      {{ opt.value }}
                    </button>
                  </div>
                </div>

                <div class="flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                    >下载权限</span
                  >
                  <div class="flex gap-2">
                    <button
                      type="button"
                      :class="[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                        publishForm.isFree === true
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400',
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
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400',
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
          <div
            class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all"
          >
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
                <span
                  v-if="activeSection !== 'specs'"
                  class="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20"
                >
                  {{ publishForm.meshType || '未设置网格' }} · PBR({{
                    publishForm.pbrChannels?.length || 0
                  }})
                </span>
                <component
                  :is="activeSection === 'specs' ? ChevronUp : ChevronDown"
                  class="h-4 w-4 text-[var(--text-secondary)] shrink-0"
                />
              </div>
            </div>

            <div
              v-show="activeSection === 'specs'"
              class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4"
            >
              <!-- Mesh Type -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                  >网格多边形类型</span
                >
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_MESHTYPE_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.meshType === opt.value
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-600 dark:text-teal-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50',
                    ]"
                    @click="
                      publishForm.meshType = publishForm.meshType === opt.value ? '' : opt.value
                    "
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
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.uvUnwrapped = !publishForm.uvUnwrapped"
                >
                  <span>已展 UV</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.uvUnwrapped ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.uvOverlapping
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.uvOverlapping = !publishForm.uvOverlapping"
                >
                  <span>UV 重叠</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.uvOverlapping ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.rigged
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.rigged = !publishForm.rigged"
                >
                  <span>骨骼绑定</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.rigged ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.gameReady
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.gameReady = !publishForm.gameReady"
                >
                  <span>游戏引擎就绪</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.gameReady ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>
              </div>

              <!-- PBR Maps fast toggle tags -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                  >包含 PBR 材质通道</span
                >
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="map in ASSET_PBR_MAPS_OPTIONS"
                    :key="map"
                    type="button"
                    :class="[
                      'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                      publishForm.pbrChannels?.includes(map)
                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-600 dark:text-teal-300 font-semibold shadow-sm scale-105'
                        : 'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-800 text-slate-400 hover:bg-slate-200/50',
                    ]"
                    @click="togglePbrChannel(map)"
                  >
                    <span class="mr-1">{{
                      publishForm.pbrChannels?.includes(map) ? '✓' : '+'
                    }}</span
                    >{{ map }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Plugin Category: Upload plugin file -->
    <template v-if="publishCategory === 'plugin' || publishCategory === 'software'">
      <div class="space-y-4">
        <!-- Top Row: Form Inputs (Left) and Description (Right) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div class="space-y-2.5">
            <!-- Plugin file upload -->
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                >{{ publishCategory === 'plugin' ? '插件文件 *' : '软件文件 *' }}</label
              >
              <DownloadTypeSegment
                v-model:downloadType="publishForm.downloadType"
                v-model:file="publishForm.pluginFile"
                v-model:externalUrl="publishForm.externalUrl"
                v-model:extractionCode="publishForm.extractionCode"
                :progress="pluginUploadProgress"
                :accept="
                  publishCategory === 'plugin'
                    ? '.zip,.rar,.7z,.blend,.js,.ts,.py,.lua,.mjs'
                    : '.exe,.msi,.dmg,.pkg,.deb,.rpm,.zip,.rar,.7z'
                "
                :supported-label="
                  publishCategory === 'plugin'
                    ? '.zip .blend .js .ts .py 等格式'
                    : '.exe .msi .dmg .zip 等安装包或压缩包'
                "
                :drag-label="
                  publishCategory === 'plugin' ? '点击或拖拽上传插件文件' : '点击或拖拽上传软件文件'
                "
                @change="handlePluginFileChange"
              />

              <!-- ZIP File Explorer / Package Contents Preview (Plugin) -->
              <ZipFileTreeViewer
                v-if="publishCategory === 'plugin' || publishCategory === 'software'"
                :file="publishForm.pluginFile"
                :is-parsing-zip="isParsingZip"
                :parsed-file-tree="parsedFileTree"
                :visible-file-nodes="visibleFileNodes"
                :expanded-folders="expandedFolders"
                @toggle="toggleFolder"
              />
            </div>

            <!-- Plugin name -->
            <div>
              <Input
                v-model="publishForm.title"
                type="text"
                :label="publishCategory === 'plugin' ? '插件名称' : '软件名称'"
                :placeholder="
                  publishCategory === 'plugin' ? '如：材质批量导出工具' : '如：Blender 官方正式版'
                "
                required
              />
            </div>

            <!-- Category & Version -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col">
                <span
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                  >{{ publishCategory === 'plugin' ? '插件分类' : '软件分类' }}</span
                >
                <Select
                  v-model="publishForm.pluginCategory"
                  :placeholder="publishCategory === 'plugin' ? '请选择插件分类' : '请选择软件分类'"
                  class="w-full custom-select-v2"
                >
                  <SelectOption
                    v-for="cat in publishCategory === 'plugin'
                      ? systemStore.settings.PLUGIN_CATEGORIES
                      : [
                          '3D 建模与雕刻软件',
                          '渲染引擎与渲染器',
                          '后期与图像处理',
                          '游戏与交互引擎',
                          '其他工具',
                        ]"
                    :key="cat"
                    :label="cat"
                    :value="cat"
                  />
                </Select>
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
              <div class="flex flex-col">
                <span
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                  >兼容性</span
                >
                <Select
                  v-model="publishForm.pluginCompatibility"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="选择或输入兼容版本"
                  class="w-full custom-select-v2"
                >
                  <SelectOption
                    v-for="ver in publishCategory === 'plugin'
                      ? blenderVersions
                      : ['Windows 10/11', 'macOS', 'Linux', 'Android', 'iOS', '跨平台']"
                    :key="ver"
                    :label="ver"
                    :value="ver"
                  />
                </Select>
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
              <div class="flex items-center justify-between mb-1 ml-1">
                <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >封面图（可选）</label
                >
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer border-none bg-transparent"
                  @click="openAiCoverGenerator('pluginPreview')"
                >
                  <Sparkles class="w-3 h-3 text-violet-400" />
                  AI 生成封面
                </button>
              </div>
              <FileDropZone
                v-model="publishForm.pluginPreview"
                accept="image/*"
                height-class="h-16"
                hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
                :progress="pluginPreviewUploadProgress"
                :label="
                  publishForm.pluginPreview ? publishForm.pluginPreview.name : '点击上传封面图'
                "
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
              >{{ publishCategory === 'plugin' ? '插件简介' : '软件简介' }}</label
            >
            <MarkdownEditor
              v-model="publishForm.description"
              :placeholder="
                publishCategory === 'plugin'
                  ? '简单描述插件的功能和用途'
                  : '简单描述软件的功能和用途'
              "
              :height="isMobile ? '300px' : '400px'"
              simple
            />
          </div>
        </div>

        <!-- Bottom Row: Horizontally Aligned Copyright & Tech Specs Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <!-- Copyright & License Section (Left) -->
          <div
            class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all"
          >
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
                <span
                  v-if="activeSection !== 'copyright'"
                  class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20"
                >
                  {{
                    publishForm.originality
                      ? publishForm.originality === 'ORIGINAL'
                        ? '原创'
                        : '转载'
                      : '未设置原创'
                  }}
                  · {{ publishForm.license || '未设置协议' }}
                </span>
                <component
                  :is="activeSection === 'copyright' ? ChevronUp : ChevronDown"
                  class="h-4 w-4 text-[var(--text-secondary)] shrink-0"
                />
              </div>
            </div>

            <div
              v-show="activeSection === 'copyright'"
              class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4"
            >
              <!-- Originality -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                  >原创属性</span
                >
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_ORIGINALITY_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.originality === opt.value
                        ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800',
                    ]"
                    @click="
                      publishForm.originality =
                        publishForm.originality === opt.value ? '' : opt.value
                    "
                  >
                    {{ label(opt.label_zh, opt.label_en) }}
                  </button>
                </div>
              </div>

              <div
                v-if="publishForm.originality && publishForm.originality !== 'ORIGINAL'"
                class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all"
              >
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
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                    >授权许可协议</span
                  >
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="opt in ASSET_LICENSE_OPTIONS"
                      :key="opt.value"
                      type="button"
                      :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                        publishForm.license === opt.value
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50',
                      ]"
                      @click="
                        publishForm.license = publishForm.license === opt.value ? '' : opt.value
                      "
                    >
                      {{ opt.value }}
                    </button>
                  </div>
                </div>

                <div class="flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                    >下载权限</span
                  >
                  <div class="flex gap-2">
                    <button
                      type="button"
                      :class="[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                        publishForm.isFree === true
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400',
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
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400',
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
          <div
            class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all"
          >
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
                <span
                  v-if="activeSection !== 'specs'"
                  class="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20"
                >
                  {{ publishForm.meshType || '未设置网格' }} · PBR({{
                    publishForm.pbrChannels?.length || 0
                  }})
                </span>
                <component
                  :is="activeSection === 'specs' ? ChevronUp : ChevronDown"
                  class="h-4 w-4 text-[var(--text-secondary)] shrink-0"
                />
              </div>
            </div>

            <div
              v-show="activeSection === 'specs'"
              class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4"
            >
              <!-- Mesh Type -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                  >网格多边形类型</span
                >
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_MESHTYPE_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.meshType === opt.value
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-600 dark:text-teal-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50',
                    ]"
                    @click="
                      publishForm.meshType = publishForm.meshType === opt.value ? '' : opt.value
                    "
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
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.uvUnwrapped = !publishForm.uvUnwrapped"
                >
                  <span>已展 UV</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.uvUnwrapped ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.uvOverlapping
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.uvOverlapping = !publishForm.uvOverlapping"
                >
                  <span>UV 重叠</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.uvOverlapping ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.rigged
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.rigged = !publishForm.rigged"
                >
                  <span>骨骼绑定</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.rigged ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.gameReady
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.gameReady = !publishForm.gameReady"
                >
                  <span>游戏引擎就绪</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.gameReady ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>
              </div>

              <!-- PBR Maps fast toggle tags -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                  >包含 PBR 材质通道</span
                >
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="map in ASSET_PBR_MAPS_OPTIONS"
                    :key="map"
                    type="button"
                    :class="[
                      'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                      publishForm.pbrChannels?.includes(map)
                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-600 dark:text-teal-300 font-semibold shadow-sm scale-105'
                        : 'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-800 text-slate-400 hover:bg-slate-200/50',
                    ]"
                    @click="togglePbrChannel(map)"
                  >
                    <span class="mr-1">{{
                      publishForm.pbrChannels?.includes(map) ? '✓' : '+'
                    }}</span
                    >{{ map }}
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
              <DownloadTypeSegment
                v-model:downloadType="publishForm.downloadType"
                v-model:file="publishForm.materialFile"
                v-model:externalUrl="publishForm.externalUrl"
                v-model:extractionCode="publishForm.extractionCode"
                :progress="materialUploadProgress"
                accept=".zip,.sbsar"
                supported-label="支持 .zip .sbsar 格式"
                @change="handleMaterialFileChange"
              />

              <ZipFileTreeViewer
                :file="publishForm.materialFile"
                :is-parsing-zip="isParsingZip"
                :parsed-file-tree="parsedFileTree"
                :visible-file-nodes="visibleFileNodes"
                :expanded-folders="expandedFolders"
                @toggle="toggleFolder"
              />
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
                <Select
                  v-model="publishForm.materialCategory"
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
                  v-model="publishForm.materialResolution"
                  placeholder="请选择分辨率"
                  class="w-full custom-select-v2"
                >
                  <SelectOption
                    v-for="res in resolutionOptions"
                    :key="res"
                    :label="res"
                    :value="res"
                  />
                </Select>
              </div>
            </div>

            <!-- Procedural Switch -->
            <div class="flex items-center gap-3 py-0.5">
              <Switch v-model="publishForm.materialIsProcedural" active-color="var(--accent)" />
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
                  @click="openAiCoverGenerator('thumbnail')"
                >
                  <Sparkles class="w-3 h-3 text-violet-400" />
                  AI 生成封面
                </button>
              </div>
              <FileDropZone
                v-model="publishForm.thumbnail"
                accept="image/*"
                height-class="h-16"
                hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
                :progress="thumbnailUploadProgress"
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
          <div
            class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all"
          >
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
                <span
                  v-if="activeSection !== 'copyright'"
                  class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20"
                >
                  {{
                    publishForm.originality
                      ? publishForm.originality === 'ORIGINAL'
                        ? '原创'
                        : '转载'
                      : '未设置原创'
                  }}
                  · {{ publishForm.license || '未设置协议' }}
                </span>
                <component
                  :is="activeSection === 'copyright' ? ChevronUp : ChevronDown"
                  class="h-4 w-4 text-[var(--text-secondary)] shrink-0"
                />
              </div>
            </div>

            <div
              v-show="activeSection === 'copyright'"
              class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4"
            >
              <!-- Originality -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                  >原创属性</span
                >
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_ORIGINALITY_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.originality === opt.value
                        ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800',
                    ]"
                    @click="
                      publishForm.originality =
                        publishForm.originality === opt.value ? '' : opt.value
                    "
                  >
                    {{ label(opt.label_zh, opt.label_en) }}
                  </button>
                </div>
              </div>

              <div
                v-if="publishForm.originality && publishForm.originality !== 'ORIGINAL'"
                class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all"
              >
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
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                    >授权许可协议</span
                  >
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="opt in ASSET_LICENSE_OPTIONS"
                      :key="opt.value"
                      type="button"
                      :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                        publishForm.license === opt.value
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50',
                      ]"
                      @click="
                        publishForm.license = publishForm.license === opt.value ? '' : opt.value
                      "
                    >
                      {{ opt.value }}
                    </button>
                  </div>
                </div>

                <div class="flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                    >下载权限</span
                  >
                  <div class="flex gap-2">
                    <button
                      type="button"
                      :class="[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                        publishForm.isFree === true
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400',
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
                          : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400',
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
          <div
            class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all"
          >
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
                <span
                  v-if="activeSection !== 'specs'"
                  class="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20"
                >
                  {{ publishForm.meshType || '未设置网格' }} · PBR({{
                    publishForm.pbrChannels?.length || 0
                  }})
                </span>
                <component
                  :is="activeSection === 'specs' ? ChevronUp : ChevronDown"
                  class="h-4 w-4 text-[var(--text-secondary)] shrink-0"
                />
              </div>
            </div>

            <div
              v-show="activeSection === 'specs'"
              class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4"
            >
              <!-- Mesh Type -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                  >网格多边形类型</span
                >
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in ASSET_MESHTYPE_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      publishForm.meshType === opt.value
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-600 dark:text-teal-400 font-semibold shadow-sm scale-[1.02]'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50',
                    ]"
                    @click="
                      publishForm.meshType = publishForm.meshType === opt.value ? '' : opt.value
                    "
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
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.uvUnwrapped = !publishForm.uvUnwrapped"
                >
                  <span>已展 UV</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.uvUnwrapped ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.uvOverlapping
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.uvOverlapping = !publishForm.uvOverlapping"
                >
                  <span>UV 重叠</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.uvOverlapping ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.rigged
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.rigged = !publishForm.rigged"
                >
                  <span>骨骼绑定</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.rigged ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>

                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                    publishForm.gameReady
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
                  ]"
                  @click="publishForm.gameReady = !publishForm.gameReady"
                >
                  <span>游戏引擎就绪</span>
                  <span
                    :class="[
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                      publishForm.gameReady ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700',
                    ]"
                    >✓</span
                  >
                </button>
              </div>

              <!-- PBR Maps fast toggle tags -->
              <div class="flex flex-col text-left">
                <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
                  >包含 PBR 材质通道</span
                >
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="map in ASSET_PBR_MAPS_OPTIONS"
                    :key="map"
                    type="button"
                    :class="[
                      'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                      publishForm.pbrChannels?.includes(map)
                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-600 dark:text-teal-300 font-semibold shadow-sm scale-105'
                        : 'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-800 text-slate-400 hover:bg-slate-200/50',
                    ]"
                    @click="togglePbrChannel(map)"
                  >
                    <span class="mr-1">{{
                      publishForm.pbrChannels?.includes(map) ? '✓' : '+'
                    }}</span
                    >{{ map }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <Button
        type="button"
        variant="primary"
        size="lg"
        full-width
        :loading="isPublishing"
        class="publish-submit"
        @click="handlePublish"
      >
        {{ isPublishing ? t('publishDialog.publishing') : t('publishDialog.publishNow') }}
      </Button>
    </template>
  </Modal>

  <!-- AI Cover Generator Dialog -->
  <AiImageGeneratorDialog
    :show="showAiCoverDialog"
    type="cover"
    title="AI 生成封面图"
    @close="showAiCoverDialog = false"
    @save="handleAiCoverSave"
  />
</template>

<style scoped>
:global(.publish-work-modal) {
  width: min(1280px, calc(100vw - 48px));
  height: min(800px, calc(100dvh - 48px));
}

@media (max-width: 640px) {
  :global(.publish-work-modal) {
    width: calc(100vw - 24px);
    height: calc(100dvh - 24px);
  }
}

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
.publish-dialog-shell {
  border: 1px solid var(--border-base);
}
.publish-submit {
  min-height: 42px;
}
</style>
