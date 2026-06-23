<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useLabel } from '@/utils/i18n';
import FileDropZone from '@/components/FileDropZone.vue';
import Input from '@/components/ui/Input.vue';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';

interface MaterialForm {
  title: string;
  description: string;
  category: string;
  resolution: string;
  tags: string;
  isProcedural: boolean;
  file: File | null;
  preview: File | null;
}

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const props = defineProps<{
  modelValue: MaterialForm;
  isEditing: boolean;
  isOpen: boolean;
  categories: string[];
  resolutionOptions: string[];
  isUploading: boolean;
  canSubmit: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: MaterialForm): void;
  (e: 'submit'): void;
  (e: 'close'): void;
}>();

const label = useLabel();

const form = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const onFileChange = (value: File | File[] | null) => {
  const file = Array.isArray(value) ? value[0] || null : value;
  if (file && !form.value.title.trim()) {
    form.value.title = file.name.replace(/\.[^.]+$/, '');
  }
};
</script>

<template>
  <Modal :show="isOpen" size="xxl" glass-card @close="emit('close')">
    <template #header>
      <div>
        <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
          {{
            isEditing ? label('编辑材料', 'Edit Material') : label('上传材质', 'Upload Material')
          }}
        </h3>
        <p class="text-xs text-[var(--text-muted)] mt-1">
          {{
            isEditing
              ? label('保存后将重新进入审核流程', 'Saving will send it back to review')
              : label('提交贴图包或 SBSAR 文件', 'Submit texture packs or SBSAR files')
          }}
        </p>
      </div>
    </template>

    <div class="dialog-grid">
      <div class="dialog-column">
        <template v-if="!isEditing">
          <div class="mb-4 w-full">
            <FileDropZone
              v-model="form.file"
              accept=".zip,.sbsar"
              :label="form.file?.name || label('选择材料包', 'Choose Material Pack')"
              sublabel="ZIP / SBSAR"
              height-class="h-28"
              @update:model-value="onFileChange"
            />
          </div>

          <div class="mb-4 w-full">
            <FileDropZone
              v-model="form.preview"
              accept="image/*"
              :label="form.preview?.name || label('上传预览图', 'Upload Preview')"
              :sublabel="label('方形或 16:10 封面', 'Square or 16:10 cover')"
              height-class="h-28"
            />
          </div>
        </template>

        <div class="mb-4">
          <Input
            v-model="form.title"
            type="text"
            :label="label('材料名称', 'Material Name')"
            :placeholder="label('磨砂金属 PBR 套装', 'Brushed metal PBR set')"
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
            <select
              v-model="form.category"
              class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option v-for="category in categories" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
          </label>
          <label class="form-field flex flex-col">
            <span
              class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
            >
              {{ label('分辨率', 'Resolution') }}
            </span>
            <select
              v-model="form.resolution"
              class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option v-for="resolution in resolutionOptions" :key="resolution" :value="resolution">
                {{ resolution }}
              </option>
            </select>
          </label>
        </div>

        <label class="switch-row mb-4">
          <input v-model="form.isProcedural" type="checkbox" />
          <span>{{ label('程序化材质 / SBSAR', 'Procedural Material / SBSAR') }}</span>
        </label>

        <div class="mb-4">
          <Input
            v-model="form.tags"
            type="text"
            :label="label('标签', 'Tags')"
            :placeholder="label('PBR, 金属, 4K, 游戏资产', 'PBR, metal, 4K, game asset')"
          />
        </div>
      </div>

      <div class="dialog-column">
        <label class="form-field editor-field">
          <span>{{ label('材料说明', 'Material Description') }}</span>
          <MarkdownEditor
            v-model="form.description"
            :placeholder="
              label(
                '贴图通道、使用场景、授权或引擎导入注意事项',
                'Texture channels, use cases, license, or engine import notes',
              )
            "
            height="330px"
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
          :disabled="!canSubmit"
          @click="emit('submit')"
        >
          {{ isEditing ? label('保存', 'Save') : label('提交审核', 'Submit for Review') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.dialog-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.86fr) minmax(0, 1.14fr);
  gap: 12px;
}

.dialog-column {
  display: grid;
  align-content: start;
  gap: 8px;
}

.form-field,
.switch-row {
  display: grid;
  gap: 4px;
}

.form-field > span,
.switch-row span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.form-field input,
.form-field select {
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 0 10px;
  font-size: 12px;
}

.two-col {
  display: flex;
  align-items: end;
  gap: 8px;
}

.two-col > * {
  flex: 1;
}

.switch-row {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 8px;
}

.editor-field :deep(.markdown-editor) {
  min-width: 0;
}

.glass-input {
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: var(--bg-app);
  color: var(--text-primary);
}

@media (max-width: 860px) {
  .dialog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
