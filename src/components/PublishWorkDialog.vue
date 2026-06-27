<script setup lang="ts">
import { getApiErrorMessage, logError } from '@/utils/error';
import { computed, ref, onMounted, watch, defineAsyncComponent } from 'vue';
import { UploadCloud, Layers, Puzzle } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useI18n } from 'vue-i18n';
import { useMobile } from '@/composables/useMobile';
import { useSystemStore } from '@/stores/system';
import FileDropZone from '@/components/FileDropZone.vue';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Input from '@/components/ui/Input.vue';

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
    <div class="mb-5 flex justify-center">
      <Tabs v-model="publishCategory" :options="categoryTabs" size="sm" />
    </div>

    <!-- Asset Category: Upload a new 3D model file -->
    <template v-if="publishCategory === 'asset'">
      <div class="space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-5">
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                >{{ t('publishDialog.assetFileLabel') }}</label
              >
              <FileDropZone
                v-model="publishForm.assetFile"
                accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.blend,.usdz,.abc,.zip"
                :label="
                  publishForm.assetFile
                    ? publishForm.assetFile.name
                    : t('publishDialog.dragAssetFile')
                "
                :sublabel="t('publishDialog.supportedAssetFiles')"
                @change="handleAssetFileChange"
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

          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >{{ t('publishDialog.descriptionLabel') }}</label
            >
            <MarkdownEditor
              v-model="publishForm.description"
              :placeholder="t('publishDialog.descriptionPlaceholder')"
              :height="isMobile ? '280px' : '300px'"
              simple
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Plugin Category: Upload plugin file -->
    <template v-if="publishCategory === 'plugin'">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <!-- Plugin file upload -->
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >插件文件 *</label
            >
            <FileDropZone
              v-model="publishForm.pluginFile"
              accept=".zip,.rar,.7z,.blend,.js,.ts,.py,.lua,.mjs"
              height-class="h-28"
              hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
              icon-type="puzzle"
              :label="publishForm.pluginFile ? publishForm.pluginFile.name : '点击上传插件文件'"
              sublabel=".zip .blend .js .ts .py 等格式"
              @change="handlePluginFileChange"
            />
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
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
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

          <!-- Compatibility -->
          <div>
            <Input
              v-model="publishForm.pluginCompatibility"
              type="text"
              label="兼容性"
              placeholder="如 Blender 3.x / 4.x"
            />
          </div>

          <!-- Preview image -->
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >封面图（可选）</label
            >
            <FileDropZone
              v-model="publishForm.pluginPreview"
              accept="image/*"
              height-class="h-20"
              hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
              :label="publishForm.pluginPreview ? publishForm.pluginPreview.name : '点击上传封面图'"
              @change="handlePluginPreviewChange"
            />
          </div>

          <!-- Tags -->
          <div>
            <Input
              v-model="publishForm.tags"
              type="text"
              label="标签"
              placeholder="用逗号分隔，如：Blender, 材质, 批量"
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

        <!-- Right: description + install guide -->
        <div class="space-y-4">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >插件简介</label
            >
            <MarkdownEditor
              v-model="publishForm.description"
              placeholder="简单描述插件的功能和用途"
              :height="isMobile ? '200px' : '320px'"
              simple
            />
          </div>

        </div>
      </div>
    </template>

    <!-- Material Category: Upload material package -->
    <template v-if="publishCategory === 'material'">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <!-- Material file upload -->
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >材质包文件 *</label
            >
            <FileDropZone
              v-model="publishForm.materialFile"
              accept=".zip,.sbsar"
              height-class="h-28"
              hover-class="group-hover:border-violet-500 group-hover:bg-violet-500/5"
              :label="publishForm.materialFile ? publishForm.materialFile.name : '点击上传材质包文件'"
              sublabel="支持 .zip .sbsar 格式"
              @change="handleMaterialFileChange"
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
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
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
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
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
          <div class="flex items-center gap-3 py-1">
            <el-switch v-model="publishForm.materialIsProcedural" active-color="var(--accent)" />
            <span class="text-xs font-bold text-slate-400">程序化材质 / SBSAR</span>
          </div>

          <!-- Preview image (Cover) -->
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >封面图（可选）</label
            >
            <FileDropZone
              v-model="publishForm.thumbnail"
              accept="image/*"
              height-class="h-20"
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

        <!-- Right: description -->
        <div class="space-y-4">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >材质说明</label
            >
            <MarkdownEditor
              v-model="publishForm.description"
              placeholder="贴图通道、使用场景、授权或引擎导入注意事项... 支持 Markdown 格式"
              :height="isMobile ? '320px' : '390px'"
              simple
            />
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
