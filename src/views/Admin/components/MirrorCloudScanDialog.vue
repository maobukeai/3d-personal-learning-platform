<script setup lang="ts">
import { Search, RefreshCw, Database } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { getAssetUrl } from '@/utils/api';

interface CloudSource {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  iconUrl: string | null;
  totalResources: number;
  isConnected: boolean;
  metadataKey: string;
}

const props = defineProps<{
  isScanningCloud: boolean;
  isConnectingCloud: boolean;
  cloudSources: CloudSource[];
}>();

const show = defineModel<boolean>('show', { required: true });

const emit = defineEmits<{
  refresh: [];
  connect: [metadataKey: string];
}>();
</script>

<template>
  <Modal :show="show" size="xl" glass-card @close="show = false">
    <template #header>
      <div class="flex items-center gap-2">
        <Search class="w-5 h-5 text-blue-500" />
        <h3 class="text-lg font-semibold text-[var(--text-primary)]">
          扫描云端镜像源 (Cloudflare R2)
        </h3>
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-xs text-slate-500 dark:text-slate-400">
        系统将自动检索 Cloudflare R2
        存储桶中已同步的镜像站数据（`metadata.json`），您可以一键将其接入当前系统，无需重复下载或上传媒体文件，共享云端存储。
      </p>

      <!-- Loading State -->
      <div v-if="isScanningCloud" class="flex flex-col items-center justify-center py-12">
        <RefreshCw class="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <span class="text-sm text-slate-500 dark:text-slate-400"
          >正在扫描云端存储中，这可能需要几秒钟...</span
        >
      </div>

      <!-- Empty State -->
      <div
        v-else-if="cloudSources.length === 0"
        class="flex flex-col items-center justify-center py-12 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl"
      >
        <Database class="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
        <span class="text-sm text-slate-500 dark:text-slate-400"
          >未在 Cloudflare R2 存储桶中扫描到任何镜像源</span
        >
      </div>

      <!-- Discovered List Table -->
      <div
        v-else
        class="border border-slate-100 dark:border-slate-700/80 rounded-xl overflow-hidden mobile-table"
      >
        <table class="w-full text-left border-collapse">
          <thead>
            <tr
              class="bg-slate-50 dark:bg-slate-800/40 text-[11px] font-black tracking-wider uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/80"
            >
              <th class="px-5 py-3">图标</th>
              <th class="px-5 py-3">镜像源显示名称 / 名称</th>
              <th class="px-5 py-3">资源数量</th>
              <th class="px-5 py-3">唯一识别 ID</th>
              <th class="px-5 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/80 text-xs">
            <tr
              v-for="item in cloudSources"
              :key="item.id"
              class="hover:bg-slate-50/40 dark:hover:bg-white/[0.02] transition-colors"
            >
              <td class="px-5 py-3">
                <img
                  v-if="item.iconUrl"
                  :src="getAssetUrl(item.iconUrl)"
                  class="w-7 h-7 rounded-lg object-cover bg-slate-100 dark:bg-slate-700"
                />
                <div
                  v-else
                  class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-[10px]"
                >
                  {{ item.displayName.charAt(0) }}
                </div>
              </td>
              <td class="px-5 py-3">
                <div class="font-bold text-slate-800 dark:text-slate-200">
                  {{ item.displayName }}
                </div>
                <div class="text-[10px] text-slate-400 dark:text-slate-500">
                  {{ item.name }}
                </div>
              </td>
              <td class="px-5 py-3 text-slate-600 dark:text-slate-400 font-medium">
                {{ item.totalResources }} 个资源
              </td>
              <td class="px-5 py-3 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                {{ item.id }}
              </td>
              <td class="px-5 py-3 text-right">
                <Button
                  v-if="item.isConnected"
                  variant="secondary"
                  size="sm"
                  :loading="isConnectingCloud"
                  @click="emit('connect', item.metadataKey)"
                >
                  重新接入 (更新)
                </Button>
                <Button
                  v-else
                  variant="primary"
                  size="sm"
                  :loading="isConnectingCloud"
                  @click="emit('connect', item.metadataKey)"
                >
                  一键接入
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <Button
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isScanningCloud"
          @click="emit('refresh')"
        >
          重新扫描
        </Button>
        <Button variant="secondary" size="sm" @click="show = false"> 关闭 </Button>
      </div>
    </template>
  </Modal>
</template>
