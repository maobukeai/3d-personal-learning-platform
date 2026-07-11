import { computed, ref, watch, type Ref } from 'vue';
import { logError } from '@/utils/error';
import { useTempUpload } from '@/composables/useTempUpload';
import { toast } from '@/utils/feedbackAdapter';
import api from '@/utils/api';
import { parseZipFileNames, buildFileTree, flattenFileTree } from '@/utils/zipHelper';
import { useFileTree } from '@/composables/useFileTree';
import type {
  EditForm,
  EditWorkDialogEmit,
  EditWorkDialogProps,
  EditWorkDialogState,
  PluginVersionEntry,
  RawWorkWithPackage,
  SpecSection,
  TempUploadField,
} from './types';

export const BLENDER_VERSIONS = [
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

const TEMP_UPLOAD_FIELDS: TempUploadField[] = [
  'tempAssetPath',
  'tempPackagePath',
  'tempThumbnailPath',
  'tempMaterialPath',
  'tempPluginPath',
  'tempPreviewPath',
  'tempSoftwarePath',
];

export function useEditWorkDialog(
  props: EditWorkDialogProps,
  emit: EditWorkDialogEmit,
  models: { show: Ref<boolean>; form: Ref<EditForm> },
): EditWorkDialogState {
  const { show, form } = models;

  // ---- upload progress + dialog flags ----
  const fileProgress = ref<number | null>(null);
  const packageProgress = ref<number | null>(null);
  const thumbnailProgress = ref<number | null>(null);
  const isSaved = ref(false);
  const showAiCoverDialog = ref(false);

  // ---- spec-card accordion ----
  const activeSection = ref<SpecSection | null>(null);
  const toggleSection = (sec: SpecSection) => {
    activeSection.value = activeSection.value === sec ? null : sec;
  };

  // ---- LMS course/lesson preload ----
  const courses = ref<unknown[]>([]);
  const lessons = ref<unknown[]>([]);
  const isLoadingCourses = ref(false);
  const isLoadingLessons = ref(false);

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

  // ---- plugin/software version discovery ----
  const existingVersions = ref<PluginVersionEntry[]>([]);
  const isAddingNewVersion = ref(false);

  const fetchExistingVersions = async () => {
    if ((props.work?.kind === 'plugin' || props.work?.kind === 'software') && props.work?.id) {
      try {
        const pathSegment = props.work.kind === 'plugin' ? 'plugins' : 'softwares';
        const { data } = await api.get(`/api/${pathSegment}/${props.work.id}/versions`);
        existingVersions.value = (data || []) as PluginVersionEntry[];
        if (existingVersions.value.length > 0) {
          const currentVer = form.value.pluginVersion;
          const exists = existingVersions.value.some((v) => v.version === currentVer);
          isAddingNewVersion.value = !exists;
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

  const switchVersionMode = (mode: 'new' | 'existing') => {
    if (mode === 'new') {
      isAddingNewVersion.value = true;
      form.value = { ...form.value, pluginVersion: '' };
    } else {
      isAddingNewVersion.value = false;
      form.value = {
        ...form.value,
        pluginVersion: existingVersions.value[0]?.version || '',
      };
    }
  };

  // ---- temp upload coordination ----
  const { uploadFile: doUpload, cancelUpload } = useTempUpload();

  const uploadFile = async (
    file: File,
    progressRef: Ref<number | null>,
    tempField: TempUploadField,
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
        form.value = { ...form.value, [tempField]: filePath };
      },
      () => form.value[tempField],
      fieldname,
    );
  };

  const cancelAllTempUploads = () => {
    for (const field of TEMP_UPLOAD_FIELDS) {
      const path = form.value[field];
      if (path) {
        cancelUpload(path);
      }
    }
    fileProgress.value = null;
    packageProgress.value = null;
    thumbnailProgress.value = null;
    form.value = {
      ...form.value,
      tempAssetPath: undefined,
      tempPackagePath: undefined,
      tempThumbnailPath: undefined,
      tempMaterialPath: undefined,
      tempPluginPath: undefined,
      tempPreviewPath: undefined,
      tempSoftwarePath: undefined,
    };
  };

  // ---- file change handlers ----
  const handleFileChange = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      form.value = { ...form.value, file, fileSize: file.size };
      const kind = props.work?.kind;
      const tempField: TempUploadField =
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
      form.value = { ...form.value, packageFile: file, packageSize: file.size };
      await uploadFile(file, packageProgress, 'tempPackagePath');
    }
  };

  const handleThumbnailChange = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      form.value = { ...form.value, thumbnail: file };
      const kind = props.work?.kind;
      const tempField: TempUploadField =
        kind === 'plugin' || kind === 'software' ? 'tempPreviewPath' : 'tempThumbnailPath';
      const success = await uploadFile(file, thumbnailProgress, tempField);
      if (success) {
        toast.success('封面图上传成功！');
      } else {
        form.value = { ...form.value, thumbnail: null };
      }
    }
  };

  const handleAiCoverSave = async (file: File) => {
    form.value = { ...form.value, thumbnail: file };
    const kind = props.work?.kind;
    const tempField: TempUploadField =
      kind === 'plugin' || kind === 'software' ? 'tempPreviewPath' : 'tempThumbnailPath';
    const success = await uploadFile(file, thumbnailProgress, tempField);
    if (success) {
      toast.success('已自动应用 AI 生成的封面图！');
    } else {
      form.value = { ...form.value, thumbnail: null };
    }
  };

  // ---- zip file tree ----
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
    const rawAsset = props.work?.raw as RawWorkWithPackage | undefined;
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
    const rawAsset = props.work?.raw as RawWorkWithPackage | undefined;
    return !!(rawAsset && (rawAsset.packageUrl || rawAsset.fileUrl || rawAsset.packageFilesList));
  });

  // ---- submit guard ----
  const handleSave = () => {
    isSaved.value = true;
    emit('save');
  };

  // ---- watchers ----
  // Cancel pending temp uploads when the dialog closes without saving.
  watch(show, (newVal) => {
    if (!newVal) {
      if (!isSaved.value) {
        cancelAllTempUploads();
      }
      isSaved.value = false;
    }
  });

  // Reset + preload data each time the dialog opens.
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

  // Reset lesson selection when the linked course changes.
  watch(
    () => form.value.linkedCourseId,
    (newCourseId, oldCourseId) => {
      if (newCourseId !== oldCourseId) {
        if (oldCourseId !== undefined && oldCourseId !== null && oldCourseId !== '') {
          form.value = { ...form.value, linkedLessonId: '' };
        }
        fetchLessons(newCourseId || '');
      }
    },
  );

  // Re-parse the zip tree whenever the active zip file changes.
  watch(
    activeZipFile,
    async (newFile) => {
      resetExpansion();
      if (!newFile) {
        packageFileList.value = [];
        form.value = { ...form.value, packageFilesList: undefined };
        return;
      }
      const isZip = newFile.name.toLowerCase().endsWith('.zip');
      if (isZip) {
        isParsingZip.value = true;
        try {
          const list = await parseZipFileNames(newFile);
          packageFileList.value = list;
          form.value = { ...form.value, packageFilesList: JSON.stringify(list) };
        } catch (err) {
          logError(err, { operation: 'parse zip file' });
          packageFileList.value = [];
          form.value = { ...form.value, packageFilesList: undefined };
        } finally {
          isParsingZip.value = false;
        }
      } else {
        packageFileList.value = [];
        form.value = { ...form.value, packageFilesList: undefined };
      }
    },
    { immediate: true },
  );

  return {
    fileProgress,
    packageProgress,
    thumbnailProgress,
    isSaved,
    showAiCoverDialog,
    activeSection,
    toggleSection,
    existingVersions,
    isAddingNewVersion,
    switchVersionMode,
    activeZipFile,
    parsedFileTree,
    hasPackageFiles,
    isParsingZip,
    expandedFolders,
    toggleFolder,
    visibleFileNodes,
    handleFileChange,
    handlePackageChange,
    handleThumbnailChange,
    handleAiCoverSave,
    cancelAllTempUploads,
    handleSave,
  };
}
