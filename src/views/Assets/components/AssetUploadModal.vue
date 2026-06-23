<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { UploadCloud, CheckCircle2 } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import Tabs from '@/components/ui/Tabs.vue';
import { useLabel } from '@/utils/i18n';
import type { AssetInsightCategory, AssetUploadForm } from '../assetLibraryModel';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const props = defineProps<{
  show: boolean;
  uploadForm: AssetUploadForm;
  isUploading: boolean;
  uploadCanSubmit: boolean;
  categories: AssetInsightCategory[];
  uploadFormatOptions: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:uploadForm', value: AssetUploadForm): void;
  (e: 'fileChange', event: Event): void;
  (e: 'thumbnailChange', event: Event): void;
}>();

const label = useLabel();

const uploadTypeOptions = computed(() => [
  { value: 'file', label: label('本地文件', 'Local File'), icon: UploadCloud },
  { value: 'link', label: label('外部链接', 'External Link'), icon: CheckCircle2 },
]);

const updateForm = <K extends keyof AssetUploadForm>(field: K, value: AssetUploadForm[K]) => {
  emit('update:uploadForm', { ...props.uploadForm, [field]: value });
};

const localUploadType = computed({
  get: () => props.uploadForm.uploadType,
  set: (value) => updateForm('uploadType', value as 'file' | 'link'),
});

const localTitle = computed({
  get: () => props.uploadForm.title,
  set: (value) => updateForm('title', value),
});

const localExternalUrl = computed({
  get: () => props.uploadForm.externalUrl,
  set: (value) => updateForm('externalUrl', value),
});

const localCategory = computed({
  get: () => props.uploadForm.categoryId,
  set: (value) => updateForm('categoryId', value),
});

const localTags = computed({
  get: () => props.uploadForm.tags,
  set: (value) => updateForm('tags', value),
});

const localDescription = computed({
  get: () => props.uploadForm.description,
  set: (value) => updateForm('description', value),
});

const toggleFormat = (format: string, checked: boolean) => {
  const next = checked
    ? [...props.uploadForm.formats, format]
    : props.uploadForm.formats.filter((f) => f !== format);
  updateForm('formats', next);
};
</script>

<template>
  <Modal :show="show" size="xxl" glass-card @close="emit('close')">
    <template #header>
      <div>
        <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
          {{ label('上传资源', 'Upload Asset') }}
        </h3>
        <p class="text-xs text-[var(--text-muted)] mt-1">
          {{
            label(
              '提交后进入审核，通过后展示在资源库。',
              'Submissions go through review before appearing in the library.',
            )
          }}
        </p>
      </div>
    </template>

    <div class="upload-type-switch mb-5">
      <Tabs v-model="localUploadType" :options="uploadTypeOptions" size="sm" />
    </div>

    <div class="upload-grid">
      <div class="upload-column">
        <label v-if="uploadForm.uploadType === 'file'" class="drop-zone mb-4 block">
          <input
            type="file"
            accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.blend,.usdz,.abc,.zip"
            @change="emit('fileChange', $event)"
          />
          <UploadCloud class="drop-icon" />
          <strong>{{
            uploadForm.file?.name || label('选择模型或资源包', 'Choose a model or asset package')
          }}</strong>
          <span>{{
            label(
              '支持 GLB、FBX、OBJ、STL、BLEND、ZIP 等格式',
              'Supports GLB, FBX, OBJ, STL, BLEND, ZIP, and more',
            )
          }}</span>
        </label>

        <div v-else class="mb-4">
          <Input
            v-model="localExternalUrl"
            type="url"
            :label="label('外部资源地址', 'External Asset URL')"
            placeholder="https://..."
          />
        </div>

        <div class="mb-4">
          <Input
            v-model="localTitle"
            type="text"
            :label="label('资源名称', 'Asset Name')"
            :placeholder="label('例如：工业机器人机械臂', 'Example: Industrial robot arm')"
            required
          />
        </div>

        <div class="two-col grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label class="form-field flex flex-col">
            <span
              class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
            >
              {{ label('分类', 'Category') }}
            </span>
            <el-select
              v-model="localCategory"
              class="w-full custom-dialog-input"
              :placeholder="label('选择分类', 'Select category')"
            >
              <el-option value="" :label="label('选择分类', 'Select category')" />
              <el-option v-for="category in categories" :key="category.id" :label="category.name" :value="category.id" />
            </el-select>
          </label>

          <label class="file-picker flex flex-col">
            <span
              class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
            >
              {{ label('封面图', 'Cover Image') }}
            </span>
            <div class="relative w-full">
              <input
                type="file"
                accept="image/*"
                class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                @change="emit('thumbnailChange', $event)"
              />
              <div
                class="glass-input text-sm p-3.5 rounded-xl text-center font-bold tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {{ uploadForm.thumbnail?.name || label('可选封面图文件', 'Optional cover image') }}
              </div>
            </div>
          </label>
        </div>

        <div class="mb-4">
          <Input
            v-model="localTags"
            type="text"
            :label="label('标签', 'Tags')"
            :placeholder="label('PBR, 低面数, 游戏资产', 'PBR, low-poly, game asset')"
          />
        </div>

        <div
          v-if="uploadForm.file?.name.toLowerCase().endsWith('.zip')"
          class="format-checks flex flex-col gap-2.5 p-4 rounded-xl glass-panel border border-white/10 mb-4"
        >
          <span
            class="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1"
          >
            {{ label('压缩包内格式', 'Formats inside ZIP') }}
          </span>
          <div class="flex flex-wrap gap-4">
            <Checkbox
              v-for="format in uploadFormatOptions"
              :key="format"
              :model-value="uploadForm.formats.includes(format)"
              @update:model-value="(val) => toggleFormat(format, val as boolean)"
            >
              {{ format }}
            </Checkbox>
          </div>
        </div>
      </div>

      <div class="upload-column">
        <label class="form-field editor-field flex flex-col h-full">
          <span
            class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >
            {{ label('资源说明', 'Asset Description') }}
          </span>
          <MarkdownEditor
            v-model="localDescription"
            :placeholder="
              label(
                '写清楚用途、格式、面数、贴图、授权或使用注意事项',
                'Describe usage, formats, poly count, textures, license, or notes',
              )
            "
            height="360px"
            simple
          />
        </label>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="emit('close')">
          {{ label('取消', 'Cancel') }}
        </Button>
        <Button
          variant="primary"
          size="sm"
          :loading="isUploading"
          :disabled="!uploadCanSubmit"
          @click="emit('submit')"
        >
          {{ label('提交审核', 'Submit for Review') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.upload-type-switch {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: var(--bg-hover);
  border: 1px solid var(--border-base);
}

.upload-type-switch :deep(button) {
  flex: 1;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.upload-type-switch :deep(button:hover) {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.4);
}

.dark .upload-type-switch :deep(button:hover) {
  background: rgba(255, 255, 255, 0.06);
}

.upload-type-switch :deep(button.active) {
  background: var(--bg-card);
  color: var(--accent);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-weight: 600;
}

.upload-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.1fr);
  gap: 12px;
  margin-top: 12px;
}

.upload-column {
  display: grid;
  align-content: start;
  gap: 10px;
}

.drop-zone {
  position: relative;
  display: grid;
  place-items: center;
  gap: 4px;
  min-height: 118px;
  border: 1px dashed var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  text-align: center;
}

.drop-zone input,
.file-picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop-icon {
  width: 24px;
  height: 24px;
  color: var(--accent);
}

.drop-zone strong,
.file-picker strong {
  max-width: 90%;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drop-zone span {
  color: var(--text-muted);
  font-size: 10px;
}

.form-field,
.file-picker,
.format-checks {
  position: relative;
  display: grid;
  gap: 4px;
}

.form-field > span,
.file-picker > span,
.format-checks > span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.form-field input,
.form-field select,
.file-picker strong {
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 0 10px;
  font-size: 12px;
}

.file-picker strong {
  display: flex;
  align-items: center;
}

.two-col {
  display: flex;
  align-items: end;
  gap: 8px;
}

.two-col > * {
  flex: 1;
}

.editor-field :deep(.markdown-editor) {
  min-width: 0;
}

.format-checks {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 8px;
}

.format-checks > span {
  grid-column: 1 / -1;
}

.format-checks label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}

@media (max-width: 860px) {
  .upload-grid {
    grid-template-columns: 1fr;
  }

  .format-checks {
    grid-template-columns: 1fr;
  }
}
</style>
