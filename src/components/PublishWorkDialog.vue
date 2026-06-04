<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue';
import { X, Box, UploadCloud, Image, Film, FileText, File } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const props = defineProps<{
  modelValue: boolean;
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
const publishCategory = ref<'model' | 'asset' | 'work'>('work');
const myApprovedAssets = ref<ApprovedAsset[]>([]);
const selectedAssetId = ref('');
const assetCategories = ref<AssetCategory[]>([]);
const isMobile = ref(false);

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

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
    myApprovedAssets.value = (response.data as ApprovedAsset[]).filter((asset) => asset.status === 'APPROVED');
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
      await Promise.all([fetchMyApprovedAssets(), fetchCategories()]);
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
  };
  selectedAssetId.value = '';
  publishCategory.value = 'work';
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
  if (props.modelValue) {
    fetchMyApprovedAssets();
    fetchCategories();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <Transition name="fade">
    <div v-if="modelValue" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeDialog"></div>
      <div
        class="relative w-full max-w-[95vw] md:max-w-[80vw] max-h-[90vh] overflow-y-auto p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl scrollbar-hide"
        style="background-color: var(--bg-card)"
      >
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold" style="color: var(--text-primary)">{{ t('publishDialog.title') }}</h3>
          <button type="button" style="color: var(--text-secondary)" @click="closeDialog">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Category Tabs -->
        <div
          class="flex items-center gap-2 p-1 rounded-xl mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide"
          style="background-color: var(--bg-app)"
        >
          <button type="button" class="flex-none md:flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5" :class="publishCategory === 'model' ? 'bg-indigo-600 text-white shadow-md' : ''" :style="publishCategory !== 'model' ? 'color: var(--text-secondary)' : ''" @click="publishCategory = 'model'">
            <Box class="w-3.5 h-3.5" />
            {{ t('publishDialog.tabModel') }}
          </button>
          <button type="button" class="flex-none md:flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5" :class="publishCategory === 'asset' ? 'bg-indigo-600 text-white shadow-md' : ''" :style="publishCategory !== 'asset' ? 'color: var(--text-secondary)' : ''" @click="publishCategory = 'asset'">
            <UploadCloud class="w-3.5 h-3.5" />
            {{ t('publishDialog.tabAsset') }}
          </button>
          <button type="button" class="flex-none md:flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5" :class="publishCategory === 'work' ? 'bg-indigo-600 text-white shadow-md' : ''" :style="publishCategory !== 'work' ? 'color: var(--text-secondary)' : ''" @click="publishCategory = 'work'">
            <Image class="w-3.5 h-3.5" />
            {{ t('publishDialog.tabWork') }}
          </button>
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
                  <p
                    v-if="myApprovedAssets.length === 0"
                    class="text-[10px] text-slate-400 mt-1 ml-1"
                  >
                    {{ t('publishDialog.noApprovedAssetsTip') }}
                  </p>
                </div>

                <div>
                  <label
                    class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                    >{{ t('publishDialog.showcaseTitleLabel') }}</label
                  >
                  <input
                    v-model="publishForm.title"
                    type="text"
                    class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    :placeholder="t('publishDialog.titlePlaceholder')"
                    style="color: var(--text-primary)"
                  />
                </div>

                <div>
                  <label
                    class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                    >{{ t('publishDialog.tagsLabel') }}</label
                  >
                  <input
                    v-model="publishForm.tags"
                    type="text"
                    class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    :placeholder="t('publishDialog.tagsPlaceholder')"
                    style="color: var(--text-primary)"
                  />
                  <p class="text-[10px] text-slate-400 mt-1 ml-1">{{ t('publishDialog.tagsTip') }}</p>
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
                  :height="isMobile ? '300px' : '350px'"
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
                  <div class="relative group h-32">
                    <input
                      type="file"
                      accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.blend,.usdz,.abc,.zip"
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      @change="handleAssetFileChange"
                    />
                    <div
                      class="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-indigo-500 group-hover:bg-indigo-500/5"
                      style="border-color: var(--border-base)"
                    >
                      <UploadCloud class="w-6 h-6 text-indigo-500/40" />
                      <p class="text-xs font-medium" style="color: var(--text-secondary)">
                        {{
                          publishForm.assetFile
                            ? publishForm.assetFile.name
                            : t('publishDialog.dragAssetFile')
                        }}
                      </p>
                      <p class="text-[10px]" style="color: var(--text-muted)">
                        {{ t('publishDialog.supportedAssetFiles') }}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                    >{{ t('publishDialog.titleLabel') }}</label
                  >
                  <input
                    v-model="publishForm.title"
                    type="text"
                    class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    :placeholder="t('publishDialog.titlePlaceholder')"
                    style="color: var(--text-primary)"
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
                          {{ publishForm.thumbnail ? publishForm.thumbnail.name : t('publishDialog.uploadPreview') }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                    >{{ t('publishDialog.tagsLabel') }}</label
                  >
                  <input
                    v-model="publishForm.tags"
                    type="text"
                    class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    :placeholder="t('publishDialog.tagsCommaPlaceholder')"
                    style="color: var(--text-primary)"
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
                  :height="isMobile ? '300px' : '350px'"
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
                <div class="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide p-1">
                  <button
                    v-for="t in ['IMAGE', 'VIDEO', 'TEXT', 'MODEL', 'OTHER']" :key="t" type="button" class="flex-none md:flex-1 px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1" :class="publishForm.type === t ? 'bg-indigo-600 text-white shadow-md' : ''" :style="
                      publishForm.type !== t
                        ? 'color: var(--text-secondary); background-color: var(--bg-app)'
                        : ''
                    " @click="publishForm.type = t">
                    <component :is="getTypeIcon(t)" class="w-3 h-3" />
                    {{ getTypeLabel(t) }}
                  </button>
                </div>
              </div>

              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                  >{{ t('publishDialog.titleLabel') }}</label
                >
                <input
                  v-model="publishForm.title"
                  type="text"
                  class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  :placeholder="t('publishDialog.titlePlaceholder')"
                  style="color: var(--text-primary)"
                />
              </div>

              <div v-if="publishForm.type !== 'TEXT'">
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                  >{{ t('publishDialog.thumbnailRequiredLabel') }}</label
                >
                <div class="relative group h-32">
                  <input
                    type="file"
                    accept="image/*"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    @change="handleThumbnailChange"
                  />
                  <div
                    class="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-indigo-500 group-hover:bg-indigo-500/5"
                    style="border-color: var(--border-base)"
                  >
                    <UploadCloud class="w-6 h-6 text-indigo-500/40" />
                    <p class="text-xs font-medium" style="color: var(--text-secondary)">
                      {{ publishForm.thumbnail ? publishForm.thumbnail.name : t('publishDialog.clickUploadThumbnail') }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-else>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                  >{{ t('publishDialog.thumbnailOptionalLabel') }}</label
                >
                <div class="relative group h-24">
                  <input
                    type="file"
                    accept="image/*"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    @change="handleThumbnailChange"
                  />
                  <div
                    class="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-indigo-500 group-hover:bg-indigo-500/5"
                    style="border-color: var(--border-base)"
                  >
                    <UploadCloud class="w-5 h-5 text-indigo-500/40" />
                    <p class="text-[10px] font-medium" style="color: var(--text-secondary)">
                      {{
                        publishForm.thumbnail
                          ? publishForm.thumbnail.name
                          : t('publishDialog.clickUploadThumbnailOptional')
                      }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="publishForm.type !== 'TEXT'">
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                  >{{ t('publishDialog.moreImagesLabel') }}</label
                >
                <div class="relative group h-20">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    @change="handleImagesChange"
                  />
                  <div
                    class="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-indigo-500 group-hover:bg-indigo-500/5"
                    style="border-color: var(--border-base)"
                  >
                    <UploadCloud class="w-4 h-4 text-indigo-500/40" />
                    <p class="text-[10px] font-medium" style="color: var(--text-secondary)">
                      {{
                        publishForm.images.length > 0
                          ? t('publishDialog.selectedImagesCount', { n: publishForm.images.length })
                          : t('publishDialog.clickUploadMoreImages')
                      }}
                    </p>
                  </div>
                </div>
              </div>

              <div
                v-if="publishForm.type === 'VIDEO' || publishForm.isVideo"
                class="flex items-center gap-3 py-2"
              >
                <el-switch v-model="publishForm.isVideo" active-color="var(--accent)" />
                <span class="text-xs font-bold" style="color: var(--text-secondary)"
                  >{{ t('publishDialog.isVideoWorkLabel') }}</span
                >
              </div>

              <div v-if="publishForm.isVideo">
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                  >{{ t('publishDialog.videoUrlLabel') }}</label
                >
                <input
                  v-model="publishForm.videoUrl"
                  type="text"
                  class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  :placeholder="t('publishDialog.videoUrlPlaceholder')"
                  style="color: var(--text-primary)"
                />
              </div>

              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
                  >{{ t('publishDialog.tagsLabel') }}</label
                >
                <input
                  v-model="publishForm.tags"
                  type="text"
                  class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  :placeholder="t('publishDialog.tagsPlaceholder')"
                  style="color: var(--text-primary)"
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
                :height="isMobile ? '400px' : '500px'"
              />
            </div>
          </div>
        </template>

        <!-- Publish Button -->
        <button type="button" :disabled="isPublishing" class="w-full py-4 mt-6 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2" @click="handlePublish">
          <div
            v-if="isPublishing"
            class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
          ></div>
          {{ isPublishing ? t('publishDialog.publishing') : t('publishDialog.publishNow') }}
        </button>
      </div>
    </div>
  </Transition>
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
</style>
