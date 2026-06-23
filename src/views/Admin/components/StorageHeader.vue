<script setup lang="ts">
import { Cloud, Plus, RefreshCw, Upload as UploadIcon, Download } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';

interface Props {
  syncingAll: boolean;
  isCleaning: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'sync-all'): void;
  (e: 'cleanup'): void;
  (e: 'import'): void;
  (e: 'export'): void;
  (e: 'add'): void;
}>();
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
    <div class="flex items-center gap-2.5">
      <Cloud class="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
      <div>
        <h2 class="text-base font-bold" style="color: var(--text-primary)">
          云存储管理 (Cloudflare R2)
        </h2>
        <p class="text-[9px] mt-0.5" style="color: var(--text-muted)">
          配置多个 Cloudflare R2
          账号与存储桶，并按资源类型（材质、模型、插件）分配限额。点击卡片右下角的文件夹可管理文件。
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 w-fit flex-wrap">
      <Button
        variant="outline"
        size="sm"
        :loading="props.syncingAll"
        :icon="RefreshCw"
        @click="emit('sync-all')"
      >
        {{ props.syncingAll ? '同步中...' : '一键同步全部 R2 容量' }}
      </Button>

      <Button
        variant="outline"
        size="sm"
        :loading="props.isCleaning"
        :icon="RefreshCw"
        @click="emit('cleanup')"
      >
        {{ props.isCleaning ? '正在清理...' : '一键扫描与清理' }}
      </Button>

      <Button variant="outline" size="sm" :icon="UploadIcon" @click="emit('import')">
        导入配置
      </Button>

      <Button variant="outline" size="sm" :icon="Download" @click="emit('export')">
        导出配置
      </Button>

      <Button variant="primary" size="sm" :icon="Plus" @click="emit('add')"> 添加 R2 账号 </Button>
    </div>
  </div>
</template>
