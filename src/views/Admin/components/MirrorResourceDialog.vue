<script setup lang="ts">
import { FileText } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import type { MirrorCategory } from '../AdminMirrorView.vue';

interface ResourceForm {
  title: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  tags: string;
  contentHtml: string;
  resourceType: string;
  categoryId: string;
}

const props = defineProps<{
  isEditing: boolean;
  formattedCategories: MirrorCategory[];
}>();

const show = defineModel<boolean>('show', { required: true });
const form = defineModel<ResourceForm>('form', { required: true });

const emit = defineEmits<{
  save: [];
}>();
</script>

<template>
  <Modal :show="show" size="lg" glass-card padding="md" @close="show = false">
    <template #header>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <FileText class="w-5 h-5 text-cyan-500" />
        {{ isEditing ? '编辑资源' : '新增资源' }}
      </h2>
    </template>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >标题 <span class="text-red-400">*</span></label
        >
        <input
          v-model="form.title"
          type="text"
          placeholder="资源标题"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >描述</label
        >
        <textarea
          v-model="form.description"
          rows="2"
          placeholder="资源描述..."
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 resize-none"
        ></textarea>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mobile-grid">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >分类</label
          >
          <select
            v-model="form.categoryId"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="">未分类</option>
            <option v-for="cat in formattedCategories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >资源类型</label
          >
          <input
            v-model="form.resourceType"
            type="text"
            placeholder="COURSE"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
          />
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >缩略图URL</label
        >
        <input
          v-model="form.thumbnailUrl"
          type="text"
          placeholder="https://..."
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >网盘链接 (contentUrl)</label
        >
        <input
          v-model="form.contentUrl"
          type="text"
          placeholder="网盘下载链接..."
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >标签</label
        >
        <input
          v-model="form.tags"
          type="text"
          placeholder='JSON数组格式, 如: ["3D", "教程"]'
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >正文 HTML</label
        >
        <textarea
          v-model="form.contentHtml"
          rows="6"
          placeholder="HTML内容..."
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 resize-none font-mono text-xs"
        ></textarea>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        @click="show = false"
      >
        取消
      </button>
      <button
        type="button"
        class="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
        @click="emit('save')"
      >
        {{ isEditing ? '保存' : '创建' }}
      </button>
    </template>
  </Modal>
</template>
