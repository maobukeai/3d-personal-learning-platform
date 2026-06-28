<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent, onUnmounted } from 'vue';
import { logError } from '@/utils/error';
import { UploadCloud, Film, X, Plus, Sparkles } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useMobile } from '@/composables/useMobile';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

type ShowcaseType = 'IMAGE' | 'VIDEO' | 'MODEL' | 'TEXT' | 'OTHER';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'published'): void;
}>();

const isPublishing = ref(false);
const { isMobile } = useMobile();

// Form states
const title = ref('');
const description = ref('');
const type = ref<ShowcaseType>('IMAGE');
const tags = ref('');
const videoUrl = ref('');
const isVideo = ref(false);

// File states
const coverFile = ref<File | null>(null);
const coverPreviewUrl = ref('');
const galleryFiles = ref<File[]>([]);
const galleryPreviews = ref<string[]>([]);

// Selection lists loaded from backend
const myApprovedAssets = ref<Array<{ id: string; title: string }>>([]);
const myApprovedMaterials = ref<Array<{ id: string; title: string }>>([]);
const myApprovedPlugins = ref<Array<{ id: string; title: string }>>([]);

// Selected IDs
const selectedAssetIds = ref<string[]>([]);
const selectedMaterialIds = ref<string[]>([]);
const selectedPluginIds = ref<string[]>([]);

// Fetch user's approved assets, materials, and plugins
const fetchUserResources = async () => {
  try {
    const [assetsRes, materialsRes, pluginsRes] = await Promise.all([
      api.get('/api/assets/my'),
      api.get('/api/materials/my'),
      api.get('/api/plugins/my'),
    ]);
    
    myApprovedAssets.value = (assetsRes.data || []).filter(
      (item: any) => item.status === 'APPROVED'
    );
    myApprovedMaterials.value = (materialsRes.data || []).filter(
      (item: any) => item.status === 'APPROVED'
    );
    myApprovedPlugins.value = (pluginsRes.data || []).filter(
      (item: any) => item.status === 'APPROVED'
    );
  } catch (error) {
    logError(error, { operation: 'Failed to fetch user approved resources' });
  }
};

const initDialog = () => {
  title.value = '';
  description.value = '';
  type.value = 'IMAGE';
  tags.value = '';
  videoUrl.value = '';
  isVideo.value = false;
  
  coverFile.value = null;
  if (coverPreviewUrl.value) {
    URL.revokeObjectURL(coverPreviewUrl.value);
    coverPreviewUrl.value = '';
  }
  galleryFiles.value = [];
  galleryPreviews.value.forEach(url => URL.revokeObjectURL(url));
  galleryPreviews.value = [];
  
  selectedAssetIds.value = [];
  selectedMaterialIds.value = [];
  selectedPluginIds.value = [];
  
  fetchUserResources();
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      initDialog();
    }
  }
);

// Cover Image Handlers
const handleCoverChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    if (coverPreviewUrl.value) URL.revokeObjectURL(coverPreviewUrl.value);
    coverFile.value = file;
    coverPreviewUrl.value = URL.createObjectURL(file);
  }
};

const removeCover = () => {
  if (coverPreviewUrl.value) URL.revokeObjectURL(coverPreviewUrl.value);
  coverFile.value = null;
  coverPreviewUrl.value = '';
};

// Gallery Images Handlers
const handleGalleryChange = (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || []);
  files.forEach(file => {
    galleryFiles.value.push(file);
    galleryPreviews.value.push(URL.createObjectURL(file));
  });
};

const removeGalleryItem = (index: number) => {
  URL.revokeObjectURL(galleryPreviews.value[index]);
  galleryFiles.value.splice(index, 1);
  galleryPreviews.value.splice(index, 1);
};

const cleanupPreviews = () => {
  if (coverPreviewUrl.value) {
    URL.revokeObjectURL(coverPreviewUrl.value);
    coverPreviewUrl.value = '';
  }
  galleryPreviews.value.forEach(url => URL.revokeObjectURL(url));
  galleryPreviews.value = [];
};

const closeDialog = () => {
  cleanupPreviews();
  emit('update:modelValue', false);
};

onUnmounted(() => {
  cleanupPreviews();
});

const isVideoFile = (file: File) => {
  return file && file.type ? file.type.startsWith('video/') : false;
};

const hasVideoFile = computed(() => {
  return galleryFiles.value.some(file => isVideoFile(file));
});

const handlePublish = async () => {
  if (!title.value.trim()) {
    ElMessage.warning('作品标题不能为空');
    return;
  }
  
  if (!coverFile.value) {
    ElMessage.warning('封面缩略图是必填项');
    return;
  }
  
  isPublishing.value = true;
  try {
    const formData = new FormData();
    formData.append('title', title.value.trim());
    formData.append('description', description.value);
    formData.append('tags', tags.value);
    formData.append('type', type.value);
    formData.append('videoUrl', videoUrl.value);
    formData.append('isVideo', String(isVideo.value || hasVideoFile.value || type.value === 'VIDEO'));
    
    if (coverFile.value) {
      formData.append('thumbnail', coverFile.value);
    }
    
    galleryFiles.value.forEach(file => {
      formData.append('images', file);
    });
    
    formData.append('linkedAssetIds', JSON.stringify(selectedAssetIds.value));
    formData.append('linkedMaterialIds', JSON.stringify(selectedMaterialIds.value));
    formData.append('linkedPluginIds', JSON.stringify(selectedPluginIds.value));
    
    await api.post('/api/showcase', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    
    ElMessage.success('创意作品发布成功！将在管理员审核通过后公开展示');
    emit('published');
    closeDialog();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '发布失败，请稍后重试');
  } finally {
    isPublishing.value = false;
  }
};
</script>

<template>
  <Modal :show="modelValue" size="xxl" glass-card @close="closeDialog">
    <template #header>
      <div class="flex items-center gap-2">
        <Sparkles class="w-5 h-5 text-indigo-500 animate-pulse" />
        <div>
          <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
            发布创意作品
          </h3>
          <p class="text-xs text-[var(--text-muted)] mt-0.5">
            分享渲染图、视频、图文帖子，并引入关联你自己的作品，进行一站式聚集展示。
          </p>
        </div>
      </div>
    </template>

    <div class="space-y-4 max-h-[76vh] overflow-y-auto px-1 pr-2 pb-4 scrollbar-hide">
      <!-- Three-column layout grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        <!-- Left Column: Basics & Resource Linking (4 cols) -->
        <div class="lg:col-span-4 space-y-3 flex flex-col justify-between">
          <div>
            <Input
              v-model="title"
              type="text"
              label="创意作品标题 *"
              placeholder="例如：赛博朋克城市雨夜渲染展示"
              required
            />
          </div>

          <!-- Showcase Type Selector -->
          <div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              作品类型 *
            </label>
            <el-select v-model="type" class="w-full custom-select-v2" placeholder="选择类型">
              <el-option label="图集作品 (Image)" value="IMAGE" />
              <el-option label="视频作品 (Video)" value="VIDEO" />
              <el-option label="3D模型作品 (Model)" value="MODEL" />
              <el-option label="图文说明 (Text)" value="TEXT" />
              <el-option label="其他分类 (Other)" value="OTHER" />
            </el-select>
          </div>

          <!-- Video URL Input -->
          <div v-if="type === 'VIDEO'">
            <Input
              v-model="videoUrl"
              type="text"
              label="视频链接 (支持 YouTube / Bilibili / Vimeo 等)"
              placeholder="例如：https://www.youtube.com/watch?v=..."
            />
          </div>

          <!-- Cover Upload -->
          <div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              封面缩略图 *
            </label>
            <div
              v-if="coverPreviewUrl"
              class="relative aspect-[16/9] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 h-[80px]"
            >
              <img :src="coverPreviewUrl" class="w-full h-full object-cover" alt="Cover Preview" />
              <button
                type="button"
                class="absolute top-1 right-1 p-0.5 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white border-0 cursor-pointer transition-colors"
                @click="removeCover"
              >
                <X class="w-3 h-3" />
              </button>
            </div>
            <div v-else class="relative group h-[80px]">
              <input
                type="file"
                accept="image/*"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                @change="handleCoverChange"
              />
              <div
                class="w-full h-full border border-dashed rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all group-hover:border-indigo-500 bg-slate-50 dark:bg-white/5"
                style="border-color: var(--border-base)"
              >
                <UploadCloud class="w-4 h-4 text-slate-400" />
                <p class="text-[10px] font-bold text-slate-500">上传封面</p>
              </div>
            </div>
          </div>

          <div>
            <Input
              v-model="tags"
              type="text"
              label="作品标签"
              placeholder="Render, Blender, 用逗号分隔"
            />
          </div>

          <!-- Stacked Resource Selectors -->
          <div class="space-y-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
            <h4 class="text-[10px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1">
              <Sparkles class="w-3 h-3 text-indigo-500 animate-spin-slow" />
              关联我发布的 APPROVED 素材
            </h4>

            <div>
              <label class="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-0.5">
                嵌入关联的 3D 作品
              </label>
              <el-select
                v-model="selectedAssetIds"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="支持搜索已审核模型"
                class="w-full custom-select-v2"
              >
                <el-option
                  v-for="asset in myApprovedAssets"
                  :key="asset.id"
                  :label="asset.title"
                  :value="asset.id"
                />
              </el-select>
            </div>

            <div>
              <label class="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-0.5">
                嵌入关联的材质作品
              </label>
              <el-select
                v-model="selectedMaterialIds"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="支持搜索已审核材质"
                class="w-full custom-select-v2"
              >
                <el-option
                  v-for="mat in myApprovedMaterials"
                  :key="mat.id"
                  :label="mat.title"
                  :value="mat.id"
                />
              </el-select>
            </div>

            <div>
              <label class="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-0.5">
                嵌入关联的插件作品
              </label>
              <el-select
                v-model="selectedPluginIds"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="支持搜索已审核插件"
                class="w-full custom-select-v2"
              >
                <el-option
                  v-for="plugin in myApprovedPlugins"
                  :key="plugin.id"
                  :label="plugin.title"
                  :value="plugin.id"
                />
              </el-select>
            </div>
          </div>
        </div>

        <!-- Middle Column: Gallery uploads (3 cols) -->
        <div class="lg:col-span-3 flex flex-col space-y-2">
          <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
            展示图集 (支持图片/视频)
          </label>
          
          <!-- Dropzone -->
          <div class="relative group h-16">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              @change="handleGalleryChange"
            />
            <div
              class="w-full h-full border border-dashed rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all group-hover:border-indigo-500 bg-slate-50 dark:bg-white/5"
              style="border-color: var(--border-base)"
            >
              <Plus class="w-4 h-4 text-slate-400" />
              <span class="text-[9px] font-bold text-slate-500">添加图片或视频</span>
            </div>
          </div>

          <!-- Thumbnail previews list (scrollable if many) -->
          <div class="flex-1 overflow-y-auto max-h-[260px] border border-slate-200/50 dark:border-slate-800/50 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/30 scrollbar-hide">
            <div v-if="galleryPreviews.length === 0" class="h-full flex items-center justify-center text-[10px] text-slate-400 py-10">
              暂未添加展示图片/视频
            </div>
            <div v-else class="grid grid-cols-2 gap-2">
              <div
                v-for="(url, idx) in galleryPreviews"
                :key="url"
                class="relative aspect-square rounded-lg overflow-hidden border border-slate-200/60 dark:border-slate-800/40 bg-slate-100 dark:bg-slate-950 flex items-center justify-center"
              >
                <video
                  v-if="isVideoFile(galleryFiles[idx])"
                  :src="url"
                  class="w-full h-full object-cover"
                  muted
                  playsinline
                ></video>
                <img v-else :src="url" class="w-full h-full object-cover" alt="Gallery item" />
                
                <div v-if="isVideoFile(galleryFiles[idx])" class="absolute top-1 left-1 p-0.5 rounded bg-black/60 text-white text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5">
                  <Film class="w-2.5 h-2.5" />
                  视频
                </div>
                
                <button
                  type="button"
                  class="absolute top-1 right-1 p-0.5 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white border-0 cursor-pointer transition-colors"
                  @click="removeGalleryItem(idx)"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Rich Markdown Editor (5 cols) -->
        <div class="lg:col-span-5 flex flex-col space-y-2">
          <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
            创意说明及作品详情 (支持图文)
          </label>
          <div class="flex-1">
            <MarkdownEditor
              v-model="description"
              placeholder="分享你的灵感来源，制作的心得，或者直接在此插入插图..."
              height="300px"
              simple
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <template #footer>
      <div class="flex justify-end gap-2.5">
        <button
          type="button"
          class="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer"
          @click="closeDialog"
        >
          取消
        </button>
        <button
          type="button"
          class="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all rounded-xl border-0 cursor-pointer shadow-md shadow-indigo-200 dark:shadow-none flex items-center gap-1.5"
          :disabled="isPublishing"
          @click="handlePublish"
        >
          <span v-if="isPublishing">正在发布...</span>
          <span v-else>发布创意作品</span>
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.custom-select-v2 :deep(.el-input__wrapper),
.custom-select-v2 :deep(.el-select__wrapper) {
  border-radius: 12px !important;
  background-color: var(--bg-surface) !important;
  box-shadow: 0 0 0 1px var(--border-base) inset !important;
  padding: 4px 10px !important;
  min-height: 38px !important;
  height: 38px !important;
}
.custom-select-v2 :deep(.el-input__inner) {
  height: 100% !important;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
