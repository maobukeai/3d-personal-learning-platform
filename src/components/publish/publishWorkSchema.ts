/** * Schema, types, defaults, request builders and submit orchestration for the * publish-work dialog. No Vue imports. */ import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { toast } from '@/utils/feedbackAdapter';
export type PublishCategory = 'asset' | 'material' | 'plugin' | 'software';
export interface AssetCategory {
  id: string;
  name: string;
} /** Shape accepted by the dialog's `initialData` prop. */
export interface InitialPublishData {
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
} /** The full publish form state. */
export interface PublishForm {
  title: string;
  description: string;
  tags: string;
  thumbnail: File | null;
  // Asset
  assetFile: File | null;
  assetCategory: string;
  // Plugin
  pluginFile: File | null;
  pluginPreview: File | null;
  pluginCategory: string;
  pluginVersion: string;
  pluginCompatibility: string;
  pluginInstallGuide: string;
  bilibiliUrl: string;
  // Material
  materialFile: File | null;
  materialCategory: string;
  materialResolution: string;
  materialIsProcedural: boolean;
  // Copyright & Tech Specs fields
  originality: string;
  originalAuthor: string;
  originalLink: string;
  license: string;
  isFree: boolean | null;
  meshType: string;
  uvUnwrapped: boolean;
  uvOverlapping: boolean;
  pbrChannels: string[];
  rigged: boolean;
  gameReady: boolean;
  downloadType: 'local' | 'external';
  externalUrl: string;
  extractionCode: string;
} /** Temp upload paths tracked during a publish session. */
export interface TempUploadPaths {
  asset: string | null;
  plugin: string | null;
  pluginPreview: string | null;
  material: string | null;
  thumbnail: string | null;
}
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
export const RESOLUTION_OPTIONS = ['2K', '4K', '8K', '矢量', '程序化'];
export const SOFTWARE_CATEGORIES = [
  '3D 建模与雕刻软件',
  '渲染引擎与渲染器',
  '后期与图像处理',
  '游戏与交互引擎',
  '其他工具',
];
export const SOFTWARE_COMPATIBILITY_OPTIONS = [
  'Windows 10/11',
  'macOS',
  'Linux',
  'Android',
  'iOS',
  '跨平台',
]; /** Factory returning a fresh default publish form. */
export function createDefaultPublishForm(): PublishForm {
  return {
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
} /** Type guard for runtime category strings coming from props. */
export function isValidPublishCategory(cat: unknown): cat is PublishCategory {
  return cat === 'asset' || cat === 'material' || cat === 'plugin' || cat === 'software';
} /** * Combine an external URL with its extraction code using the same format the * backend expects (matches the original inline implementation). */
export function buildExternalUrlWithCode(url: string, extractionCode?: string): string {
  let finalUrl = url.trim();
  const code = extractionCode?.trim();
  if (code) {
    finalUrl += ` 提取码: ${code}`;
  }
  return finalUrl;
} /** * Build the multipart FormData for an asset upload. * Mirrors the original asset branch of `handlePublish`. */
export function buildAssetUploadFormData(
  form: PublishForm,
  tempPaths: TempUploadPaths,
  packageFileList: string[],
): FormData {
  const data = new FormData();
  if (form.downloadType === 'local') {
    if (tempPaths.asset) {
      data.append('tempAssetPath', tempPaths.asset);
    } else if (form.assetFile) {
      data.append('asset', form.assetFile);
    }
  } else {
    data.append('externalUrl', buildExternalUrlWithCode(form.externalUrl, form.extractionCode));
  }
  if (tempPaths.thumbnail) {
    data.append('tempThumbnailPath', tempPaths.thumbnail);
  } else if (form.thumbnail) {
    data.append('thumbnail', form.thumbnail);
  }
  data.append('title', form.title);
  data.append('description', form.description);
  data.append('categoryId', form.assetCategory);
  data.append('originality', form.originality || '');
  data.append('originalAuthor', form.originalAuthor || '');
  data.append('originalLink', form.originalLink || '');
  data.append('license', form.license || '');
  data.append(
    'isFree',
    form.isFree === null || form.isFree === undefined ? '' : String(form.isFree),
  );
  data.append('meshType', form.meshType || '');
  data.append('uvUnwrapped', String(form.uvUnwrapped ?? false));
  data.append('uvOverlapping', String(form.uvOverlapping ?? false));
  data.append('pbrChannels', JSON.stringify(form.pbrChannels || []));
  data.append('rigged', String(form.rigged ?? false));
  data.append('gameReady', String(form.gameReady ?? false));
  if (form.bilibiliUrl) data.append('bilibiliUrl', form.bilibiliUrl);
  if (form.assetFile) data.append('fileSize', String(form.assetFile.size));
  if (packageFileList && packageFileList.length > 0)
    data.append('packageFilesList', JSON.stringify(packageFileList));
  return data;
} /** * Build the multipart FormData for a plugin or software upload. * `isPlugin` switches field names and endpoint (handled by caller). */
export function buildPluginUploadFormData(
  form: PublishForm,
  tempPaths: TempUploadPaths,
  packageFileList: string[],
  isPlugin: boolean,
): FormData {
  const data = new FormData();
  if (form.downloadType === 'local') {
    if (tempPaths.plugin) {
      data.append(isPlugin ? 'tempPluginPath' : 'tempSoftwarePath', tempPaths.plugin);
    } else if (form.pluginFile) {
      data.append(isPlugin ? 'plugin_file' : 'software_file', form.pluginFile);
    }
  } else {
    data.append('externalUrl', buildExternalUrlWithCode(form.externalUrl, form.extractionCode));
  }
  if (tempPaths.pluginPreview) {
    data.append('tempPreviewPath', tempPaths.pluginPreview);
  } else if (form.pluginPreview) {
    data.append(isPlugin ? 'plugin_preview' : 'software_preview', form.pluginPreview);
  }
  data.append('title', form.title);
  data.append('description', form.description);
  data.append('category', form.pluginCategory);
  data.append('version', form.pluginVersion);
  data.append('compatibility', form.pluginCompatibility);
  data.append('tags', form.tags);
  data.append('installGuide', '');
  if (form.bilibiliUrl) data.append('bilibiliUrl', form.bilibiliUrl);
  if (form.pluginFile) data.append('fileSize', String(form.pluginFile.size));
  if (packageFileList && packageFileList.length > 0)
    data.append('packageFilesList', JSON.stringify(packageFileList));
  return data;
} /** Build the multipart FormData for a material upload. */
export function buildMaterialUploadFormData(
  form: PublishForm,
  tempPaths: TempUploadPaths,
  packageFileList: string[],
): FormData {
  const data = new FormData();
  if (form.downloadType === 'local') {
    if (tempPaths.material) {
      data.append('tempMaterialPath', tempPaths.material);
    } else if (form.materialFile) {
      data.append('material', form.materialFile);
    }
  } else {
    data.append('externalUrl', buildExternalUrlWithCode(form.externalUrl, form.extractionCode));
  }
  if (tempPaths.thumbnail) {
    data.append('tempPreviewPath', tempPaths.thumbnail);
  } else if (form.thumbnail) {
    data.append('preview', form.thumbnail);
  }
  data.append('title', form.title);
  data.append('description', form.description);
  data.append('category', form.materialCategory);
  data.append('resolution', form.materialResolution);
  data.append('isProcedural', String(form.materialIsProcedural));
  data.append('tags', form.tags);
  data.append('originality', 'ORIGINAL');
  data.append('license', 'CC_BY');
  data.append('isFree', 'true');
  if (form.bilibiliUrl) data.append('bilibiliUrl', form.bilibiliUrl);
  if (form.materialFile) data.append('fileSize', String(form.materialFile.size));
  if (packageFileList && packageFileList.length > 0)
    data.append('packageFilesList', JSON.stringify(packageFileList));
  return data;
} /** Validate and submit the publish form. Returns true on success, false on validation/API failure. */
export async function submitPublishWork(
  form: PublishForm,
  category: PublishCategory,
  tempPaths: TempUploadPaths,
  packageFileList: string[],
  t: (key: string) => string,
): Promise<boolean> {
  if (!form.title.trim()) {
    toast.warning(t('publishDialog.titleRequired'));
    return false;
  }
  const headers = { headers: { 'Content-Type': 'multipart/form-data' } };
  const ensureSource = (hasFile: boolean, tempPath: string | null, missingMsg: string): boolean => {
    if (form.downloadType === 'local') {
      if (!hasFile && !tempPath) {
        toast.warning(missingMsg);
        return false;
      }
    } else if (!form.externalUrl.trim()) {
      toast.warning('请填写网盘链接 or 外部下载链接');
      return false;
    }
    return true;
  };
  try {
    if (category === 'asset') {
      if (!ensureSource(!!form.assetFile, tempPaths.asset, t('publishDialog.modelRequired'))) {
        return false;
      }
      if (!form.assetCategory) {
        toast.warning(t('publishDialog.categoryRequired'));
        return false;
      }
      await api.post(
        '/api/assets/upload',
        buildAssetUploadFormData(form, tempPaths, packageFileList),
        headers,
      );
    } else if (category === 'plugin' || category === 'software') {
      const isPlugin = category === 'plugin';
      const missingMsg = isPlugin
        ? t('publishDialog.pluginRequired') || '请上传插件文件'
        : '请上传软件文件';
      if (!ensureSource(!!form.pluginFile, tempPaths.plugin, missingMsg)) {
        return false;
      }
      if (!form.title.trim()) {
        toast.warning(isPlugin ? '请填写插件名称' : '请填写软件名称');
        return false;
      }
      const endpoint = isPlugin ? '/api/plugins/upload' : '/api/softwares/upload';
      await api.post(
        endpoint,
        buildPluginUploadFormData(form, tempPaths, packageFileList, isPlugin),
        headers,
      );
    } else if (category === 'material') {
      if (
        !ensureSource(
          !!form.materialFile,
          tempPaths.material,
          t('publishDialog.materialRequired') || '请上传材质包文件',
        )
      ) {
        return false;
      }
      if (!form.materialCategory) {
        toast.warning('请选择材质分类');
        return false;
      }
      await api.post(
        '/api/materials/upload',
        buildMaterialUploadFormData(form, tempPaths, packageFileList),
        headers,
      );
    }
    toast.success(t('publishDialog.publishSuccess') || '发布成功');
    return true;
  } catch (error) {
    toast.error(getApiErrorMessage(error, t('publishDialog.publishFailed') || '发布失败'));
    return false;
  }
}
