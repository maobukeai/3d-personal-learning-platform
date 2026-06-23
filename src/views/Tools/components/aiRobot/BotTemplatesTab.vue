<script setup lang="ts">
import { ref, computed } from 'vue';
import { Wand2, Copy, RefreshCw } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import type { AiBotTemplate } from '../../aiRobotAccessModel';

const props = defineProps<{
  templates: AiBotTemplate[];
  isTemplatesLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'apply-template', template: AiBotTemplate): void;
}>();

const templateCategory = ref('全部');

const templateCategories = computed(() => [
  '全部',
  ...Array.from(new Set(props.templates.map((item) => item.category))),
]);

const filteredTemplates = computed(() => {
  if (templateCategory.value === '全部') return props.templates;
  return props.templates.filter((item) => item.category === templateCategory.value);
});

const getPlatformToneClass = (platform: string) => {
  const toneMap: Record<string, string> = {
    WEWORK: 'tone-emerald',
    DINGTALK: 'tone-sky',
    FEISHU: 'tone-rose',
    CUSTOM: 'tone-amber',
  };
  return toneMap[platform] || 'tone-amber';
};

const copyText = async (value: string, label = '内容') => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    ElMessage.success(`${label}已复制`);
  } catch {
    ElMessage.warning('当前浏览器不支持自动复制');
  }
};
</script>

<template>
  <section class="mobile-adaptive space-y-3">
    <div class="tool-panel p-3">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="panel-title">
          <Wand2 class="h-4 w-4 text-amber-500" />
          <span>提示词模板工厂</span>
        </div>
        <div class="category-switch">
          <button
            v-for="category in templateCategories"
            :key="category"
            type="button"
            :class="{ active: templateCategory === category }"
            @click="templateCategory = category"
          >
            {{ category }}
          </button>
        </div>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <article v-for="template in filteredTemplates" :key="template.id" class="template-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-sm font-black text-slate-950 dark:text-white">
                {{ template.name }}
              </h2>
              <span class="platform-pill" :class="getPlatformToneClass(template.platform)">{{
                template.platform === 'ALL' ? '全平台' : template.platform
              }}</span>
            </div>
            <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {{ template.description }}
            </p>
          </div>
        </div>

        <div v-if="template.triggerKeywords?.length" class="mt-3 flex flex-wrap gap-2">
          <span v-for="keyword in template.triggerKeywords" :key="keyword" class="keyword-pill">{{
            keyword
          }}</span>
        </div>

        <div
          class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <p
            class="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300"
          >
            {{ template.systemPrompt }}
          </p>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="primary-btn" @click="emit('apply-template', template)">
            <Wand2 class="h-4 w-4" />
            <span>套用模板</span>
          </button>
          <button
            type="button"
            class="secondary-btn"
            @click="copyText(template.systemPrompt, '模板提示词')"
          >
            <Copy class="h-4 w-4" />
            <span>复制</span>
          </button>
        </div>
      </article>
    </div>

    <div v-if="isTemplatesLoading" class="empty-state-sm">
      <RefreshCw class="h-8 w-8 animate-spin text-slate-300" />
      <p>模板加载中</p>
    </div>
  </section>
</template>
