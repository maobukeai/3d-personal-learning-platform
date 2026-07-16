<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { ExternalLink } from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import type { PluginItem } from './detailTypes';
const MdPreview = defineAsyncComponent(() =>
  import('md-editor-v3').then((m) => {
    import('md-editor-v3/lib/preview.css');
    return m.MdPreview;
  }),
);
interface Props {
  plugin: PluginItem;
  isDark: boolean;
}
const props = defineProps<Props>();
const label = useLabel(); // Bilibili link player embed helper
const getBilibiliEmbedUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const match = url.match(/video\/(BV[a-zA-Z0-9]+)/i) || url.match(/bvid=(BV[a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return `//player.bilibili.com/player.html?bvid=${match[1]}&page=1&high_quality=1&as_wide=1&autoplay=0&danmaku=0`;
  }
  return undefined;
};
</script>
<template>
  <!-- Plugin Preview Image -->
  <div v-if="props.plugin.previewUrl" class="w-full flex justify-center mb-4">
    <img
      :src="getAssetUrl(props.plugin.previewUrl)"
      class="max-w-full h-auto max-h-[480px] rounded-2xl border border-black/10 dark:border-white/10 shadow-md transition-transform duration-500 hover:scale-[1.01]"
      alt="Plugin Preview"
    />
  </div>
  <!-- Description Section -->
  <div class="flex flex-col gap-2">
    <h3 class="text-sm font-bold text-[var(--text-primary)] border-l-2 border-indigo-500 pl-2">
      {{ label('插件简介', 'Plugin Overview') }}
    </h3>
    <div
      class="bg-white/[0.01] border border-white/5 rounded-2xl p-4 overflow-hidden plugin-markdown-content"
    >
      <MdPreview
        :model-value="
          props.plugin.description || label('作者暂未填写简介。', 'No plugin description yet.')
        "
        :theme="props.isDark ? 'dark' : 'light'"
        class="!bg-transparent !text-[var(--text-secondary)] !text-xs dark:invert-preview"
      />
    </div>
  </div>
  <!-- Bilibili Share Video or Homepage -->
  <div v-if="props.plugin.bilibiliUrl" class="flex flex-col gap-2">
    <h3 class="text-sm font-bold text-[var(--text-primary)] border-l-2 border-indigo-500 pl-2">
      {{ label('B站视频与分享', 'Bilibili Showcase') }}
    </h3>
    <div
      v-if="getBilibiliEmbedUrl(props.plugin.bilibiliUrl)"
      class="w-full aspect-video rounded-2xl overflow-hidden border border-white/5 bg-black shadow-inner"
    >
      <iframe
        :src="getBilibiliEmbedUrl(props.plugin.bilibiliUrl)"
        scrolling="no"
        border="0"
        frameborder="no"
        framespacing="0"
        allowfullscreen="true"
        class="w-full h-full"
      ></iframe>
    </div>
    <div
      v-else
      class="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <ExternalLink class="w-4 h-4 text-indigo-400" />
        <span class="text-xs text-[var(--text-secondary)]">{{
          label('关联 B站 链接：', 'Linked Bilibili:')
        }}</span>
        <a
          :href="props.plugin.bilibiliUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-indigo-400 hover:underline truncate max-w-[200px]"
          >{{ props.plugin.bilibiliUrl }}</a
        >
      </div>
      <a
        :href="props.plugin.bilibiliUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors border-0"
      >
        {{ label('跳转访问', 'Visit Link') }}
      </a>
    </div>
  </div>
</template>
<style scoped>
/* Markdown typography and scaling overrides for plugin description */
.plugin-markdown-content :deep(.md-editor-preview),
.plugin-markdown-content :deep(.md-preview),
.plugin-markdown-content :deep(.mdw__preview-only) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px;
  line-height: 1.6;
  background-color: transparent;
  padding: 0;
}
.plugin-markdown-content :deep(.md-editor-preview h1),
.plugin-markdown-content :deep(.md-preview h1) {
  font-size: 14px;
  margin-top: 14px;
  margin-bottom: 8px;
  font-weight: 800;
  color: var(--text-primary);
}
.plugin-markdown-content :deep(.md-editor-preview h2),
.plugin-markdown-content :deep(.md-preview h2) {
  font-size: 13px;
  margin-top: 12px;
  margin-bottom: 6px;
  font-weight: 700;
  color: var(--text-primary);
}
.plugin-markdown-content :deep(.md-editor-preview h3),
.plugin-markdown-content :deep(.md-preview h3) {
  font-size: 12px;
  margin-top: 10px;
  margin-bottom: 4px;
  font-weight: 700;
  color: var(--text-primary);
}
.plugin-markdown-content :deep(.md-editor-preview p),
.plugin-markdown-content :deep(.md-preview p),
.plugin-markdown-content :deep(.md-editor-preview li),
.plugin-markdown-content :deep(.md-preview li) {
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.plugin-markdown-content :deep(.md-editor-preview ul),
.plugin-markdown-content :deep(.md-preview ul) {
  list-style-type: disc;
  padding-left: 16px;
  margin-bottom: 8px;
}
.plugin-markdown-content :deep(.md-editor-preview ol),
.plugin-markdown-content :deep(.md-preview ol) {
  list-style-type: decimal;
  padding-left: 16px;
  margin-bottom: 8px;
}
</style>
