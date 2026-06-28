<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { logError } from '@/utils/error';
import { Shield, Settings, ChevronDown, ChevronUp, FileArchive, FolderOpen, Folder, Box, FileText, RefreshCw, UploadCloud, Image as ImageIcon } from 'lucide-vue-next';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import api from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import type { CategoryType, UnifiedWork } from '../myWorksModel';
import { parseZipFileNames, buildFileTree, flattenFileTree } from '@/utils/zipHelper';
import {
  ASSET_ORIGINALITY_OPTIONS,
  ASSET_LICENSE_OPTIONS,
  ASSET_MESHTYPE_OPTIONS,
  ASSET_PBR_MAPS_OPTIONS,
} from '../assetLibraryModel';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const label = useLabel();

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
  file?: File | null;
  packageFile?: File | null;
  thumbnail?: File | null;
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
const installGuide = computed({
  get: () => form.value.installGuide || '',
  set: (v) => emitUpdate({ installGuide: v }),
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
const linkedCourseId = computed({
  get: () => form.value.linkedCourseId || '',
  set: (v) => emitUpdate({ linkedCourseId: v }),
});
const linkedLessonId = computed({
  get: () => form.value.linkedLessonId || '',
  set: (v) => emitUpdate({ linkedLessonId: v }),
});

function emitUpdate(patch: Partial<EditForm>) {
  form.value = { ...form.value, ...patch };
}

// File names computed
const fileUploadedName = computed(() => form.value.file?.name || '');
const packageUploadedName = computed(() => form.value.packageFile?.name || '');
const thumbnailUploadedName = computed(() => form.value.thumbnail?.name || '');

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    emitUpdate({ file });
  }
};

const handlePackageChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    emitUpdate({ packageFile: file });
  }
};

const handleThumbnailChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    emitUpdate({ thumbnail: file });
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
    logError('Failed to fetch courses:', err);
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
    logError('Failed to fetch lessons:', err);
    lessons.value = [];
  } finally {
    isLoadingLessons.value = false;
  }
};

const existingVersions = ref<any[]>([]);
const isAddingNewVersion = ref(false);

const fetchExistingVersions = async () => {
  if (props.work?.kind === 'plugin' && props.work?.id) {
    try {
      const { data } = await api.get(`/api/plugins/${props.work.id}/versions`);
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
      logError('Failed to fetch plugin versions:', err);
      existingVersions.value = [];
      isAddingNewVersion.value = true;
    }
  }
};

watch(() => show.value, (newShow) => {
  if (newShow) {
    expandedFolders.value.clear();
    fetchCourses();
    if (form.value.linkedCourseId) {
      fetchLessons(form.value.linkedCourseId);
    }
    if (props.work?.kind === 'plugin') {
      fetchExistingVersions();
    }
  }
});

watch(() => form.value.linkedCourseId, (newCourseId, oldCourseId) => {
  if (newCourseId !== oldCourseId) {
    if (oldCourseId !== undefined && oldCourseId !== null && oldCourseId !== '') {
      form.value.linkedLessonId = '';
    }
    fetchLessons(newCourseId || '');
  }
});

const packageFileList = ref<string[]>([]);
const isParsingZip = ref(false);

const parsedFileTree = computed(() => {
  if (form.value.packageFile) {
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

const expandedFolders = ref<Set<string>>(new Set());
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

const hasPackageFiles = computed(() => {
  if (form.value.packageFile) return true;
  const rawAsset = props.work?.raw as any;
  return !!(rawAsset && (rawAsset.packageUrl || rawAsset.packageFilesList));
});

watch(() => form.value.packageFile, async (newFile) => {
  expandedFolders.value.clear();
  if (!newFile) {
    packageFileList.value = [];
    return;
  }
  isParsingZip.value = true;
  try {
    const list = await parseZipFileNames(newFile);
    packageFileList.value = list;
  } catch (err) {
    logError('Error parsing zip file:', err);
    packageFileList.value = [];
  } finally {
    isParsingZip.value = false;
  }
}, { immediate: true });
</script>

<template>
  <Modal :show="show && !!work" :size="['asset', 'material', 'plugin'].includes(work?.kind || '') ? 'xxl' : 'xl'" glass-card @close="show = false">
    <template #header>
      <div>
        <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
          {{ work?.kind === 'asset' ? '编辑资源库作品' : work?.kind === 'material' ? '编辑材质库作品' : work?.kind === 'plugin' ? '更新插件版本' : '编辑作品' }}
        </h3>
        <p class="text-xs text-[var(--text-muted)] mt-1">
          {{ work?.kind === 'plugin' ? '您可以在此上传新版插件文件并更新版本号，保存后将重新提交审核。' : '保存后会根据内容类型重新提交审核。' }}
        </p>
      </div>
    </template>

    <div v-if="work" :class="['asset', 'material', 'plugin'].includes(work.kind) ? 'modal-scroll-container' : ''">
      <!-- 2-column layout for assets, materials, plugins -->
      <div v-if="['asset', 'material', 'plugin'].includes(work.kind)" class="space-y-4 text-left">
        <!-- Top Row: Inputs (Left) and Description (Right) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <!-- Left Column: File dropzones & Metadata -->
          <div class="space-y-3">
          
          <!-- ASSET file uploaders -->
          <div v-if="work.kind === 'asset'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- GLB model dropzone -->
            <label class="drop-zone block border-dashed border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/[0.02]">
              <input type="file" accept=".glb" @change="handleFileChange" />
              <UploadCloud class="drop-icon" />
              <strong>{{ fileUploadedName || '重新上传主预览模型 (.glb)' }}</strong>
              <span class="text-[9px] text-[var(--text-muted)] mt-0.5">
                {{ form.file ? '已选择新模型' : '当前已有模型。留空将保留原模型。仅支持 .glb' }}
              </span>
            </label>

            <!-- Optional ZIP resource package -->
            <label class="drop-zone block border-dashed border-teal-500/30 hover:border-teal-500/60 bg-teal-500/[0.02]">
              <input type="file" accept=".zip" @change="handlePackageChange" />
              <UploadCloud class="drop-icon text-teal-400" />
              <strong>{{ packageUploadedName || '重新上传可选资源包 (.zip)' }}</strong>
              <span class="text-[9px] text-[var(--text-muted)] mt-0.5">
                {{ form.packageFile ? '已选择新资源包' : '当前已有资源包。留空将保留原资源包。仅支持 .zip' }}
              </span>
            </label>
          </div>

          <!-- MATERIAL file uploaders -->
          <div v-else-if="work.kind === 'material'" class="grid grid-cols-1 gap-4">
            <label class="drop-zone block border-dashed border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/[0.02]">
              <input type="file" accept=".zip,.sbsar" @change="handleFileChange" />
              <UploadCloud class="drop-icon" />
              <strong>{{ fileUploadedName || '重新上传材质包 (.zip, .sbsar)' }}</strong>
              <span class="text-[9px] text-[var(--text-muted)] mt-0.5">
                {{ form.file ? '已选择新材质包' : '当前已有材质包。留空将保留原文件。支持 .zip, .sbsar' }}
              </span>
            </label>
          </div>

          <!-- PLUGIN file uploaders -->
          <div v-else-if="work.kind === 'plugin'" class="grid grid-cols-1 gap-4">
            <label class="drop-zone block border-dashed border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/[0.02]">
              <input type="file" accept=".zip,.py" @change="handleFileChange" />
              <UploadCloud class="drop-icon" />
              <strong>{{ fileUploadedName || '重新上传插件文件 (.zip, .py)' }}</strong>
              <span class="text-[9px] text-[var(--text-muted)] mt-0.5">
                {{ form.file ? '已选择新插件文件' : '当前已有插件文件。留空将保留原文件。支持 .zip, .py' }}
              </span>
            </label>
          </div>

          <!-- ZIP File Explorer inside Edit Modal (Asset only) -->
          <div v-if="work.kind === 'asset' && (isParsingZip || hasPackageFiles)" class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left mt-2 shrink-0">
            <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
              <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                {{ label('源文件压缩包包含', 'Package Contents') }}
                <span v-if="!isParsingZip && parsedFileTree.length > 0">({{ parsedFileTree.length }})</span>
              </span>
              <RefreshCw v-if="isParsingZip" class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0" />
            </div>
            <!-- Loading state -->
            <div v-if="isParsingZip" class="p-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>{{ label('正在读取压缩包目录...', 'Reading package contents...') }}</span>
            </div>
            <!-- File tree -->
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
            <div v-else class="p-4 text-center text-xs text-[var(--text-muted)]">
              <span>压缩包无文件目录或已被清空</span>
            </div>
          </div>

            <div>
              <Input v-model="title" type="text" label="作品名称" required />
            </div>

            <!-- Category and Cover Image Selection -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label v-if="work.kind === 'asset'" class="form-field flex flex-col text-left">
                <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">资源分类</span>
                <el-select
                  v-model="categoryId"
                  size="large"
                  class="w-full custom-dialog-input"
                  placeholder="选择分类"
                >
                  <el-option value="" label="选择分类" />
                  <el-option v-for="category in assetCategories" :key="category.id" :label="category.name" :value="category.id" />
                </el-select>
              </label>

              <label v-else-if="work.kind === 'material'" class="form-field flex flex-col text-left">
                <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">材料分类</span>
                <el-select
                  v-model="materialCategory"
                  size="large"
                  class="w-full custom-dialog-input"
                  placeholder="选择分类"
                >
                  <el-option v-for="category in materialCategories" :key="category" :label="category" :value="category" />
                </el-select>
              </label>

              <label v-else-if="work.kind === 'plugin'" class="form-field flex flex-col text-left">
                <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">插件分类</span>
                <el-select
                  v-model="pluginCategory"
                  size="large"
                  class="w-full custom-dialog-input"
                  placeholder="选择分类"
                >
                  <el-option v-for="category in pluginCategories" :key="category" :label="category" :value="category" />
                </el-select>
              </label>

              <label class="file-picker flex flex-col text-left">
                <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">封面图</span>
                <div class="relative w-full">
                  <input
                    type="file"
                    accept="image/*"
                    class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    @change="handleThumbnailChange"
                  />
                  <div
                    class="glass-input text-xs h-10 rounded-xl text-center font-bold tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-300 flex items-center justify-center gap-1.5 border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer"
                  >
                    <ImageIcon class="h-3.5 w-3.5 text-teal-400" />
                    {{ form.thumbnail?.name || '重新上传可选预览图' }}
                  </div>
                </div>
              </label>
            </div>

            <!-- MATERIAL specifications -->
            <div v-if="work.kind === 'material'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label class="form-field flex flex-col text-left">
                <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">分辨率</span>
                <el-select
                  v-model="resolution"
                  size="large"
                  class="w-full custom-dialog-input"
                >
                  <el-option value="2K" label="2K" />
                  <el-option value="4K" label="4K" />
                  <el-option value="8K" label="8K" />
                  <el-option value="矢量" label="矢量" />
                  <el-option value="程序化" label="程序化" />
                </el-select>
              </label>
              <div class="flex items-center pt-6 pl-1">
                <Checkbox v-model="isProcedural">程序化材质</Checkbox>
              </div>
            </div>

            <!-- PLUGIN specifications -->
            <div v-if="work.kind === 'plugin'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col text-left col-span-1">
                <div v-if="existingVersions.length > 0 && !isAddingNewVersion" class="form-field flex flex-col text-left">
                  <div class="flex justify-between items-center mb-2">
                    <span class="block text-xs font-bold uppercase tracking-wider ml-1 text-[var(--text-secondary)]">版本</span>
                    <button 
                      type="button"
                      class="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
                      @click="isAddingNewVersion = true; pluginVersion = ''"
                    >
                      输入新版本
                    </button>
                  </div>
                  <el-select
                    v-model="pluginVersion"
                    size="large"
                    class="w-full custom-dialog-input"
                    placeholder="选择已发布版本"
                  >
                    <el-option
                      v-for="v in existingVersions"
                      :key="v.id"
                      :label="v.version"
                      :value="v.version"
                    />
                  </el-select>
                </div>
                <div v-else class="form-field flex flex-col text-left">
                  <div class="flex justify-between items-center mb-2">
                    <span class="block text-xs font-bold uppercase tracking-wider ml-1 text-[var(--text-secondary)]">版本</span>
                    <button
                      v-if="existingVersions.length > 0"
                      type="button"
                      class="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
                      @click="isAddingNewVersion = false; pluginVersion = existingVersions[0]?.version || ''"
                    >
                      选择已发布版本
                    </button>
                  </div>
                  <Input v-model="pluginVersion" type="text" placeholder="例如: 1.0.0" />
                </div>
              </div>
              <div class="flex flex-col text-left col-span-1">
                <Input v-model="pluginCompatibility" type="text" label="兼容版本" />
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
              <span class="block text-xs font-bold uppercase tracking-wider mb-1 ml-1 text-[var(--text-secondary)]">
                {{ label('作品说明', 'Asset Description') }}
              </span>
              <MarkdownEditor
                v-model="description"
                placeholder="描述作品用途、制作说明、安装方式或更新内容"
                :height="work?.kind === 'plugin' ? '400px' : '340px'"
                simple
              />
            </div>
          </div>
        </div>

        <!-- Bottom Row: Horizontally Aligned Copyright & Tech Specs Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            
            <!-- Copyright & Licensing Section -->
            <div class="collapsible-card border border-white/10 rounded-xl overflow-hidden glass-panel bg-white/[0.02]">
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
                <component :is="activeSection === 'copyright' ? ChevronUp : ChevronDown" class="h-4 w-4 text-[var(--text-secondary)]" />
              </div>
              
              <div v-show="activeSection === 'copyright'" class="card-body p-4 border-t border-white/5 flex flex-col gap-4">
                <!-- Originality selection -->
                <label class="form-field flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
                    {{ label('原创属性', 'Originality') }}
                  </span>
                  <el-select v-model="originality" size="large" class="w-full custom-dialog-input">
                    <el-option
                      v-for="opt in ASSET_ORIGINALITY_OPTIONS"
                      :key="opt.value"
                      :label="label(opt.label_zh, opt.label_en)"
                      :value="opt.value"
                    />
                  </el-select>
                </label>

                <!-- Attribution fields if not original -->
                <div v-if="originality !== 'ORIGINAL'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all">
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
                    <el-select v-model="license" size="large" class="w-full custom-dialog-input">
                      <el-option
                        v-for="opt in ASSET_LICENSE_OPTIONS"
                        :key="opt.value"
                        :label="label(opt.label_zh, opt.label_en)"
                        :value="opt.value"
                      />
                    </el-select>
                  </label>

                  <!-- Download Permission -->
                  <label class="form-field flex flex-col text-left">
                    <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
                      {{ label('下载权限 (Download)', 'Download Permission') }}
                    </span>
                    <el-select v-model="isFree" size="large" class="w-full custom-dialog-input">
                      <el-option :label="label('免费下载', 'Free Download')" :value="true" />
                      <el-option :label="label('会员专享 (VIP才能下载)', 'VIP Member Only')" :value="false" />
                    </el-select>
                  </label>
                </div>
              </div>
            </div>

            <!-- Technical Specs Section (Asset only) -->
            <div v-if="work.kind === 'asset'" class="collapsible-card border border-white/10 rounded-xl overflow-hidden glass-panel bg-white/[0.02]">
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
                <component :is="activeSection === 'specs' ? ChevronUp : ChevronDown" class="h-4 w-4 text-[var(--text-secondary)]" />
              </div>

              <div v-show="activeSection === 'specs'" class="card-body p-4 border-t border-white/5 flex flex-col gap-4">
                <!-- Mesh Type -->
                <label class="form-field flex flex-col text-left">
                  <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
                    {{ label('网格多边形类型', 'Mesh Type') }}
                  </span>
                  <el-select v-model="meshType" size="large" class="w-full custom-dialog-input">
                    <el-option
                      v-for="opt in ASSET_MESHTYPE_OPTIONS"
                      :key="opt.value"
                      :label="label(opt.label_zh, opt.label_en)"
                      :value="opt.value"
                    />
                  </el-select>
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
                  <el-select
                    v-model="pbrChannels"
                    multiple
                    collapse-tags
                    collapse-tags-tooltip
                    size="large"
                    class="w-full custom-dialog-input"
                    :placeholder="label('选择包含的贴图通道 (PBR)', 'Select included PBR maps')"
                  >
                    <el-option
                      v-for="map in ASSET_PBR_MAPS_OPTIONS"
                      :key="map"
                      :label="map"
                      :value="map"
                    />
                  </el-select>
                </label>

                <!-- Rigged & GameReady checkboxes -->
                <div class="flex gap-6 mt-1">
                  <Checkbox
                    :model-value="rigged"
                    @update:model-value="rigged = $event as boolean"
                  >
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
            <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">展示类型</span>
            <el-select
              v-model="showcaseType"
              size="large"
              class="w-full custom-dialog-input"
            >
              <el-option value="IMAGE" label="图片作品" />
              <el-option value="VIDEO" label="视频作品" />
              <el-option value="MODEL" label="模型展示" />
              <el-option value="TEXT" label="图文作品" />
              <el-option value="OTHER" label="其他" />
            </el-select>
          </label>
          <div v-if="showcaseType === 'VIDEO'" class="col-span-2 sm:col-span-1">
            <Input v-model="videoUrl" type="text" label="视频链接" />
          </div>
        </template>

        <div class="col-span-2">
          <Input v-model="tags" type="text" label="标签" placeholder="用逗号分隔多个标签" />
        </div>

        <label class="form-field wide editor-field col-span-2">
          <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">作品说明</span>
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
        <Button variant="primary" size="sm" :loading="isSaving" @click="emit('save')">
          保存并提交审核
        </Button>
      </div>
    </template>
  </Modal>
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
  flex-wrap: wrap !important;
}
.editor-field :deep(.md-editor-toolbar-wrapper) {
  height: auto !important;
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
  width: 100% !important;
  min-width: 0 !important;
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
