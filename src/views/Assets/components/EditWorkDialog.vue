<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, type Ref } from 'vue';
import { logError, getApiErrorMessage } from '@/utils/error';
import { useTempUpload } from '@/composables/useTempUpload';
import DownloadTypeSegment from '@/components/DownloadTypeSegment.vue';
import ZipFileTreeViewer from '@/components/ZipFileTreeViewer.vue';
import {
  Shield,
  Settings,
  ChevronDown,
  ChevronUp,
  FileArchive,
  FolderOpen,
  Folder,
  Box,
  FileText,
  RefreshCw,
  UploadCloud,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import AiImageGeneratorDialog from '@/components/AiImageGeneratorDialog.vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import api from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import { useSystemStore } from '@/stores/system';
import type { CategoryType, UnifiedWork } from '../myWorksModel';
import { parseZipFileNames, buildFileTree, flattenFileTree } from '@/utils/zipHelper';
import { useFileTree } from '@/composables/useFileTree';
import {
  ASSET_ORIGINALITY_OPTIONS,
  ASSET_LICENSE_OPTIONS,
  ASSET_MESHTYPE_OPTIONS,
  ASSET_PBR_MAPS_OPTIONS,
} from '../assetLibraryModel';

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

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const label = useLabel();
const systemStore = useSystemStore();

interface EditForm {
  title: string;
  description: string;
  tags: string;
  categoryId: string;
  materialCategory: string;
  resolution: string;
  isProcedural: boolean;
  pluginCategory: string;
  pluginVersion: string;
  pluginCompatibility: string;
  showcaseType: string;
  videoUrl: string;
  // asset-specific fields
  originality?: string;
  originalAuthor?: string;
  originalLink?: string;
  license?: string;
  isFree?: boolean;
  meshType?: string;
  uvUnwrapped?: boolean;
  uvOverlapping?: boolean;
  pbrChannels?: string[];
  rigged?: boolean;
  gameReady?: boolean;
  linkedCourseId?: string;
  linkedLessonId?: string;
  installGuide?: string;
  // asset files
  file: File | null;
  packageFile: File | null;
  thumbnail: File | null;
  downloadType?: 'local' | 'external';
  externalUrl?: string;
  extractionCode?: string;
  tempAssetPath?: string;
  tempPackagePath?: string;
  tempThumbnailPath?: string;
  tempMaterialPath?: string;
  tempPluginPath?: string;
  tempPreviewPath?: string;
  tempSoftwarePath?: string;
  packageFilesList?: string;
  fileSize?: number;
  packageSize?: number;
}

const show = defineModel<boolean>('show', { required: true });
const form = defineModel<EditForm>('form', { required: true });

const props = defineProps<{
  work: UnifiedWork | null;
  isSaving: boolean;
  assetCategories: CategoryType[];
  materialCategories: string[];
  pluginCategories: string[];
}>();

const emit = defineEmits<{
  save: [];
  cancel: [];
}>();

const title = computed({
  get: () => form.value.title,
  set: (v) => emitUpdate({ title: v }),
});
const description = computed({
  get: () => form.value.description,
  set: (v) => emitUpdate({ description: v }),
});
const tags = computed({
  get: () => form.value.tags,
  set: (v) => emitUpdate({ tags: v }),
});
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
const showcaseType = computed({
  get: () => form.value.showcaseType,
  set: (v) => emitUpdate({ showcaseType: v }),
});
const videoUrl = computed({
  get: () => form.value.videoUrl,
  set: (v) => emitUpdate({ videoUrl: v }),
});

// asset computed properties
const originality = computed({
  get: () => form.value.originality || 'ORIGINAL',
  set: (v) => emitUpdate({ originality: v }),
});
const originalAuthor = computed({
  get: () => form.value.originalAuthor || '',
  set: (v) => emitUpdate({ originalAuthor: v }),
});
const originalLink = computed({
  get: () => form.value.originalLink || '',
  set: (v) => emitUpdate({ originalLink: v }),
});
const license = computed({
  get: () => form.value.license || 'CC_BY',
  set: (v) => emitUpdate({ license: v }),
});
const isFree = computed({
  get: () => form.value.isFree !== false,
  set: (v) => emitUpdate({ isFree: v }),
});
const meshType = computed({
  get: () => form.value.meshType || 'LOW_POLY',
  set: (v) => emitUpdate({ meshType: v }),
});
const uvUnwrapped = computed({
  get: () => form.value.uvUnwrapped !== false,
  set: (v) => emitUpdate({ uvUnwrapped: v }),
});
const uvOverlapping = computed({
  get: () => !!form.value.uvOverlapping,
  set: (v) => emitUpdate({ uvOverlapping: v }),
});
const pbrChannels = computed({
  get: () => form.value.pbrChannels || [],
  set: (v) => emitUpdate({ pbrChannels: v }),
});
const rigged = computed({
  get: () => !!form.value.rigged,
  set: (v) => emitUpdate({ rigged: v }),
});
const gameReady = computed({
  get: () => !!form.value.gameReady,
  set: (v) => emitUpdate({ gameReady: v }),
});

function emitUpdate(patch: Partial<EditForm>) {
  form.value = { ...form.value, ...patch };
}

// File names computed
const fileUploadedName = computed(() => form.value.file?.name || '');
const packageUploadedName = computed(() => form.value.packageFile?.name || '');

const downloadType = computed({
  get: () => form.value.downloadType || 'local',
  set: (v) => emitUpdate({ downloadType: v }),
});

const externalUrl = computed({
  get: () => form.value.externalUrl || '',
  set: (v) => emitUpdate({ externalUrl: v }),
});

const extractionCode = computed({
  get: () => form.value.extractionCode || '',
  set: (v) => emitUpdate({ extractionCode: v }),
});

const fileProgress = ref<number | null>(null);
const packageProgress = ref<number | null>(null);
const thumbnailProgress = ref<number | null>(null);
const isSaved = ref(false);

const { uploadFile: doUpload, cancelUpload } = useTempUpload();

const uploadFile = async (
  file: File,
  progressRef: Ref<number | null>,
  tempField:
    | 'tempAssetPath'
    | 'tempPackagePath'
    | 'tempThumbnailPath'
    | 'tempMaterialPath'
    | 'tempPluginPath'
    | 'tempPreviewPath'
    | 'tempSoftwarePath',
): Promise<boolean> => {
  let fieldname = 'temp';
  if (tempField === 'tempAssetPath') fieldname = 'asset';
  else if (tempField === 'tempPackagePath') fieldname = 'package';
  else if (tempField === 'tempThumbnailPath') fieldname = 'thumbnail';
  else if (tempField === 'tempMaterialPath') fieldname = 'material';
  else if (tempField === 'tempPluginPath') fieldname = 'plugin';
  else if (tempField === 'tempPreviewPath') fieldname = 'preview';
  else if (tempField === 'tempSoftwarePath') fieldname = 'software';

  return doUpload(
    file,
    progressRef,
    (filePath) => {
      emitUpdate({ [tempField]: filePath });
    },
    () => form.value[tempField],
    fieldname,
  );
};

const cancelAllTempUploads = () => {
  const tempFields: (
    | 'tempAssetPath'
    | 'tempPackagePath'
    | 'tempThumbnailPath'
    | 'tempMaterialPath'
    | 'tempPluginPath'
    | 'tempPreviewPath'
    | 'tempSoftwarePath'
  )[] = [
    'tempAssetPath',
    'tempPackagePath',
    'tempThumbnailPath',
    'tempMaterialPath',
    'tempPluginPath',
    'tempPreviewPath',
    'tempSoftwarePath',
  ];
  for (const field of tempFields) {
    const path = form.value[field];
    if (path) {
      cancelUpload(path);
    }
  }

  fileProgress.value = null;
  packageProgress.value = null;
  thumbnailProgress.value = null;

  emitUpdate({
    tempAssetPath: undefined,
    tempPackagePath: undefined,
    tempThumbnailPath: undefined,
    tempMaterialPath: undefined,
    tempPluginPath: undefined,
    tempPreviewPath: undefined,
  });
};

watch(show, (newVal) => {
  if (!newVal) {
    if (!isSaved.value) {
      cancelAllTempUploads();
    }
    isSaved.value = false;
  }
});

const handleFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    emitUpdate({ file, fileSize: file.size });
    const kind = props.work?.kind;
    const tempField =
      kind === 'asset'
        ? 'tempAssetPath'
        : kind === 'material'
          ? 'tempMaterialPath'
          : kind === 'plugin'
            ? 'tempPluginPath'
            : 'tempSoftwarePath';
    await uploadFile(file, fileProgress, tempField);
  }
};

const handlePackageChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    emitUpdate({ packageFile: file, packageSize: file.size });
    await uploadFile(file, packageProgress, 'tempPackagePath');
  }
};

const showAiCoverDialog = ref(false);

const handleThumbnailChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    emitUpdate({ thumbnail: file });
    const kind = props.work?.kind;
    const tempField =
      kind === 'plugin' || kind === 'software' ? 'tempPreviewPath' : 'tempThumbnailPath';
    const success = await uploadFile(file, thumbnailProgress, tempField);
    if (success) {
      ElMessage.success('封面图上传成功！');
    } else {
      emitUpdate({ thumbnail: null });
    }
  }
};

const handleAiCoverSave = async (file: File) => {
  emitUpdate({ thumbnail: file });
  const kind = props.work?.kind;
  const tempField =
    kind === 'plugin' || kind === 'software' ? 'tempPreviewPath' : 'tempThumbnailPath';
  const success = await uploadFile(file, thumbnailProgress, tempField);
  if (success) {
    ElMessage.success('已自动应用 AI 生成的封面图！');
  } else {
    emitUpdate({ thumbnail: null });
  }
};

// LMS integration logic
const courses = ref<any[]>([]);
const lessons = ref<any[]>([]);
const isLoadingCourses = ref(false);
const isLoadingLessons = ref(false);
const activeSection = ref<'copyright' | 'specs' | 'learning' | null>(null);

const toggleSection = (sec: 'copyright' | 'specs' | 'learning') => {
  activeSection.value = activeSection.value === sec ? null : sec;
};

const fetchCourses = async () => {
  try {
    isLoadingCourses.value = true;
    const { data } = await api.get('/api/courses');
    courses.value = data.courses || data || [];
  } catch (err) {
    logError(err, { operation: 'fetch courses' });
  } finally {
    isLoadingCourses.value = false;
  }
};

const fetchLessons = async (courseId: string) => {
  if (!courseId) {
    lessons.value = [];
    return;
  }
  try {
    isLoadingLessons.value = true;
    const { data } = await api.get(`/api/courses/${courseId}`);
    lessons.value = data.lessons || data.course?.lessons || [];
  } catch (err) {
    logError(err, { operation: 'fetch lessons' });
    lessons.value = [];
  } finally {
    isLoadingLessons.value = false;
  }
};

const existingVersions = ref<any[]>([]);
const isAddingNewVersion = ref(false);

const fetchExistingVersions = async () => {
  if ((props.work?.kind === 'plugin' || props.work?.kind === 'software') && props.work?.id) {
    try {
      const pathSegment = props.work.kind === 'plugin' ? 'plugins' : 'softwares';
      const { data } = await api.get(`/api/${pathSegment}/${props.work.id}/versions`);
      existingVersions.value = data || [];
      if (existingVersions.value.length > 0) {
        const currentVer = form.value.pluginVersion;
        const exists = existingVersions.value.some((v: any) => v.version === currentVer);
        if (exists) {
          isAddingNewVersion.value = false;
        } else {
          isAddingNewVersion.value = true;
        }
      } else {
        isAddingNewVersion.value = true;
      }
    } catch (err) {
      logError(err, { operation: 'fetch plugin versions' });
      existingVersions.value = [];
      isAddingNewVersion.value = true;
    }
  }
};

watch(
  () => show.value,
  (newShow) => {
    if (newShow) {
      resetExpansion();
      fetchCourses();
      if (form.value.linkedCourseId) {
        fetchLessons(form.value.linkedCourseId);
      }
      if (props.work?.kind === 'plugin' || props.work?.kind === 'software') {
        fetchExistingVersions();
      }
    }
  },
);

watch(
  () => form.value.linkedCourseId,
  (newCourseId, oldCourseId) => {
    if (newCourseId !== oldCourseId) {
      if (oldCourseId !== undefined && oldCourseId !== null && oldCourseId !== '') {
        form.value.linkedLessonId = '';
      }
      fetchLessons(newCourseId || '');
    }
  },
);

const packageFileList = ref<string[]>([]);
const isParsingZip = ref(false);

const activeZipFile = computed(() => {
  if (props.work?.kind === 'asset') return form.value.packageFile;
  return form.value.file;
});

const parsedFileTree = computed(() => {
  if (activeZipFile.value) {
    const tree = buildFileTree(packageFileList.value);
    return flattenFileTree(tree);
  }
  const rawAsset = props.work?.raw as any;
  if (rawAsset && rawAsset.packageFilesList) {
    try {
      let list: string[] = [];
      if (typeof rawAsset.packageFilesList === 'string') {
        list = JSON.parse(rawAsset.packageFilesList);
      } else if (Array.isArray(rawAsset.packageFilesList)) {
        list = rawAsset.packageFilesList;
      }
      const tree = buildFileTree(list);
      return flattenFileTree(tree);
    } catch {
      return [];
    }
  }
  return [];
});

const { expandedFolders, toggleFolder, visibleFileNodes, resetExpansion } =
  useFileTree(parsedFileTree);

const hasPackageFiles = computed(() => {
  if (activeZipFile.value) return true;
  const rawAsset = props.work?.raw as any;
  return !!(rawAsset && (rawAsset.packageUrl || rawAsset.fileUrl || rawAsset.packageFilesList));
});

watch(
  activeZipFile,
  async (newFile) => {
    resetExpansion();
    if (!newFile) {
      packageFileList.value = [];
      emitUpdate({ packageFilesList: undefined });
      return;
    }
    const isZip = newFile.name.toLowerCase().endsWith('.zip');
    if (isZip) {
      isParsingZip.value = true;
      try {
        const list = await parseZipFileNames(newFile);
        packageFileList.value = list;
        emitUpdate({ packageFilesList: JSON.stringify(list) });
      } catch (err) {
        logError(err, { operation: 'parse zip file' });
        packageFileList.value = [];
        emitUpdate({ packageFilesList: undefined });
      } finally {
        isParsingZip.value = false;
      }
    } else {
      packageFileList.value = [];
      emitUpdate({ packageFilesList: undefined });
    }
  },
  { immediate: true },
);
</script>

<template>
  <Modal
    :show="show && !!work"
    :size="['asset', 'material', 'plugin', 'software'].includes(work?.kind || '') ? 'xxl' : 'xl'"
    @close="show = false"
  >
    <template #header>
      <div>
        <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
          {{
            work?.kind === 'asset'
              ? '编辑资源库作品'
              : work?.kind === 'material'
                ? '编辑材质库作品'
                : work?.kind === 'plugin' || work?.kind === 'software'
                  ? '更新插件版本'
                  : '编辑作品'
          }}
        </h3>
        <p class="text-xs text-[var(--text-muted)] mt-1">
          {{
            work?.kind === 'plugin' || work?.kind === 'software'
              ? '您可以在此上传新版插件文件并更新版本号，保存后将重新提交审核。'
              : '保存后会根据内容类型重新提交审核。'
          }}
        </p>
      </div>
    </template>

    <div
      v-if="work"
      :class="
        ['asset', 'material', 'plugin', 'software'].includes(work.kind)
          ? 'modal-scroll-container'
          : ''
      "
    >
      <!-- 2-column layout for assets, materials, plugins -->
      <div
        v-if="['asset', 'material', 'plugin', 'software'].includes(work.kind)"
        class="space-y-4 text-left"
      >
        <!-- Top Row: Inputs (Left) and Description (Right) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <!-- Left Column: File dropzones & Metadata -->
          <div class="space-y-3">
            <!-- Segment Switcher for Download Type -->
            <div
              class="flex p-0.5 mb-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-800/80"
            >
              <button
                type="button"
                @click="form.downloadType = 'local'"
                :class="[
                  'flex-1 py-1 text-xs font-semibold rounded-lg transition-all',
                  form.downloadType === 'local'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400',
                ]"
              >
                本地文件上传
              </button>
              <button
                type="button"
                @click="form.downloadType = 'external'"
                :class="[
                  'flex-1 py-1 text-xs font-semibold rounded-lg transition-all',
                  form.downloadType === 'external'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400',
                ]"
              >
                网盘链接 / 网页直达
              </button>
            </div>

            <!-- Local Upload Zone -->
            <div v-show="form.downloadType === 'local'">
              <!-- ASSET file uploaders -->
              <div v-if="work.kind === 'asset'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- GLB model dropzone -->
                <FileDropZone
                  v-model="form.file"
                  accept=".glb"
                  height-class="h-24"
                  :progress="fileProgress"
                  :label="
                    form.file ? form.file.name : fileUploadedName || '重新上传主预览模型 (.glb)'
                  "
                  sublabel="当前已有模型。留空将保留原模型。仅支持 .glb"
                  @change="handleFileChange"
                />

                <!-- Optional ZIP resource package -->
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
                  @change="handlePackageChange"
                />
              </div>

              <!-- MATERIAL file uploaders -->
              <div v-else-if="work.kind === 'material'" class="grid grid-cols-1 gap-4">
                <FileDropZone
                  v-model="form.file"
                  accept=".zip,.sbsar"
                  height-class="h-24"
                  :progress="fileProgress"
                  :label="
                    form.file ? form.file.name : fileUploadedName || '重新上传材质包 (.zip, .sbsar)'
                  "
                  sublabel="当前已有材质包。留空将保留原文件。支持 .zip, .sbsar"
                  @change="handleFileChange"
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
                    work.kind === 'plugin'
                      ? '.zip,.py'
                      : '.exe,.msi,.dmg,.pkg,.deb,.rpm,.zip,.rar,.7z'
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
                  @change="handleFileChange"
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
              @toggle="toggleFolder"
            />

            <div>
              <Input v-model="title" type="text" label="作品名称" required />
            </div>

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

              <label
                v-else-if="work.kind === 'material'"
                class="form-field flex flex-col text-left"
              >
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
                      : systemStore.settings.SOFTWARE_CATEGORIES || [
                          '3D 建模与雕刻软件',
                          '渲染引擎与渲染器',
                          '后期与图像处理',
                          '游戏与交互引擎',
                          '其他工具',
                        ]"
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
                    @click="showAiCoverDialog = true"
                  >
                    <Sparkles class="w-3 h-3 text-violet-400" />
                    AI 生成封面
                  </button>
                </div>
                <FileDropZone
                  v-model="form.thumbnail"
                  accept="image/*"
                  height-class="h-16"
                  :progress="thumbnailProgress"
                  :preview-url="props.work?.thumbnail"
                  :label="form.thumbnail ? form.thumbnail.name : '重新上传可选预览图'"
                  @change="handleThumbnailChange"
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
                  <SelectOption value="2K" label="2K" />
                  <SelectOption value="4K" label="4K" />
                  <SelectOption value="8K" label="8K" />
                  <SelectOption value="矢量" label="矢量" />
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
                      @click="
                        isAddingNewVersion = true;
                        pluginVersion = '';
                      "
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
                      @click="
                        isAddingNewVersion = false;
                        pluginVersion = existingVersions[0]?.version || '';
                      "
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
                    v-for="ver in work?.kind === 'plugin'
                      ? blenderVersions
                      : ['Windows 10/11', 'macOS', 'Linux', 'Android', 'iOS', '跨平台']"
                    :key="ver"
                    :label="ver"
                    :value="ver"
                  />
                </Select>
              </div>
            </div>

            <!-- Tags -->
            <div>
              <Input v-model="tags" type="text" label="标签" placeholder="用逗号分隔多个标签" />
            </div>
          </div>

          <!-- Right Column: Description (Markdown Editor) -->
          <div>
            <div class="form-field editor-field text-left">
              <span
                class="block text-xs font-bold uppercase tracking-wider mb-1 ml-1 text-[var(--text-secondary)]"
              >
                {{ label('作品说明', 'Asset Description') }}
              </span>
              <MarkdownEditor
                v-model="description"
                placeholder="描述作品用途、制作说明、安装方式或更新内容"
                :height="work?.kind === 'plugin' || work?.kind === 'software' ? '400px' : '340px'"
                simple
              />
            </div>
          </div>
        </div>

        <!-- Bottom Row: Horizontally Aligned Copyright & Tech Specs Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <!-- Copyright & Licensing Section -->
          <div
            class="collapsible-card border border-white/10 rounded-xl overflow-hidden glass-panel bg-white/[0.02]"
          >
            <div
              class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-white/[0.03] transition-colors"
              @click="toggleSection('copyright')"
            >
              <div class="flex items-center gap-2">
                <Shield class="h-4 w-4 text-indigo-400" />
                <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {{ label('版权与许可声明', 'Copyright & Licensing') }}
                </span>
              </div>
              <component
                :is="activeSection === 'copyright' ? ChevronUp : ChevronDown"
                class="h-4 w-4 text-[var(--text-secondary)]"
              />
            </div>

            <div
              v-show="activeSection === 'copyright'"
              class="card-body p-4 border-t border-white/5 flex flex-col gap-4"
            >
              <!-- Originality selection -->
              <label class="form-field flex flex-col text-left">
                <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
                  {{ label('原创属性', 'Originality') }}
                </span>
                <Select v-model="originality" size="large" class="w-full custom-dialog-input">
                  <SelectOption
                    v-for="opt in ASSET_ORIGINALITY_OPTIONS"
                    :key="opt.value"
                    :label="label(opt.label_zh, opt.label_en)"
                    :value="opt.value"
                  />
                </Select>
              </label>

              <!-- Attribution fields if not original -->
              <div
                v-if="originality !== 'ORIGINAL'"
                class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all"
              >
                <Input
                  v-model="originalAuthor"
                  type="text"
                  :label="label('原作者姓名/署名', 'Original Author')"
                  placeholder="e.g. SketchUp Studio"
                />
                <Input
                  v-model="originalLink"
                  type="url"
                  :label="label('原作者作品链接', 'Original URL')"
                  placeholder="https://..."
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <!-- License selection -->
                <label class="form-field flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
                    {{ label('授权许可协议 (License)', 'Distribution License') }}
                  </span>
                  <Select v-model="license" size="large" class="w-full custom-dialog-input">
                    <SelectOption
                      v-for="opt in ASSET_LICENSE_OPTIONS"
                      :key="opt.value"
                      :label="label(opt.label_zh, opt.label_en)"
                      :value="opt.value"
                    />
                  </Select>
                </label>

                <!-- Download Permission -->
                <label class="form-field flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
                    {{ label('下载权限 (Download)', 'Download Permission') }}
                  </span>
                  <Select v-model="isFree" size="large" class="w-full custom-dialog-input">
                    <SelectOption :label="label('免费下载', 'Free Download')" :value="true" />
                    <SelectOption
                      :label="label('会员专享 (VIP才能下载)', 'VIP Member Only')"
                      :value="false"
                    />
                  </Select>
                </label>
              </div>
            </div>
          </div>

          <!-- Technical Specs Section (Asset only) -->
          <div
            v-if="work.kind === 'asset'"
            class="collapsible-card border border-white/10 rounded-xl overflow-hidden glass-panel bg-white/[0.02]"
          >
            <div
              class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-white/[0.03] transition-colors"
              @click="toggleSection('specs')"
            >
              <div class="flex items-center gap-2">
                <Settings class="h-4 w-4 text-teal-400" />
                <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {{ label('技术参数与规格', 'Technical Specifications') }}
                </span>
              </div>
              <component
                :is="activeSection === 'specs' ? ChevronUp : ChevronDown"
                class="h-4 w-4 text-[var(--text-secondary)]"
              />
            </div>

            <div
              v-show="activeSection === 'specs'"
              class="card-body p-4 border-t border-white/5 flex flex-col gap-4"
            >
              <!-- Mesh Type -->
              <label class="form-field flex flex-col text-left">
                <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
                  {{ label('网格多边形类型', 'Mesh Type') }}
                </span>
                <Select v-model="meshType" size="large" class="w-full custom-dialog-input">
                  <SelectOption
                    v-for="opt in ASSET_MESHTYPE_OPTIONS"
                    :key="opt.value"
                    :label="label(opt.label_zh, opt.label_en)"
                    :value="opt.value"
                  />
                </Select>
              </label>

              <!-- UV checkboxes -->
              <div class="flex gap-6 mt-1 mb-1">
                <Checkbox
                  :model-value="uvUnwrapped"
                  @update:model-value="uvUnwrapped = $event as boolean"
                >
                  {{ label('已展 UV (UV Unwrapped)', 'UV Unwrapped') }}
                </Checkbox>
                <Checkbox
                  :model-value="uvOverlapping"
                  @update:model-value="uvOverlapping = $event as boolean"
                >
                  {{ label('UV 重叠 (Overlapping UVs)', 'Overlapping UVs') }}
                </Checkbox>
              </div>

              <!-- PBR channels checklist -->
              <label class="form-field flex flex-col text-left">
                <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
                  {{ label('包含 PBR 材质通道 (PBR Maps)', 'PBR Texture Channels') }}
                </span>
                <Select
                  v-model="pbrChannels"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  size="large"
                  class="w-full custom-dialog-input"
                  :placeholder="label('选择包含的贴图通道 (PBR)', 'Select included PBR maps')"
                >
                  <SelectOption
                    v-for="map in ASSET_PBR_MAPS_OPTIONS"
                    :key="map"
                    :label="map"
                    :value="map"
                  />
                </Select>
              </label>

              <!-- Rigged & GameReady checkboxes -->
              <div class="flex gap-6 mt-1">
                <Checkbox :model-value="rigged" @update:model-value="rigged = $event as boolean">
                  {{ label('骨骼绑定 (Rigged)', 'Rigged') }}
                </Checkbox>
                <Checkbox
                  :model-value="gameReady"
                  @update:model-value="gameReady = $event as boolean"
                >
                  {{ label('游戏引擎就绪 (Game Ready)', 'Game Ready') }}
                </Checkbox>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Keep original single-column grid for showcase and other non-standard types -->
      <div v-else class="edit-grid">
        <div class="col-span-2">
          <Input v-model="title" type="text" label="作品名称" required />
        </div>

        <template v-if="work.kind === 'showcase'">
          <label class="form-field flex flex-col col-span-2 sm:col-span-1">
            <span
              class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
              >展示类型</span
            >
            <Select v-model="showcaseType" size="large" class="w-full custom-dialog-input">
              <SelectOption value="IMAGE" label="图片作品" />
              <SelectOption value="VIDEO" label="视频作品" />
              <SelectOption value="MODEL" label="模型展示" />
              <SelectOption value="TEXT" label="图文作品" />
              <SelectOption value="OTHER" label="其他" />
            </Select>
          </label>
          <div v-if="showcaseType === 'VIDEO'" class="col-span-2 sm:col-span-1">
            <Input v-model="videoUrl" type="text" label="视频链接" />
          </div>
        </template>

        <div class="col-span-2">
          <Input v-model="tags" type="text" label="标签" placeholder="用逗号分隔多个标签" />
        </div>

        <label class="form-field wide editor-field col-span-2">
          <span
            class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
            >作品说明</span
          >
          <MarkdownEditor
            v-model="description"
            height="280px"
            placeholder="描述作品用途、制作说明、安装方式 or 更新内容"
            simple
          />
        </label>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="show = false"> 取消 </Button>
        <Button
          variant="primary"
          size="sm"
          :loading="isSaving"
          @click="
            () => {
              isSaved = true;
              emit('save');
            }
          "
        >
          保存并提交审核
        </Button>
      </div>
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
.upload-grid {
  display: flex;
  gap: 20px;
  margin-top: 12px;
}

.upload-column-left,
.upload-column-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.upload-column-left {
  flex: 0.95;
}

.upload-column-right {
  flex: 1.05;
}

.drop-zone {
  position: relative;
  display: grid;
  place-items: center;
  gap: 4px;
  min-height: 96px;
  border: 1px dashed var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  text-align: center;
  cursor: pointer;
  padding: 10px;
}

.modal-scroll-container {
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  padding-right: 6px;
}

.modal-scroll-container::-webkit-scrollbar {
  width: 6px;
}
.modal-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}
.modal-scroll-container::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 3px;
}
.modal-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.editor-field :deep(.md-editor-toolbar) {
  flex-wrap: wrap;
}
.editor-field :deep(.md-editor-toolbar-wrapper) {
  height: auto;
}

.drop-zone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop-icon {
  width: 24px;
  height: 24px;
  color: var(--accent);
}

.drop-zone strong {
  max-width: 90%;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drop-zone span {
  color: var(--text-muted);
  font-size: 10px;
}

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

.file-picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.editor-field {
  width: 100%;
  min-width: 0;
}

.editor-field :deep(.mdw),
.editor-field :deep(.md-editor) {
  width: 100%;
  min-width: 0;
}

@media (max-width: 680px) {
  .upload-grid {
    flex-direction: column;
  }
  .edit-grid {
    grid-template-columns: 1fr;
  }
}
</style>
