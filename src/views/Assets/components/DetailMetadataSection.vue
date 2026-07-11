<script setup lang="ts">
import {
  FileArchive,
  FolderOpen,
  Folder,
  Box,
  Settings,
  Shield,
  ExternalLink,
  RefreshCw,
} from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import type { FlattenedNode } from '@/utils/zipHelper';
import type { PluginItem } from './detailTypes';
interface Props {
  plugin: PluginItem;
  packageFiles: string[];
  isPackageFilesLoading: boolean;
  visibleFileNodes: FlattenedNode[];
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}
const props = defineProps<Props>();
const label = useLabel();
const getTagsList = (tags?: string) =>
  (tags || '')
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);
</script>
<template>
  <!-- ZIP File Explorer -->
  <div
    v-if="props.isPackageFilesLoading || props.packageFiles.length > 0"
    class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left shrink-0"
  >
    <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
      <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
      <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
        {{ label('压缩包包含', 'Package Contents') }}
        <span v-if="!props.isPackageFilesLoading">({{ props.packageFiles.length }})</span>
      </span>
      <RefreshCw
        v-if="props.isPackageFilesLoading"
        class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0"
      />
    </div>
    <div
      v-if="props.isPackageFilesLoading"
      class="p-3 flex items-center gap-2 text-xs text-[var(--text-muted)]"
    >
      <span>{{ label('正在读取...', 'Reading...') }}</span>
    </div>
    <div
      v-else
      class="p-2.5 flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scrollbar text-xs text-[var(--text-secondary)] font-mono"
    >
      <div
        v-for="node in props.visibleFileNodes"
        :key="node.path"
        class="flex items-center gap-1.5 py-0.5 hover:bg-[var(--bg-hover)] px-2 rounded transition-colors"
        :class="{ 'cursor-pointer select-none': node.isFolder }"
        :style="{ paddingLeft: node.level * 14 + 4 + 'px' }"
        @click="node.isFolder ? props.toggleFolder(node.path) : null"
      >
        <component
          :is="props.expandedFolders.has(node.path) ? FolderOpen : Folder"
          v-if="node.isFolder"
          class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400/80 shrink-0"
        />
        <template v-else>
          <Box class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        </template>
        <span class="truncate min-w-0"> {{ node.name }} </span>
      </div>
    </div>
  </div>
  <!-- Telemetry Stats Card -->
  <div
    class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left"
  >
    <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
      <Settings class="h-3.5 w-3.5 text-teal-400" />
      <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
        {{ label('技术参数与规格', 'Specifications') }}
      </span>
    </div>
    <div class="p-3 flex flex-col gap-2 text-xs">
      <div class="flex justify-between">
        <span class="text-[var(--text-muted)]">{{ label('兼容版本', 'Compatibility') }}</span>
        <span
          class="font-semibold text-[var(--text-secondary)] truncate max-w-[120px]"
          :title="props.plugin.compatibility"
          >{{ props.plugin.compatibility || '-' }}</span
        >
      </div>
      <div class="flex justify-between">
        <span class="text-[var(--text-muted)]">{{ label('当前版本', 'Version') }}</span>
        <span class="font-semibold text-[var(--text-secondary)]">v{{ props.plugin.version }}</span>
      </div>
    </div>
  </div>
  <!-- Copyright Info -->
  <div
    class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left"
  >
    <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
      <Shield class="h-3.5 w-3.5 text-indigo-400" />
      <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
        {{ label('版权与许可协议', 'Copyright & Licensing') }}
      </span>
    </div>
    <div class="p-3 flex flex-col gap-2 text-xs">
      <div class="flex justify-between">
        <span class="text-[var(--text-muted)]">{{ label('原创属性', 'Originality') }}</span>
        <span class="font-semibold text-[var(--text-secondary)]">
          {{
            props.plugin.originality === 'ORIGINAL'
              ? label('原创', 'Original')
              : props.plugin.originality === 'AUTHORIZED'
                ? label('授权发布', 'Authorized')
                : label('二次创作', 'Remix')
          }}
        </span>
      </div>
      <div v-if="props.plugin.license" class="flex justify-between">
        <span class="text-[var(--text-muted)]">{{ label('授权协议', 'License') }}</span>
        <span class="font-semibold text-teal-400 uppercase text-[10px]">{{
          props.plugin.license.replace('_', ' ')
        }}</span>
      </div>
      <div
        v-if="props.plugin.originality !== 'ORIGINAL' && props.plugin.originalAuthor"
        class="flex justify-between"
      >
        <span class="text-[var(--text-muted)]">{{ label('原作者', 'Original Author') }}</span>
        <span
          class="font-semibold text-[var(--text-secondary)] truncate max-w-[100px]"
          :title="props.plugin.originalAuthor"
          >{{ props.plugin.originalAuthor }}</span
        >
      </div>
      <div
        v-if="props.plugin.originality !== 'ORIGINAL' && props.plugin.originalLink"
        class="flex justify-between items-center"
      >
        <span class="text-[var(--text-muted)]">{{ label('原作链接', 'Original Link') }}</span>
        <a
          :href="props.plugin.originalLink"
          target="_blank"
          class="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
        >
          {{ label('查看', 'Link') }} <ExternalLink class="h-3 w-3" />
        </a>
      </div>
    </div>
  </div>
  <!-- Tags badges Card -->
  <div
    v-if="getTagsList(props.plugin.tags).length > 0"
    class="border border-white/10 rounded-2xl p-3 bg-white/[0.01] dark:bg-white/[0.02] text-left"
  >
    <span
      class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2"
      >{{ label('相关标签', 'Tags') }}</span
    >
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="tag in getTagsList(props.plugin.tags)"
        :key="tag"
        class="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.04] text-[var(--text-secondary)] border border-white/5 font-medium"
      >
        #{{ tag }}
      </span>
    </div>
  </div>
</template>
<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 99px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
