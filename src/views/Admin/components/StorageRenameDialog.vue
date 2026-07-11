<script setup lang="ts">
import FormDialog from '@/components/FormDialog.vue';
import Input from '@/components/ui/Input.vue';
import type { ExplorerItem } from './StorageSettingsTab.types';

interface Props {
  loading: boolean;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', { required: true });
const newName = defineModel<string>('newName', { required: true });
const target = defineModel<ExplorerItem | null>('target', { required: true });

const emit = defineEmits<{
  (e: 'confirm'): void;
}>();
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    title="重命名文件"
    size="sm"
    :loading="props.loading"
    confirm-text="确认重命名"
    @submit="emit('confirm')"
    @cancel="visible = false"
  >
    <div class="space-y-3">
      <p class="text-[11px] break-all" style="color: var(--text-muted)">
        当前 Key: {{ target?.key }}
      </p>
      <Input v-model="newName" placeholder="新文件名" />
    </div>
  </FormDialog>
</template>
