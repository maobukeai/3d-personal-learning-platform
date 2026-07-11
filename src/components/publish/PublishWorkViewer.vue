<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import { ImageOff, Box } from 'lucide-vue-next';
import type {
  PublishCategory,
  PublishForm,
} from './publishWorkSchema'; /** * Live preview of the work currently being published. * * Shows the selected cover image (thumbnail / plugin preview) plus the title, * category and tags so the author can sanity-check what they are about to * publish. Pure presentational component — it never mutates the form. */
const props = defineProps<{
  form: PublishForm;
  category: PublishCategory;
  activeCategoryLabel: string;
}>();
const previewFile = computed<File | null>(() => {
  if (props.category === 'plugin' || props.category === 'software') {
    return props.form.pluginPreview ?? props.form.thumbnail;
  }
  return props.form.thumbnail;
});
const objectUrl = ref('');
const releaseUrl = () => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = '';
  }
};
watch(
  previewFile,
  (file) => {
    releaseUrl();
    if (file) {
      objectUrl.value = URL.createObjectURL(file);
    }
  },
  { immediate: true },
);
onUnmounted(releaseUrl);
const tags = computed(() =>
  props.form.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean),
);
const hasContent = computed(() => Boolean(previewFile.value) || Boolean(props.form.title.trim()));
</script>
<template>
  <div
    v-if="hasContent"
    class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 glass-panel mb-3"
  >
    <!-- Cover preview -->
    <div
      class="shrink-0 w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800"
    >
      <img
        v-if="objectUrl"
        :src="objectUrl"
        alt="cover preview"
        class="w-full h-full object-cover"
      />
      <ImageOff v-else class="w-5 h-5 text-slate-400" />
    </div>
    <!-- Meta -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <Box class="w-3.5 h-3.5 text-violet-400 shrink-0" />
        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">{{
          activeCategoryLabel
        }}</span>
      </div>
      <p class="text-sm font-bold text-[var(--text-primary)] truncate mt-0.5">
        {{ form.title.trim() || '未命名作品' }}
      </p>
      <div v-if="tags.length" class="flex flex-wrap gap-1 mt-1">
        <span
          v-for="tag in tags.slice(0, 4)"
          :key="tag"
          class="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/60 px-1.5 py-0.5 rounded"
          >#{{ tag }}</span
        >
      </div>
    </div>
  </div>
</template>
