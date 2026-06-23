<script setup lang="ts">
import { Database, ExternalLink, FolderOpen, Edit2, Trash2, Eye, EyeOff } from 'lucide-vue-next';
import { formatCloudflareBytes, getUsagePercentage } from '@/utils/storageBytes';
import Button from '@/components/ui/Button.vue';
import Switch from '@/components/ui/Switch.vue';
import Badge from '@/components/ui/Badge.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import type { StorageConfig, AssetTypeOption } from './StorageSettingsTab.types';

interface Props {
  configs: StorageConfig[];
  loading: boolean;
  assetTypes: AssetTypeOption[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'edit', config: StorageConfig): void;
  (e: 'delete', config: StorageConfig): void;
  (e: 'toggle-status', config: StorageConfig): void;
  (e: 'open-explorer', config: StorageConfig): void;
  (e: 'toggle-mask', config: StorageConfig): void;
}>();

const getAssetTypeLabel = (value: string) => {
  const matched = props.assetTypes.find((t) => t.value === value);
  return matched ? matched.label.split(' ')[0] : value;
};
</script>

<template>
  <!-- Loading State -->
  <div v-if="props.loading" class="flex flex-col items-center justify-center py-20 gap-3">
    <Skeleton width="32px" height="32px" circle />
    <Skeleton width="120px" height="12px" />
  </div>

  <!-- Empty State -->
  <div
    v-else-if="props.configs.length === 0"
    class="flex flex-col items-center justify-center py-16 px-4 border border-dashed rounded-2xl text-center"
    style="border-color: var(--border-base)"
  >
    <Database class="w-10 h-10 text-slate-300 dark:text-white/10 mb-3" />
    <span class="text-xs font-bold" style="color: var(--text-secondary)">暂未配置云存储账号</span>
    <p class="text-[10px] mt-1 max-w-xs" style="color: var(--text-muted)">
      所有上传的资源文件目前将保存在服务器本地磁盘。强烈建议配置至少一个 Cloudflare R2
      云端存储账号。
    </p>
  </div>

  <!-- Config Cards List -->
  <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mobile-grid">
    <div
      v-for="config in props.configs"
      :key="config.id"
      class="group p-3 rounded-lg border transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
      :class="[
        config.status === 'ACTIVE'
          ? 'hover:shadow-md hover:-translate-y-0.5'
          : 'opacity-70 grayscale',
      ]"
      style="background-color: var(--bg-app); border-color: var(--border-base)"
    >
      <!-- Progress highlight bar on top -->
      <div
        class="absolute top-0 left-0 h-0.5 transition-all duration-300"
        :class="[
          getUsagePercentage(config.usedBytes, config.limitGb) >= 95
            ? 'bg-rose-500 shadow-sm shadow-rose-500/20'
            : 'bg-indigo-500 shadow-sm shadow-indigo-500/20',
        ]"
        :style="{ width: getUsagePercentage(config.usedBytes, config.limitGb) + '%' }"
      ></div>

      <div>
        <!-- Header: Title and Type -->
        <div class="flex items-start justify-between mb-1.5">
          <div class="space-y-0.5 max-w-[70%]">
            <div class="flex items-center gap-1.5">
              <span
                class="font-bold text-xs truncate"
                style="color: var(--text-primary)"
                :title="config.name"
                >{{ config.name }}</span
              >
              <Switch
                :model-value="config.status === 'ACTIVE'"
                @change="emit('toggle-status', config)"
              />
            </div>
            <div
              class="flex items-center gap-1 text-[9px] truncate"
              style="color: var(--text-muted)"
            >
              <Database class="w-2.5 h-2.5 shrink-0" />
              <span class="truncate" :title="config.bucketName">桶: {{ config.bucketName }}</span>
            </div>
            <div
              v-if="config.remark"
              class="text-[9px] font-bold text-indigo-500/80 truncate mt-0.5"
              :title="config.remark"
            >
              备注: {{ config.remark }}
            </div>
          </div>

          <Badge variant="primary" outline>
            {{ getAssetTypeLabel(config.assetType) }}
          </Badge>
        </div>

        <!-- Endpoint Detail -->
        <div
          class="space-y-0.5 text-[9px] mb-1.5 font-mono p-1.5 rounded-md relative group/endpoint pr-6"
          style="background-color: var(--bg-card); color: var(--text-secondary)"
        >
          <div class="truncate">
            终端:
            <span
              :class="{
                'blur-[3.5px] select-none pointer-events-none transition-all duration-300':
                  config.isMasked !== false,
              }"
              >{{ config.endpoint }}</span
            >
          </div>
          <div class="truncate flex items-center gap-1">
            <span>域名: </span>
            <span
              :class="{
                'blur-[3.5px] select-none pointer-events-none transition-all duration-300':
                  config.isMasked !== false,
              }"
              >{{ config.publicUrl }}</span
            >
            <a :href="config.publicUrl" target="_blank" class="hover:text-indigo-500 shrink-0">
              <ExternalLink class="w-2 h-2 inline" />
            </a>
          </div>

          <!-- Mask Toggle Button -->
          <button
            type="button"
            class="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            :title="config.isMasked !== false ? '显示明文' : '马赛克隐藏'"
            @click="emit('toggle-mask', config)"
          >
            <EyeOff v-if="config.isMasked !== false" class="w-3 h-3" />
            <Eye v-else class="w-3 h-3" />
          </button>
        </div>

        <!-- Capacity Info -->
        <div class="space-y-0.5 mb-2">
          <div class="flex items-center justify-between text-[9px]">
            <span style="color: var(--text-muted)">容量配额使用率</span>
            <span class="font-bold font-mono" style="color: var(--text-primary)">
              {{ getUsagePercentage(config.usedBytes, config.limitGb) }}%
            </span>
          </div>

          <!-- Custom designed CSS progress bar -->
          <div
            class="w-full h-1 rounded-full overflow-hidden"
            style="background-color: var(--bg-card)"
          >
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="[
                getUsagePercentage(config.usedBytes, config.limitGb) >= 95
                  ? 'bg-gradient-to-r from-red-500 to-rose-600'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600',
              ]"
              :style="{ width: getUsagePercentage(config.usedBytes, config.limitGb) + '%' }"
            ></div>
          </div>

          <!-- Numerical detail precise to decimals -->
          <div
            class="flex items-center justify-between text-[8px]"
            style="color: var(--text-muted)"
          >
            <span>已用: {{ formatCloudflareBytes(config.usedBytes) }}</span>
            <span>限制: {{ config.limitGb.toFixed(3) }} GB</span>
          </div>
        </div>
      </div>

      <!-- Bottom: Action Buttons -->
      <div
        class="flex items-center justify-between pt-1.5 border-t"
        style="border-color: var(--border-base)"
      >
        <div class="text-[8px]" style="color: var(--text-muted)">
          优先级:
          <span class="font-bold text-slate-800 dark:text-slate-200">#{{ config.priority }}</span>
        </div>

        <div class="flex items-center gap-1.5">
          <Button
            variant="link"
            size="sm"
            :icon="FolderOpen"
            title="浏览/管理文件"
            @click="emit('open-explorer', config)"
          />
          <Button
            variant="link"
            size="sm"
            :icon="Edit2"
            title="编辑配置"
            @click="emit('edit', config)"
          />
          <Button
            variant="danger"
            size="sm"
            :icon="Trash2"
            title="删除配置"
            @click="emit('delete', config)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
