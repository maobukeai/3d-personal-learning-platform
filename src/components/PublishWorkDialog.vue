<script setup lang="ts">
import { onMounted } from 'vue';
import { Box, Layers, Puzzle, UploadCloud } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Input from '@/components/ui/Input.vue';
import UiButton from '@/components/ui/Button.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import PublishAssetForm from '@/components/publish/PublishAssetForm.vue';
import PublishMaterialForm from '@/components/publish/PublishMaterialForm.vue';
import PublishPluginForm from '@/components/publish/PublishPluginForm.vue';
import { usePublishWork, type PublishCategory } from '@/composables/usePublishWork';

const props = defineProps<{
  modelValue: boolean;
  defaultCategory?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'published'): void;
}>();

const {
  isPublishing,
  publishCategory,
  assetCategories,
  formData,
  fetchAssetCategories,
  submitPublish,
} = usePublishWork(() => emit('published'));

const categoryOptions = [
  { label: '3D 模型', value: 'asset' as const, icon: Box },
  { label: '材质贴图', value: 'material' as const, icon: Layers },
  { label: '插件扩展', value: 'plugin' as const, icon: Puzzle },
];

onMounted(() => {
  fetchAssetCategories();
  if (props.defaultCategory && ['asset', 'material', 'plugin'].includes(props.defaultCategory)) {
    publishCategory.value = props.defaultCategory as PublishCategory;
  }
});
</script>

<template>
  <Modal
    :show="modelValue"
    title="发布创作与资源"
    size="lg"
    @close="emit('update:modelValue', false)"
  >
    <div class="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <!-- Category Switcher Tabs -->
      <Tabs v-model="publishCategory" :options="categoryOptions" variant="solid" />

      <!-- Common Fields: Title & Description -->
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
            >标题 *</label
          >
          <Input v-model="formData.title" placeholder="为你的作品取个响亮的名称" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
            >资源详细介绍</label
          >
          <textarea
            v-model="formData.description"
            class="w-full h-20 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent p-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-accent"
            placeholder="介绍模型特点、适用场景、制作细节等..."
          />
        </div>
      </div>

      <!-- Specific Form Sections -->
      <PublishAssetForm
        v-if="publishCategory === 'asset'"
        v-model:form-data="formData"
        :asset-categories="assetCategories"
      />

      <PublishMaterialForm
        v-else-if="publishCategory === 'material'"
        v-model:form-data="formData"
      />

      <PublishPluginForm
        v-else-if="publishCategory === 'plugin' || publishCategory === 'software'"
        v-model:form-data="formData"
      />

      <!-- Common Thumbnail Dropzone -->
      <div>
        <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
          >封面/预览图</label
        >
        <FileDropZone
          v-model="formData.thumbnail"
          label="拖拽或点击上传封面/预览图"
          accept="image/*"
        />
      </div>

      <!-- Download Mode Settings -->
      <div class="pt-2 border-t border-slate-100 dark:border-white/5 space-y-3">
        <div class="flex items-center gap-4">
          <label class="text-xs font-semibold text-[var(--text-secondary)]">下载存放方式：</label>
          <label
            class="flex items-center gap-1.5 text-xs text-[var(--text-primary)] cursor-pointer"
          >
            <input v-model="formData.downloadType" type="radio" value="local" />
            文件直传 (R2 云存储)
          </label>
          <label
            class="flex items-center gap-1.5 text-xs text-[var(--text-primary)] cursor-pointer"
          >
            <input v-model="formData.downloadType" type="radio" value="external" />
            第三方网盘外链
          </label>
        </div>

        <div v-if="formData.downloadType === 'external'" class="grid grid-cols-3 gap-2">
          <div class="col-span-2">
            <Input
              v-model="formData.externalUrl"
              placeholder="输入百度网盘 / 夸克 / Google Drive 链接"
            />
          </div>
          <div>
            <Input v-model="formData.extractionCode" placeholder="提取码 (选填)" />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 pt-2">
        <UiButton variant="secondary" size="sm" @click="emit('update:modelValue', false)"
          >取消</UiButton
        >
        <UiButton
          variant="primary"
          size="sm"
          :icon="UploadCloud"
          :loading="isPublishing"
          @click="submitPublish(() => emit('update:modelValue', false))"
        >
          立即提交发布
        </UiButton>
      </div>
    </template>
  </Modal>
</template>
