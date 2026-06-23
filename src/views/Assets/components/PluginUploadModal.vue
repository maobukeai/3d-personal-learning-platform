<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useLabel } from '@/utils/i18n';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import FileDropZone from '@/components/FileDropZone.vue';

const CATEGORY_ALL = '全部插件';
const CATEGORY_OTHER = '其他工具';

interface UploadForm {
  title: string;
  category: string;
  description: string;
  version: string;
  compatibility: string;
  tags: string;
  installGuide: string;
}

const props = defineProps<{
  show: boolean;
  form: UploadForm;
  uploadCategories: string[];
  pluginFile: File | null;
  previewFile: File | null;
  isUploading: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:form', value: UploadForm): void;
  (e: 'update:pluginFile', value: File | null): void;
  (e: 'update:previewFile', value: File | null): void;
  (e: 'pluginFileChange', event: Event): void;
  (e: 'previewFileChange', event: Event): void;
}>();

const label = useLabel();
const { locale } = useI18n();

const categoryLabel = (category?: string | null) => {
  const normalized = category || CATEGORY_OTHER;
  const englishLabels: Record<string, string> = {
    [CATEGORY_ALL]: 'All Add-ons',
    [CATEGORY_OTHER]: 'Other Utilities',
    建模: 'Modeling',
    材质与纹理: 'Materials & Texturing',
    渲染与灯光: 'Rendering & Lighting',
    动画与骨骼: 'Animation & Rigging',
    导入与导出: 'Import & Export',
    物理与特效: 'Physics & FX',
  };
  return locale.value === 'en-US' ? englishLabels[normalized] || normalized : normalized;
};

const updateField = <K extends keyof UploadForm>(field: K, value: UploadForm[K]) => {
  emit('update:form', { ...props.form, [field]: value });
};

const formatSize = (size?: number | null) => {
  if (!size) return label('未知大小', 'Unknown size');
  if (size >= 1) return `${size.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size * 1024))} KB`;
};
</script>

<template>
  <Modal :show="show" size="xxl" glass-card @close="emit('close')">
    <template #header>
      <div>
        <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
          {{ label('上传插件', 'Upload Plugin') }}
        </h3>
        <p class="text-xs text-[var(--text-muted)] mt-1">
          {{
            label(
              '提交后进入管理员审核，通过后公开展示。',
              'Submissions enter admin review before public listing.',
            )
          }}
        </p>
      </div>
    </template>

    <div class="upload-grid">
      <div class="col-span-2">
        <Input
          :model-value="form.title"
          type="text"
          :label="label('插件名称', 'Plugin Name')"
          :placeholder="label('给插件起个清晰的名字', 'Give the plugin a clear name')"
          required
          @update:model-value="updateField('title', $event as string)"
        />
      </div>
      <label class="flex flex-col">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
        >
          {{ label('分类', 'Category') }}
        </span>
        <select
          :value="form.category"
          class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          @change="updateField('category', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="category in uploadCategories" :key="category" :value="category">
            {{ categoryLabel(category) }}
          </option>
        </select>
      </label>
      <Input
        :model-value="form.version"
        type="text"
        :label="label('版本', 'Version')"
        placeholder="1.0.0"
        required
        @update:model-value="updateField('version', $event as string)"
      />
      <div class="col-span-2">
        <Input
          :model-value="form.compatibility"
          type="text"
          :label="label('兼容版本', 'Compatibility')"
          :placeholder="
            label('如 Blender 4.x / Three.js r160+', 'e.g. Blender 4.x / Three.js r160+')
          "
          @update:model-value="updateField('compatibility', $event as string)"
        />
      </div>
      <div class="col-span-2">
        <Input
          :model-value="form.tags"
          type="text"
          :label="label('标签', 'Tags')"
          :placeholder="
            label('用逗号分隔，如 glTF, 优化, 渲染', 'Comma-separated, e.g. glTF, optimize, render')
          "
          @update:model-value="updateField('tags', $event as string)"
        />
      </div>
      <label class="wide flex flex-col col-span-2">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
        >
          {{ label('简介', 'Description') }}
        </span>
        <textarea
          :value="form.description"
          rows="3"
          class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          :placeholder="
            label(
              '介绍插件用途、适用场景和核心能力',
              'Describe use cases, scenarios, and core capabilities',
            )
          "
          @input="updateField('description', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <label class="wide flex flex-col col-span-2">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
        >
          {{ label('安装说明', 'Installation Guide') }}
        </span>
        <textarea
          :value="form.installGuide"
          rows="4"
          class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          :placeholder="
            label(
              '写清楚安装步骤、依赖版本和注意事项',
              'Include install steps, dependencies, and notes',
            )
          "
          @input="updateField('installGuide', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
    </div>

    <div class="file-grid">
      <div class="w-full">
        <FileDropZone
          :model-value="pluginFile"
          accept=".zip,.py,.js,.jsx,.ts,.tsx,.blend,.addon,.tgz,.tar,.gz"
          :label="pluginFile?.name || label('选择插件文件', 'Choose Plugin File')"
          :sublabel="
            pluginFile
              ? formatSize(pluginFile.size / 1024 / 1024)
              : label('支持 ZIP、脚本、插件包等格式', 'Supports ZIP, scripts, and plugin packages')
          "
          height-class="h-28"
          @update:model-value="emit('update:pluginFile', $event as File | null)"
          @change="emit('pluginFileChange', $event)"
        />
      </div>

      <div class="w-full">
        <FileDropZone
          :model-value="previewFile"
          accept="image/*"
          :label="previewFile?.name || label('上传预览图', 'Upload Preview')"
          :sublabel="
            previewFile
              ? formatSize(previewFile.size / 1024 / 1024)
              : label('可选，用于插件卡片封面', 'Optional cover for plugin cards')
          "
          height-class="h-28"
          @update:model-value="emit('update:previewFile', $event as File | null)"
          @change="emit('previewFileChange', $event)"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="emit('close')">
          {{ label('取消', 'Cancel') }}
        </Button>
        <Button variant="primary" size="sm" :loading="isUploading" @click="emit('submit')">
          {{ label('提交审核', 'Submit for Review') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.upload-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.upload-grid label.wide {
  grid-column: 1 / -1;
}

.upload-grid label span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.upload-grid input,
.upload-grid select,
.upload-grid textarea {
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--bg-app);
  font-size: 12px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.col-span-2 {
  grid-column: span 2 / span 2;
}

@media (max-width: 760px) {
  .upload-grid,
  .file-grid {
    grid-template-columns: 1fr;
  }

  .col-span-2 {
    grid-column: auto;
  }
}
</style>
