<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';
import type {
  ContentItem,
  ContentStatus,
  ContentTab,
  PageConfig,
  UserListItem,
} from '../composables/useAdminContents';

const props = defineProps<{
  open: boolean;
  mode: 'create' | 'edit';
  activeTab: ContentTab;
  pageConfig: PageConfig;
  editItem?: ContentItem | null;
  assetCategories: { id: string; name: string }[];
  usersList: UserListItem[];
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'success'): void;
}>();

const isSaving = ref(false);
const createMode = ref<'single' | 'batch'>('single');

const editForm = ref<Partial<ContentItem>>({});
const createForm = ref({
  title: '',
  description: '',
  status: 'APPROVED' as ContentStatus,
  categoryId: '',
  category: '',
  type: 'IMAGE',
  version: '1.0.0',
  compatibility: '',
  tags: '',
  file: null as File | null,
  thumbnail: null as File | null,
  externalUrl: '',
  externalThumbnailUrl: '',
  resolution: '2K',
  isProcedural: false,
  userId: '',
  originality: 'ORIGINAL',
  originalAuthor: '',
  originalLink: '',
  license: 'CC_BY',
  meshType: 'LOW_POLY',
  uvUnwrapped: true,
  uvOverlapping: false,
  rigged: false,
  gameReady: false,
  installGuide: '',
  bilibiliUrl: '',
});

const fileInputRef = ref<HTMLInputElement | null>(null);
const thumbnailInputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.open,
  (val) => {
    if (val && props.mode === 'edit' && props.editItem) {
      editForm.value = { ...props.editItem };
    }
  },
);

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    createForm.value.file = target.files[0];
  }
};

const handleThumbnailSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    createForm.value.thumbnail = target.files[0];
  }
};

const submitCreate = async () => {
  if (!createForm.value.title.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }
  isSaving.value = true;
  try {
    const formData = new FormData();
    formData.append('title', createForm.value.title.trim());
    formData.append('description', createForm.value.description);
    formData.append('status', createForm.value.status);
    formData.append('tags', createForm.value.tags);
    if (createForm.value.userId) formData.append('userId', createForm.value.userId);

    if (props.activeTab === 'assets') {
      formData.append('categoryId', createForm.value.categoryId);
      if (createForm.value.file) {
        formData.append('asset', createForm.value.file);
      } else {
        formData.append('externalUrl', createForm.value.externalUrl);
      }
      if (createForm.value.thumbnail) {
        formData.append('thumbnail', createForm.value.thumbnail);
      } else if (createForm.value.externalThumbnailUrl) {
        formData.append('externalThumbnailUrl', createForm.value.externalThumbnailUrl);
      }
    } else if (props.activeTab === 'materials') {
      formData.append('category', createForm.value.category);
      formData.append('resolution', createForm.value.resolution);
      formData.append('isProcedural', String(createForm.value.isProcedural));
      if (createForm.value.file) {
        formData.append('material', createForm.value.file);
      } else {
        formData.append('externalUrl', createForm.value.externalUrl);
      }
      if (createForm.value.thumbnail) {
        formData.append('thumbnail', createForm.value.thumbnail);
      } else if (createForm.value.externalThumbnailUrl) {
        formData.append('externalThumbnailUrl', createForm.value.externalThumbnailUrl);
      }
    }

    await api.post(props.pageConfig.apiPath, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success('发布成功');
    emit('update:open', false);
    emit('success');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发布失败'));
  } finally {
    isSaving.value = false;
  }
};

const submitEdit = async () => {
  if (!editForm.value.title?.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }
  isSaving.value = true;
  try {
    const payload: Record<string, any> = {
      title: editForm.value.title.trim(),
      description: editForm.value.description,
      status: editForm.value.status,
      tags: editForm.value.tags,
    };

    if (props.activeTab === 'assets') {
      payload.categoryId = editForm.value.categoryId;
    } else if (props.activeTab === 'materials') {
      payload.category = editForm.value.category;
      payload.resolution = editForm.value.resolution;
      payload.isProcedural = editForm.value.isProcedural;
    }

    await api.put(`${props.pageConfig.apiPath}/${editForm.value.id}`, payload);
    ElMessage.success('保存成功');
    emit('update:open', false);
    emit('success');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存失败'));
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <Modal
    :show="open"
    :title="mode === 'create' ? `发布${pageConfig.label}` : `编辑${pageConfig.label}`"
    size="lg"
    @close="emit('update:open', false)"
  >
    <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div v-if="mode === 'create'" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
            >标题 *</label
          >
          <UiInput v-model="createForm.title" placeholder="输入资源标题" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1">描述</label>
          <textarea
            v-model="createForm.description"
            class="w-full h-20 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent p-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-accent"
            placeholder="填写简要描述..."
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
              >资源文件</label
            >
            <input ref="fileInputRef" type="file" class="text-xs" @change="handleFileSelect" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
              >缩略图</label
            >
            <input
              ref="thumbnailInputRef"
              type="file"
              class="text-xs"
              @change="handleThumbnailSelect"
            />
          </div>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
            >标题 *</label
          >
          <UiInput v-model="editForm.title" placeholder="输入资源标题" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1">描述</label>
          <textarea
            v-model="editForm.description"
            class="w-full h-20 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent p-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-accent"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 pt-2">
        <UiButton variant="secondary" size="sm" @click="emit('update:open', false)">取消</UiButton>
        <UiButton
          variant="primary"
          size="sm"
          :loading="isSaving"
          @click="mode === 'create' ? submitCreate() : submitEdit()"
        >
          {{ mode === 'create' ? '立即发布' : '保存修改' }}
        </UiButton>
      </div>
    </template>
  </Modal>
</template>
