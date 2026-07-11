import type { Ref, ComputedRef } from 'vue';

export type SpecSection = 'basic' | 'files' | 'telemetry' | 'lms' | string;

export interface EditForm {
  pluginVersion?: string;
  linkedCourseId?: string | null;
  linkedLessonId?: string | null;
  packageFile: File | null;
  file: File | null;
  packageFilesList?: string;
  fileSize?: number;
  packageSize?: number;
  thumbnail: File | null;
  [key: string]: any;
}

export interface EditWorkDialogProps {
  work?: {
    id: string;
    kind: 'plugin' | 'software' | 'asset' | 'material';
    raw?: any;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

export interface EditWorkDialogEmit {
  (e: 'save'): void;
  (e: 'close'): void;
  [key: string]: any;
}

export interface PluginVersionEntry {
  version: string;
  [key: string]: any;
}

export interface RawWorkWithPackage {
  packageFilesList?: string | string[];
  packageUrl?: string | null;
  fileUrl?: string | null;
  [key: string]: any;
}

export type TempUploadField =
  | 'tempAssetPath'
  | 'tempPackagePath'
  | 'tempThumbnailPath'
  | 'tempMaterialPath'
  | 'tempPluginPath'
  | 'tempPreviewPath'
  | 'tempSoftwarePath';

export interface EditWorkDialogState {
  fileProgress: Ref<number | null>;
  packageProgress: Ref<number | null>;
  thumbnailProgress: Ref<number | null>;
  isSaved: Ref<boolean>;
  showAiCoverDialog: Ref<boolean>;
  activeSection: Ref<SpecSection | null>;
  toggleSection: (sec: SpecSection) => void;
  existingVersions: Ref<PluginVersionEntry[]>;
  isAddingNewVersion: Ref<boolean>;
  switchVersionMode: (mode: 'new' | 'existing') => void;
  activeZipFile: ComputedRef<File | null | undefined>;
  parsedFileTree: ComputedRef<any[]>;
  hasPackageFiles: ComputedRef<boolean>;
  isParsingZip: Ref<boolean>;
  expandedFolders: Ref<Set<string>>;
  toggleFolder: (path: string) => void;
  visibleFileNodes: ComputedRef<any[]>;
  handleFileChange: (event: Event) => Promise<void>;
  handlePackageChange: (event: Event) => Promise<void>;
  handleThumbnailChange: (event: Event) => Promise<void>;
  handleAiCoverSave: (file: File) => Promise<void>;
  cancelAllTempUploads: () => void;
  handleSave: () => void;
}
