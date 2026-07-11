import { computed, onMounted, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { UploadCloud, Layers, Puzzle, Laptop } from 'lucide-vue-next';
import { logError } from '@/utils/error';
import { toast } from '@/utils/feedbackAdapter';
import api from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import { useMobile } from '@/composables/useMobile';
import { useSystemStore } from '@/stores/system';
import { useTempUpload } from '@/composables/useTempUpload';
import { useFileTree } from '@/composables/useFileTree';
import { parseZipFileNames, buildFileTree, flattenFileTree } from '@/utils/zipHelper';
import {
  createDefaultPublishForm,
  isValidPublishCategory,
  submitPublishWork,
  type AssetCategory,
  type InitialPublishData,
  type PublishCategory,
  type PublishForm,
  type TempUploadPaths,
} from '@/components/publish/publishWorkSchema'; /** Props accepted by the host PublishWorkDialog component. */
export interface PublishWorkDialogProps {
  modelValue: boolean;
  defaultCategory?: string;
  initialData?: InitialPublishData;
} /** Emit signature of the host PublishWorkDialog component. */
export type PublishWorkDialogEmit = {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'published'): void;
};
export function usePublishWork(props: PublishWorkDialogProps, emit: PublishWorkDialogEmit) {
  const { t } = useI18n();
  const label = useLabel();
  const { isMobile } = useMobile();
  const systemStore = useSystemStore();
  const isPublishing = ref(false);
  const publishCategory = ref<PublishCategory>('asset');
  const assetCategories = ref<AssetCategory[]>([]);
  const publishForm = ref<PublishForm>(createDefaultPublishForm());
  const activeSection = ref<'copyright' | 'specs' | null>(null);
  const toggleSection = (section: 'copyright' | 'specs') => {
    activeSection.value = activeSection.value === section ? null : section;
  };
  const togglePbrChannel = (map: string) => {
    const channels = publishForm.value.pbrChannels || (publishForm.value.pbrChannels = []);
    const idx = channels.indexOf(map);
    if (idx >= 0) channels.splice(idx, 1);
    else channels.push(map);
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
  const tempUploadRefs = [
    { path: tempAssetPath, progress: assetUploadProgress },
    { path: tempPluginPath, progress: pluginUploadProgress },
    { path: tempPluginPreviewPath, progress: pluginPreviewUploadProgress },
    { path: tempMaterialPath, progress: materialUploadProgress },
    { path: tempThumbnailPath, progress: thumbnailUploadProgress },
  ];
  const showAiCoverDialog = ref(false);
  const activeCoverTarget = ref<'thumbnail' | 'pluginPreview'>('thumbnail');
  const openAiCoverGenerator = (target: 'thumbnail' | 'pluginPreview' = 'thumbnail') => {
    activeCoverTarget.value = target;
    showAiCoverDialog.value = true;
  };
  const { uploadFile: doUpload, cancelUpload } = useTempUpload();
  const uploadFile = (
    file: File,
    progressRef: Ref<number | null>,
    pathRef: Ref<string | null>,
    fieldname?: string,
  ) =>
    doUpload(
      file,
      progressRef,
      (p) => {
        pathRef.value = p;
      },
      () => pathRef.value,
      fieldname,
    );
  const cancelAllTempUploads = () => {
    for (const { path, progress } of tempUploadRefs) {
      if (path.value) cancelUpload(path.value);
      path.value = null;
      progress.value = null;
    }
  };
  const collectTempPaths = (): TempUploadPaths => ({
    asset: tempAssetPath.value,
    plugin: tempPluginPath.value,
    pluginPreview: tempPluginPreviewPath.value,
    material: tempMaterialPath.value,
    thumbnail: tempThumbnailPath.value,
  });
  const categoryTabs = computed(() => [
    { value: 'asset', label: label('上传3D模型', 'Upload 3D Model'), icon: UploadCloud },
    { value: 'material', label: label('上传材质', 'Upload Material'), icon: Layers },
    { value: 'plugin', label: label('上传插件', 'Upload Plugin'), icon: Puzzle },
    { value: 'software', label: label('上传软件', 'Upload Software'), icon: Laptop },
  ]);
  const activeCategoryLabel = computed(
    () => categoryTabs.value.find((tab) => tab.value === publishCategory.value)?.label ?? '',
  );
  const activeUploadFile = computed(() => {
    if (publishForm.value.downloadType === 'external') return null;
    if (publishCategory.value === 'asset') return publishForm.value.assetFile;
    if (publishCategory.value === 'material') return publishForm.value.materialFile;
    if (publishCategory.value === 'plugin' || publishCategory.value === 'software')
      return publishForm.value.pluginFile;
    return null;
  });
  const parsedFileTree = computed(() => {
    const file = activeUploadFile.value;
    if (!file) return [];
    if (packageFileList.value.length > 0)
      return flattenFileTree(buildFileTree(packageFileList.value));
    return [{ name: file.name, path: file.name, isFolder: false, level: 0 }];
  });
  const { expandedFolders, toggleFolder, visibleFileNodes, resetExpansion } =
    useFileTree(parsedFileTree);
  const materialCategories = computed(() =>
    (systemStore.settings.MATERIAL_CATEGORIES || []).filter(
      (c) => c !== '全部材料' && c !== '全部',
    ),
  );
  watch(activeUploadFile, async (newFile) => {
    resetExpansion();
    if (!newFile || !newFile.name.toLowerCase().endsWith('.zip')) {
      packageFileList.value = [];
      return;
    }
    isParsingZip.value = true;
    try {
      packageFileList.value = await parseZipFileNames(newFile);
    } catch (err) {
      logError(err, { operation: 'Error parsing zip file in publish dialog' });
      packageFileList.value = [];
    } finally {
      isParsingZip.value = false;
    }
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
    publishCategory.value = isValidPublishCategory(props.defaultCategory)
      ? props.defaultCategory
      : 'asset';
    if (props.initialData) {
      publishForm.value = { ...publishForm.value, ...props.initialData };
    }
    await Promise.all([fetchCategories(), systemStore.fetchSettings()]);
  };
  watch(
    () => props.modelValue,
    async (val) => {
      if (val) await initDialog();
    },
  );
  watch(
    () => props.defaultCategory,
    (cat) => {
      if (props.modelValue && cat) {
        publishCategory.value = isValidPublishCategory(cat) ? cat : 'asset';
      }
    },
  );
  const attachUploadedFile = async (
    e: Event,
    assign: (file: File) => void,
    progressRef: Ref<number | null>,
    pathRef: Ref<string | null>,
    fieldname: string,
    deriveTitle?: (file: File) => string,
  ) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    assign(file);
    if (deriveTitle && !publishForm.value.title) {
      publishForm.value.title = deriveTitle(file);
    }
    await uploadFile(file, progressRef, pathRef, fieldname);
  };
  const handleThumbnailChange = (e: Event) =>
    attachUploadedFile(
      e,
      (f) => (publishForm.value.thumbnail = f),
      thumbnailUploadProgress,
      tempThumbnailPath,
      'thumbnail',
    );
  const handleAssetFileChange = (e: Event) =>
    attachUploadedFile(
      e,
      (f) => (publishForm.value.assetFile = f),
      assetUploadProgress,
      tempAssetPath,
      'asset',
      (f) => f.name.split('.')[0],
    );
  const handlePluginFileChange = (e: Event) =>
    attachUploadedFile(
      e,
      (f) => (publishForm.value.pluginFile = f),
      pluginUploadProgress,
      tempPluginPath,
      'plugin',
      (f) => f.name.replace(/\.[^.]+$/, ''),
    );
  const handlePluginPreviewChange = (e: Event) =>
    attachUploadedFile(
      e,
      (f) => (publishForm.value.pluginPreview = f),
      pluginPreviewUploadProgress,
      tempPluginPreviewPath,
      'plugin_preview',
    );
  const handleMaterialFileChange = (e: Event) =>
    attachUploadedFile(
      e,
      (f) => (publishForm.value.materialFile = f),
      materialUploadProgress,
      tempMaterialPath,
      'material',
      (f) => f.name.replace(/\.[^.]+$/, ''),
    );
  const applyAiCover = async (
    file: File,
    assign: (file: File | null) => void,
    progressRef: Ref<number | null>,
    pathRef: Ref<string | null>,
    fieldname: string,
  ) => {
    assign(file);
    if (await uploadFile(file, progressRef, pathRef, fieldname)) {
      toast.success('已自动应用 AI 生成的封面图！');
    } else {
      assign(null);
    }
  };
  const handleAiCoverSave = (file: File) => {
    const isPreview = activeCoverTarget.value === 'pluginPreview';
    return applyAiCover(
      file,
      isPreview
        ? (f: File | null) => (publishForm.value.pluginPreview = f)
        : (f: File | null) => (publishForm.value.thumbnail = f),
      isPreview ? pluginPreviewUploadProgress : thumbnailUploadProgress,
      isPreview ? tempPluginPreviewPath : tempThumbnailPath,
      isPreview ? 'plugin_preview' : 'thumbnail',
    );
  };
  const handlePublish = async () => {
    isPublishing.value = true;
    try {
      const success = await submitPublishWork(
        publishForm.value,
        publishCategory.value,
        collectTempPaths(),
        packageFileList.value,
        t,
      );
      if (success) {
        for (const { path } of tempUploadRefs) path.value = null;
        closeDialog();
        emit('published');
      }
    } finally {
      isPublishing.value = false;
    }
  };
  const closeDialog = () => {
    cancelAllTempUploads();
    emit('update:modelValue', false);
    publishForm.value = createDefaultPublishForm();
    publishCategory.value = 'asset';
  };
  onMounted(() => {
    if (props.modelValue) {
      initDialog();
    }
  });
  return {
    t,
    isMobile,
    systemStore,
    isPublishing,
    publishCategory,
    assetCategories,
    publishForm,
    activeSection,
    isParsingZip,
    assetUploadProgress,
    pluginUploadProgress,
    pluginPreviewUploadProgress,
    materialUploadProgress,
    thumbnailUploadProgress,
    showAiCoverDialog,
    activeCategoryLabel,
    categoryTabs,
    parsedFileTree,
    materialCategories,
    expandedFolders,
    visibleFileNodes,
    toggleSection,
    togglePbrChannel,
    openAiCoverGenerator,
    handleAiCoverSave,
    handleThumbnailChange,
    handleAssetFileChange,
    handlePluginFileChange,
    handlePluginPreviewChange,
    handleMaterialFileChange,
    handlePublish,
    closeDialog,
    toggleFolder,
  };
}
