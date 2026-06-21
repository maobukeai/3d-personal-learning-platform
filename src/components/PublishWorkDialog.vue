<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { computed, ref, onMounted, watch, defineAsyncComponent } from 'vue';
import { Box, UploadCloud, Image, Film, FileText, File, Puzzle, Check } from 'lucide-vue-next';
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

type PublishCategory = 'model' | 'asset' | 'work' | 'plugin';

const props = defineProps<{
  modelValue: boolean;
  defaultCategory?: PublishCategory;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'published'): void;
}>();

interface ApprovedAsset {
  id: string;
  title: string;
  description?: string | null;
  status: string;
}

interface AssetCategory {
  id: string;
  name: string;
}

const isPublishing = ref(false);
const publishCategory = ref<PublishCategory>('work');
const myApprovedAssets = ref<ApprovedAsset[]>([]);
const selectedAssetId = ref('');
const assetCategories = ref<AssetCategory[]>([]);
const { isMobile } = useMobile();
const systemStore = useSystemStore();

const activeCategoryLabel = computed(() => {
  switch (publishCategory.value) {
    case 'model':
      return '关联模型作品';
    case 'asset':
      return '上传模型资产';
    case 'plugin':
      return '上传创作插件';
    default:
      return '发布作品展示';
  }
});

const publishReadiness = computed(() => {
  const checks = [
    { label: '标题', done: !!publishForm.value.title.trim() },
    {
      label: '内容说明',
      done:
        !!publishForm.value.description.trim() ||
        (publishCategory.value === 'plugin' && !!publishForm.value.pluginInstallGuide.trim()),
    },
    {
      label: '素材',
      done:
        (publishCategory.value === 'model' && !!selectedAssetId.value) ||
        (publishCategory.value === 'asset' && !!publishForm.value.assetFile) ||
        (publishCategory.value === 'plugin' && !!publishForm.value.pluginFile) ||
        (publishCategory.value === 'work' &&
          (publishForm.value.type === 'TEXT' || !!publishForm.value.thumbnail)),
    },
  ];
  const doneCount = checks.filter((item) => item.done).length;
  return {
    checks,
    percent: Math.round((doneCount / checks.length) * 100),
  };
});

const categoryTabs = computed(() => [
  { value: 'model', label: t('publishDialog.tabModel'), icon: Box },
  { value: 'asset', label: t('publishDialog.tabAsset'), icon: UploadCloud },
  { value: 'work', label: t('publishDialog.tabWork'), icon: Image },
  { value: 'plugin', label: '上传插件', icon: Puzzle },
]);

const publishForm = ref({
  title: '',
  description: '',
  tags: '',
  videoUrl: '',
  isVideo: false,
  type: 'IMAGE',
  thumbnail: null as File | null,
  images: [] as File[],
  assetFile: null as File | null,
  assetCategory: '', // Will store categoryId
  // Plugin-specific fields
  pluginFile: null as File | null,
  pluginPreview: null as File | null,
  pluginCategory: '其他工具',
  pluginVersion: '1.0.0',
  pluginCompatibility: '',
  pluginInstallGuide: '',
});

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'MODEL':
      return Box;
    case 'VIDEO':
      return Film;
    case 'IMAGE':
      return Image;
    case 'TEXT':
      return FileText;
    default:
      return File;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'MODEL':
      return t('publishDialog.typeModel');
    case 'VIDEO':
      return t('publishDialog.typeVideo');
    case 'IMAGE':
      return t('publishDialog.typeImage');
    case 'TEXT':
      return t('publishDialog.typeText');
    case 'OTHER':
      return t('publishDialog.typeOther');
    default:
      return t('publishDialog.typeWork');
  }
};

const fetchMyApprovedAssets = async () => {
  try {
    const response = await api.get('/api/assets/my');
    myApprovedAssets.value = (response.data as ApprovedAsset[]).filter(
      (asset) => asset.status === 'APPROVED',
    );
  } catch (_error) {
    console.error('Failed to fetch my assets');
  }
};

const fetchCategories = async () => {
  try {
    const response = await api.get('/api/assets/categories');
    assetCategories.value = response.data;
  } catch (_error) {
    console.error('Failed to fetch categories');
  }
};

watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      publishCategory.value = props.defaultCategory || 'work';
      await Promise.all([fetchMyApprovedAssets(), fetchCategories(), systemStore.fetchSettings()]);
    }
  },
);

watch(
  () => props.defaultCategory,
  (category) => {
    if (props.modelValue && category) {
      publishCategory.value = category;
    }
  },
);

const onAssetSelected = () => {
  const asset = myApprovedAssets.value.find((a) => a.id === selectedAssetId.value);
  if (asset) {
    publishForm.value.title = asset.title;
    publishForm.value.description = asset.description || '';
    publishForm.value.type = 'MODEL';
  }
};

const handleThumbnailChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishForm.value.thumbnail = file;
  }
};

const handleImagesChange = (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || []);
  publishForm.value.images = files;
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

const handlePublish = async () => {
  if (!publishForm.value.title.trim()) {
    ElMessage.warning(t('publishDialog.titleRequired'));
    return;
  }

  isPublishing.value = true;

  try {
    if (publishCategory.value === 'model' && selectedAssetId.value) {
      await api.post('/api/showcase/publish-asset', {
        assetId: selectedAssetId.value,
        title: publishForm.value.title,
        description: publishForm.value.description,
        tags: publishForm.value.tags,
      });
    } else if (publishCategory.value === 'asset') {
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

      const uploadRes = await api.post('/api/assets/upload', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await api.post('/api/showcase/publish-asset', {
        assetId: uploadRes.data.id,
        title: publishForm.value.title,
        description: publishForm.value.description,
        tags: publishForm.value.tags,
      });
    } else if (publishCategory.value === 'plugin') {
      if (!publishForm.value.pluginFile) {
        ElMessage.warning('请上传插件文件');
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
      pluginFormData.append('installGuide', publishForm.value.pluginInstallGuide);
      await api.post('/api/plugins/upload', pluginFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else {
      if (publishForm.value.type !== 'TEXT' && !publishForm.value.thumbnail) {
        ElMessage.warning(t('publishDialog.thumbnailRequired'));
        isPublishing.value = false;
        return;
      }

      const formData = new FormData();
      if (publishForm.value.thumbnail) {
        formData.append('thumbnail', publishForm.value.thumbnail);
      }
      publishForm.value.images.forEach((img) => {
        formData.append('images', img);
      });
      formData.append('title', publishForm.value.title);
      formData.append('description', publishForm.value.description);
      formData.append('tags', publishForm.value.tags);
      formData.append('videoUrl', publishForm.value.videoUrl);
      formData.append('isVideo', String(publishForm.value.isVideo));
      formData.append('type', publishForm.value.type);

      await api.post('/api/showcase', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }

    ElMessage.success(t('publishDialog.publishSuccess'));
    closeDialog();
    emit('published');
  } catch (error) {
    const msg = getApiErrorMessage(error, t('publishDialog.publishFailed'));
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
    videoUrl: '',
    isVideo: false,
    type: 'IMAGE',
    thumbnail: null,
    images: [],
    assetFile: null,
    assetCategory: '',
    pluginFile: null,
    pluginPreview: null,
    pluginCategory: '其他工具',
    pluginVersion: '1.0.0',
    pluginCompatibility: '',
    pluginInstallGuide: '',
  };
  selectedAssetId.value = '';
  publishCategory.value = 'work';
};

onMounted(() => {
  if (props.modelValue) {
    publishCategory.value = props.defaultCategory || 'work';
    fetchMyApprovedAssets();
    fetchCategories();
    systemStore.fetchSettings();
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
          {{ activeCategoryLabel }} · 完成度 {{ publishReadiness.percent }}%
        </p>
      </div>
    </template>

    <div class="publish-progress-panel">
      <div class="publish-progress-track">
        <span :style="{ width: `${publishReadiness.percent}%` }"></span>
      </div>
      <div class="publish-checks">
        <span
          v-for="check in publishReadiness.checks"
          :key="check.label"
          :class="{ done: check.done }"
        >
          <Check class="w-3 h-3" />
          {{ check.label }}
        </span>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="mb-5 flex justify-center">
      <Tabs v-model="publishCategory" :options="categoryTabs" size="sm" />
    </div>

    <!-- Model Category: Select existing approved asset -->
    <template v-if="publishCategory === 'model'">
      <div class="space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-5">
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                >{{ t('publishDialog.selectExisting') }}</label
              >
              <el-select
                v-model="selectedAssetId"
                :placeholder="t('publishDialog.selectExistingPlaceholder')"
                class="w-full custom-select-v2"
                @change="onAssetSelected"
              >
                <el-option
                  v-for="asset in myApprovedAssets"
                  :key="asset.id"
                  :label="asset.title"
                  :value="asset.id"
                />
              </el-select>
              <p v-if="myApprovedAssets.length === 0" class="text-[10px] text-slate-400 mt-1 ml-1">
                {{ t('publishDialog.noApprovedAssetsTip') }}
              </p>
            </div>

            <div class="space-y-4">
              <Input
                v-model="publishForm.title"
                type="text"
                :label="t('publishDialog.showcaseTitleLabel')"
                :placeholder="t('publishDialog.titlePlaceholder')"
                required
              />
            </div>

            <div class="space-y-4">
              <Input
                v-model="publishForm.tags"
                type="text"
                :label="t('publishDialog.tagsLabel')"
                :placeholder="t('publishDialog.tagsPlaceholder')"
              />
              <p class="text-[10px] text-slate-400 mt-1 ml-1">
                {{ t('publishDialog.tagsTip') }}
              </p>
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

    <!-- Work Category: Create a work showcase (two-column layout) -->
    <template v-if="publishCategory === 'work'">
      <div class="flex flex-col md:flex-row gap-6">
        <!-- Left side: Form fields -->
        <div class="w-full md:w-[40%] space-y-5 shrink-0">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >{{ t('publishDialog.workTypeLabel') }}</label
            >
            <div
              class="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide p-1"
            >
              <button
                v-for="workType in ['IMAGE', 'VIDEO', 'TEXT', 'MODEL', 'OTHER']"
                :key="workType"
                type="button"
                class="flex-none md:flex-1 px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                :class="publishForm.type === workType ? 'bg-indigo-600 text-white shadow-md' : ''"
                :style="
                  publishForm.type !== workType
                    ? 'color: var(--text-secondary); background-color: var(--bg-app)'
                    : ''
                "
                @click="publishForm.type = workType"
              >
                <component :is="getTypeIcon(workType)" class="w-3 h-3" />
                {{ getTypeLabel(workType) }}
              </button>
            </div>
          </div>

          <Input
            v-model="publishForm.title"
            type="text"
            :label="t('publishDialog.titleLabel')"
            :placeholder="t('publishDialog.titlePlaceholder')"
            required
          />

          <div v-if="publishForm.type !== 'TEXT'">
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >{{ t('publishDialog.thumbnailRequiredLabel') }}</label
            >
            <FileDropZone
              v-model="publishForm.thumbnail"
              accept="image/*"
              :label="
                publishForm.thumbnail
                  ? publishForm.thumbnail.name
                  : t('publishDialog.clickUploadThumbnail')
              "
              @change="handleThumbnailChange"
            />
          </div>

          <div v-else>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >{{ t('publishDialog.thumbnailOptionalLabel') }}</label
            >
            <FileDropZone
              v-model="publishForm.thumbnail"
              accept="image/*"
              height-class="h-24"
              :label="
                publishForm.thumbnail
                  ? publishForm.thumbnail.name
                  : t('publishDialog.clickUploadThumbnailOptional')
              "
              @change="handleThumbnailChange"
            />
          </div>

          <div v-if="publishForm.type !== 'TEXT'">
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >{{ t('publishDialog.moreImagesLabel') }}</label
            >
            <FileDropZone
              v-model="publishForm.images"
              accept="image/*"
              multiple
              height-class="h-20"
              :label="
                publishForm.images.length > 0
                  ? t('publishDialog.selectedImagesCount', { n: publishForm.images.length })
                  : t('publishDialog.clickUploadMoreImages')
              "
              @change="handleImagesChange"
            />
          </div>

          <div
            v-if="publishForm.type === 'VIDEO' || publishForm.isVideo"
            class="flex items-center gap-3 py-2"
          >
            <el-switch v-model="publishForm.isVideo" active-color="var(--accent)" />
            <span class="text-xs font-bold" style="color: var(--text-secondary)">{{
              t('publishDialog.isVideoWorkLabel')
            }}</span>
          </div>

          <div v-if="publishForm.isVideo">
            <Input
              v-model="publishForm.videoUrl"
              type="text"
              :label="t('publishDialog.videoUrlLabel')"
              :placeholder="t('publishDialog.videoUrlPlaceholder')"
            />
          </div>

          <div>
            <Input
              v-model="publishForm.tags"
              type="text"
              :label="t('publishDialog.tagsLabel')"
              :placeholder="t('publishDialog.tagsPlaceholder')"
            />
            <p class="text-[10px] text-slate-400 mt-1 ml-1">{{ t('publishDialog.tagsTip') }}</p>
          </div>
        </div>

        <!-- Right side: Markdown editor -->
        <div class="w-full md:w-[60%] min-w-0">
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
            >{{ t('publishDialog.descriptionLabel') }}</label
          >
          <MarkdownEditor
            v-model="publishForm.description"
            :placeholder="t('publishDialog.descriptionPlaceholder')"
            :height="isMobile ? '320px' : '360px'"
            simple
          />
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
            <label class="flex flex-col">
              <span
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                >插件分类</span
              >
              <select
                v-model="publishForm.pluginCategory"
                class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                <option
                  v-for="cat in systemStore.settings.PLUGIN_CATEGORIES"
                  :key="cat"
                  :value="cat"
                >
                  {{ cat }}
                </option>
              </select>
            </label>
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
              :height="isMobile ? '180px' : '210px'"
              simple
            />
          </div>
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >安装说明（Markdown）</label
            >
            <MarkdownEditor
              v-model="publishForm.pluginInstallGuide"
              placeholder="步骤 1: 解压 zip 文件&#10;步骤 2: 在 Blender 首选项中安装..."
              :height="isMobile ? '180px' : '210px'"
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
.publish-progress-panel {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}
.publish-progress-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 16%, transparent);
}
.publish-progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #059669);
  transition: width 0.2s ease;
}
.publish-checks {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.publish-checks span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  color: var(--text-muted);
  background: var(--bg-card);
  font-size: 11px;
  font-weight: 800;
}
.publish-checks span.done {
  color: #059669;
}
.publish-submit {
  box-shadow: 0 -8px 20px color-mix(in srgb, var(--bg-card) 86%, transparent);
}
@media (max-width: 768px) {
  .publish-progress-panel {
    grid-template-columns: 1fr;
  }
}
</style>
