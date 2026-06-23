<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import Input from '@/components/ui/Input.vue';
import type { CategoryType, UnifiedWork } from '../myWorksModel';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

interface EditForm {
  title: string;
  description: string;
  tags: string;
  categoryId: string;
  materialCategory: string;
  resolution: string;
  isProcedural: boolean;
  pluginCategory: string;
  pluginVersion: string;
  pluginCompatibility: string;
  showcaseType: string;
  videoUrl: string;
}

const show = defineModel<boolean>('show', { required: true });
const form = defineModel<EditForm>('form', { required: true });

const props = defineProps<{
  work: UnifiedWork | null;
  isSaving: boolean;
  assetCategories: CategoryType[];
  materialCategories: string[];
  pluginCategories: string[];
}>();

const emit = defineEmits<{
  save: [];
  cancel: [];
}>();

const title = computed({
  get: () => form.value.title,
  set: (v) => emitUpdate({ title: v }),
});
const description = computed({
  get: () => form.value.description,
  set: (v) => emitUpdate({ description: v }),
});
const tags = computed({
  get: () => form.value.tags,
  set: (v) => emitUpdate({ tags: v }),
});
const categoryId = computed({
  get: () => form.value.categoryId,
  set: (v) => emitUpdate({ categoryId: v }),
});
const materialCategory = computed({
  get: () => form.value.materialCategory,
  set: (v) => emitUpdate({ materialCategory: v }),
});
const resolution = computed({
  get: () => form.value.resolution,
  set: (v) => emitUpdate({ resolution: v }),
});
const isProcedural = computed({
  get: () => form.value.isProcedural,
  set: (v) => emitUpdate({ isProcedural: v }),
});
const pluginCategory = computed({
  get: () => form.value.pluginCategory,
  set: (v) => emitUpdate({ pluginCategory: v }),
});
const pluginVersion = computed({
  get: () => form.value.pluginVersion,
  set: (v) => emitUpdate({ pluginVersion: v }),
});
const pluginCompatibility = computed({
  get: () => form.value.pluginCompatibility,
  set: (v) => emitUpdate({ pluginCompatibility: v }),
});
const showcaseType = computed({
  get: () => form.value.showcaseType,
  set: (v) => emitUpdate({ showcaseType: v }),
});
const videoUrl = computed({
  get: () => form.value.videoUrl,
  set: (v) => emitUpdate({ videoUrl: v }),
});

function emitUpdate(patch: Partial<EditForm>) {
  form.value = { ...form.value, ...patch };
}
</script>

<template>
  <Modal :show="show && !!work" size="xl" glass-card @close="show = false">
    <template #header>
      <div>
        <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
          编辑作品
        </h3>
        <p class="text-xs text-[var(--text-muted)] mt-1">保存后会根据内容类型重新提交审核。</p>
      </div>
    </template>

    <div v-if="work" class="edit-grid">
      <div class="col-span-2">
        <Input v-model="title" type="text" label="作品名称" required />
      </div>

      <label v-if="work.kind === 'asset'" class="form-field flex flex-col col-span-2 sm:col-span-1">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >资源分类</span
        >
        <select
          v-model="categoryId"
          class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">未分类</option>
          <option v-for="category in assetCategories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </label>

      <template v-if="work.kind === 'material'">
        <label class="form-field flex flex-col col-span-2 sm:col-span-1">
          <span
            class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
            >材料分类</span
          >
          <select
            v-model="materialCategory"
            class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option v-for="category in materialCategories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </label>
        <label class="form-field flex flex-col col-span-2 sm:col-span-1">
          <span
            class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
            >分辨率</span
          >
          <select
            v-model="resolution"
            class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="2K">2K</option>
            <option value="4K">4K</option>
            <option value="8K">8K</option>
            <option value="矢量">矢量</option>
            <option value="程序化">程序化</option>
          </select>
        </label>
        <div class="col-span-2 flex items-center py-2">
          <Checkbox v-model="isProcedural">程序化材质</Checkbox>
        </div>
      </template>

      <template v-if="work.kind === 'plugin'">
        <label class="form-field flex flex-col col-span-2 sm:col-span-1">
          <span
            class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
            >插件分类</span
          >
          <select
            v-model="pluginCategory"
            class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option v-for="category in pluginCategories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </label>
        <div class="col-span-2 sm:col-span-1">
          <Input v-model="pluginVersion" type="text" label="版本" />
        </div>
        <div class="col-span-2">
          <Input v-model="pluginCompatibility" type="text" label="兼容版本" />
        </div>
      </template>

      <template v-if="work.kind === 'showcase'">
        <label class="form-field flex flex-col col-span-2 sm:col-span-1">
          <span
            class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
            >展示类型</span
          >
          <select
            v-model="showcaseType"
            class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="IMAGE">图片作品</option>
            <option value="VIDEO">视频作品</option>
            <option value="MODEL">模型展示</option>
            <option value="TEXT">图文作品</option>
            <option value="OTHER">其他</option>
          </select>
        </label>
        <div v-if="showcaseType === 'VIDEO'" class="col-span-2 sm:col-span-1">
          <Input v-model="videoUrl" type="text" label="视频链接" />
        </div>
      </template>

      <div class="col-span-2">
        <Input v-model="tags" type="text" label="标签" placeholder="用逗号分隔多个标签" />
      </div>

      <label class="form-field wide editor-field col-span-2">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >作品说明</span
        >
        <MarkdownEditor
          v-model="description"
          height="280px"
          placeholder="描述作品用途、制作说明、安装方式或更新内容"
          simple
        />
      </label>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="show = false"> 取消 </Button>
        <Button variant="primary" size="sm" :loading="isSaving" @click="emit('save')">
          保存并提交审核
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
@media (max-width: 680px) {
  .edit-grid {
    grid-template-columns: 1fr;
  }
}
</style>
