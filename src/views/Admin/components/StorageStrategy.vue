<script setup lang="ts">
import { Database } from 'lucide-vue-next';
import Switch from '@/components/ui/Switch.vue';

interface Props {
  modelValue: boolean;
  loading: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
</script>

<template>
  <div
    class="mb-4 p-4 rounded-xl border flex items-center justify-between transition-colors duration-300"
    style="background-color: var(--bg-hover); border-color: var(--border-base)"
  >
    <div class="flex items-center gap-3">
      <div class="p-2 bg-indigo-500/10 rounded-lg shrink-0">
        <Database class="w-4 h-4 text-indigo-500" />
      </div>
      <div>
        <h3 class="text-xs font-bold" style="color: var(--text-primary)">
          强制全站云端存储 (Force Cloud Storage)
        </h3>
        <p class="text-[9px] mt-0.5" style="color: var(--text-muted)">
          启用后，全站所有资源数据默认储存至 Cloudflare R2
          云端。若没有配置可用的云存储账号，用户上传文件时将提示"暂时维护中"并禁止上传。
        </p>
      </div>
    </div>
    <Switch
      :model-value="props.modelValue"
      :disabled="props.loading"
      @change="emit('update:modelValue', $event as boolean)"
    />
  </div>
</template>
