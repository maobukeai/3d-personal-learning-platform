<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  FileArchive,
  RefreshCw,
  FolderOpen,
  Folder,
  Box,
  Image as ImageIcon,
  FileText,
} from 'lucide-vue-next';
import type { FlattenedNode } from '@/utils/zipHelper';

defineProps<{
  file?: any;
  isParsingZip: boolean;
  parsedFileTree: FlattenedNode[];
  visibleFileNodes: FlattenedNode[];
  expandedFolders: Set<string>;
  show?: boolean;
  emptyLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'toggle', path: string): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="show !== false && (file || parsedFileTree.length > 0 || isParsingZip)"
    class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left mt-3 shrink-0"
  >
    <div
      class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]"
    >
      <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
      <span
        class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]"
      >
        {{ t('publishDialog.packageContents') || '压缩包包含' }}
        <span v-if="!isParsingZip && parsedFileTree.length > 0"
          >({{ parsedFileTree.length }})</span
        >
      </span>
      <RefreshCw
        v-if="isParsingZip"
        class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0"
      />
    </div>
    <div
      v-if="isParsingZip"
      class="p-4 flex items-center gap-2 text-xs text-[var(--text-muted)]"
    >
      <span>{{
        t('publishDialog.readingPackageContents') || '正在读取压缩包目录...'
      }}</span>
    </div>
    <div
      v-else-if="parsedFileTree.length > 0"
      class="p-3 flex flex-col gap-1 max-h-[180px] overflow-y-auto custom-scrollbar text-xs text-[var(--text-secondary)] font-mono"
    >
      <div
        v-for="node in visibleFileNodes"
        :key="node.path"
        class="flex items-center gap-1.5 py-1 hover:bg-white/[0.03] px-2 rounded transition-colors"
        :class="{ 'cursor-pointer select-none': node.isFolder }"
        :style="{ paddingLeft: node.level * 14 + 6 + 'px' }"
        @click="node.isFolder ? emit('toggle', node.path) : null"
      >
        <component
          :is="expandedFolders.has(node.path) ? FolderOpen : Folder"
          v-if="node.isFolder"
          class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400/80 shrink-0"
        />
        <template v-else>
          <!-- Blender SVG Icon -->
          <svg
            v-if="node.name.toLowerCase().endsWith('.blend')"
            class="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 128 128"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M66.332 70.032c.24-4.242 2.327-7.987 5.485-10.634 3.094-2.602 7.248-4.193 11.809-4.193 4.537 0 8.69 1.59 11.78 4.193 3.163 2.647 5.237 6.392 5.485 10.634.24 4.35-1.523 8.41-4.605 11.417-3.158 3.05-7.627 4.977-12.66 4.977-5.037 0-9.526-1.915-12.664-4.977-3.094-3.006-4.853-7.044-4.606-11.397zm0 0"
              fill="#235785"
            />
            <path
              d="M39.245 79.002c.028 1.66.564 4.89 1.36 7.404 1.682 5.336 4.537 10.273 8.49 14.599 4.062 4.465 9.074 8.055 14.85 10.61 6.073 2.67 12.665 4.037 19.505 4.037 6.84-.009 13.432-1.4 19.504-4.102 5.776-2.582 10.79-6.168 14.85-10.657 3.974-4.374 6.82-9.307 8.491-14.647a37 37 0 001.595-8.163c.208-2.69.12-5.405-.263-8.12a37.535 37.535 0 00-5.417-14.714c-2.574-4.15-5.916-7.76-9.89-10.813l.012-.004-39.955-30.506c-.036-.028-.068-.056-.104-.08-2.619-2.002-7.044-1.994-9.91.008-2.914 2.031-3.25 5.385-.656 7.496l-.012.008 16.682 13.484-50.789.051h-.068c-4.197.004-8.239 2.739-9.03 6.213-.82 3.521 2.035 6.46 6.412 6.46l-.008.016 25.736-.048L4.58 82.524c-.056.044-.12.088-.176.132C.069 85.95-1.33 91.446 1.4 94.9c2.778 3.522 8.666 3.546 13.047.02L39.505 74.51s-.368 2.758-.336 4.397zm64.56 9.219c-5.168 5.228-12.416 8.21-20.227 8.21-7.831.012-15.079-2.918-20.248-8.142-2.526-2.559-4.377-5.473-5.528-8.591a22.202 22.202 0 01-1.271-9.602 22.446 22.446 0 012.778-9.039c1.507-2.714 3.59-5.18 6.14-7.267 5.033-4.058 11.42-6.28 18.1-6.28 6.709-.008 13.097 2.174 18.13 6.236 2.55 2.075 4.625 4.529 6.14 7.243a22.302 22.302 0 012.774 9.043 22.302 22.302 0 01-1.271 9.598c-1.147 3.142-3.002 6.056-5.533 8.615zm0 0"
              fill="#e87500"
            />
          </svg>
          <Box
            v-else-if="
              node.name.toLowerCase().endsWith('.glb') ||
              node.name.toLowerCase().endsWith('.gltf') ||
              node.name.toLowerCase().endsWith('.fbx') ||
              node.name.toLowerCase().endsWith('.obj')
            "
            class="h-3.5 w-3.5 text-indigo-500 shrink-0"
          />
          <ImageIcon
            v-else-if="
              node.name.toLowerCase().endsWith('.png') ||
              node.name.toLowerCase().endsWith('.jpg') ||
              node.name.toLowerCase().endsWith('.jpeg') ||
              node.name.toLowerCase().endsWith('.tga') ||
              node.name.toLowerCase().endsWith('.hdr')
            "
            class="h-3.5 w-3.5 text-teal-500 shrink-0"
          />
          <FileArchive
            v-else-if="
              node.name.toLowerCase().endsWith('.zip') ||
              node.name.toLowerCase().endsWith('.rar') ||
              node.name.toLowerCase().endsWith('.7z')
            "
            class="h-3.5 w-3.5 text-amber-500 shrink-0"
          />
          <FileText v-else class="h-3.5 w-3.5 text-slate-400 shrink-0" />
        </template>
        <span
          class="truncate"
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
    <div v-else class="p-4 text-center text-xs text-[var(--text-muted)]">
      <span>{{ emptyLabel || t('publishDialog.packageEmpty') || '压缩包无文件目录或已被清空' }}</span>
    </div>
  </div>
</template>
