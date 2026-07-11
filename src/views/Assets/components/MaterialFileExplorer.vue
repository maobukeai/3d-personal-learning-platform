<script setup lang="ts">
import {
  FileArchive,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  Box,
  Image as ImageIcon,
} from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import type { FlattenedNode } from '@/utils/zipHelper'; /** * Collapsible ZIP package-contents tree for MaterialDetailPanel. * Purely presentational — tree state is owned by the parent and passed in. */
defineProps<{
  packageFiles: string[];
  isPackageFilesLoading: boolean;
  visibleNodes: FlattenedNode[];
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}>();
const collapsed = defineModel<boolean>('collapsed', { default: true });
const label = useLabel();
</script>
<template>
  <div
    v-if="isPackageFilesLoading || packageFiles.length > 0"
    class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left shrink-0"
  >
    <div
      class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02] cursor-pointer select-none hover:bg-white/[0.04] transition-colors"
      @click="collapsed = !collapsed"
    >
      <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
      <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
        {{ label('源文件压缩包包含', 'Package Contents') }}
        <span v-if="!isPackageFilesLoading">({{ packageFiles.length }})</span>
      </span>
      <RefreshCw
        v-if="isPackageFilesLoading"
        class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0"
      />
      <component
        :is="collapsed ? ChevronRight : ChevronDown"
        v-else
        class="h-4 w-4 text-[var(--text-muted)] ml-auto shrink-0 transition-transform duration-200"
      />
    </div>
    <div
      v-if="isPackageFilesLoading && !collapsed"
      class="p-3 flex items-center gap-2 text-xs text-[var(--text-muted)]"
    >
      <span>{{ label('正在读取压缩包目录...', 'Reading package contents...') }}</span>
    </div>
    <div
      v-else-if="!collapsed"
      class="p-2.5 flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scrollbar text-xs text-[var(--text-secondary)] font-mono"
    >
      <div
        v-for="node in visibleNodes"
        :key="node.path"
        class="flex items-center gap-1.5 py-0.5 hover:bg-[var(--bg-hover)] px-2 rounded transition-colors"
        :class="{ 'cursor-pointer select-none': node.isFolder }"
        :style="{ paddingLeft: node.level * 14 + 4 + 'px' }"
        @click="node.isFolder ? toggleFolder(node.path) : null"
      >
        <component
          :is="expandedFolders.has(node.path) ? FolderOpen : Folder"
          v-if="node.isFolder"
          class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400/80 shrink-0"
        />
        <template v-else>
          <Box
            v-if="
              node.name.toLowerCase().endsWith('.glb') ||
              node.name.toLowerCase().endsWith('.gltf') ||
              node.name.toLowerCase().endsWith('.fbx') ||
              node.name.toLowerCase().endsWith('.obj') ||
              node.name.toLowerCase().endsWith('.blend')
            "
            class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0"
          />
          <ImageIcon
            v-else-if="
              node.name.toLowerCase().endsWith('.png') ||
              node.name.toLowerCase().endsWith('.jpg') ||
              node.name.toLowerCase().endsWith('.jpeg') ||
              node.name.toLowerCase().endsWith('.tga') ||
              node.name.toLowerCase().endsWith('.exr') ||
              node.name.toLowerCase().endsWith('.hdr') ||
              node.name.toLowerCase().endsWith('.tiff')
            "
            class="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0"
          />
          <FileArchive v-else class="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
        </template>
        <span
          class="truncate min-w-0"
          :class="{
            'text-indigo-600 dark:text-indigo-300 font-semibold':
              !node.isFolder &&
              (node.name.toLowerCase().endsWith('.glb') ||
                node.name.toLowerCase().endsWith('.gltf') ||
                node.name.toLowerCase().endsWith('.fbx') ||
                node.name.toLowerCase().endsWith('.obj') ||
                node.name.toLowerCase().endsWith('.blend')),
          }"
        >
          {{ node.name }}
        </span>
      </div>
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
