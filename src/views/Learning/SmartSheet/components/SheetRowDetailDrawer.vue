<script setup lang="ts">
import { ref, watch } from 'vue';
import Drawer from '@/components/ui/Drawer.vue';
import Button from '@/components/ui/Button.vue';

const props = defineProps<{
  show: boolean;
  content: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'save', text: string): void;
}>();

const textVal = ref('');

watch(
  () => props.content,
  (val) => {
    textVal.value = val || '';
  },
  { immediate: true },
);

const handleSave = () => {
  emit('save', textVal.value);
  emit('update:show', false);
};
</script>

<template>
  <Drawer
    :model-value="show"
    title="编辑长文本 / 详细心得"
    size="md"
    direction="rtl"
    @update:model-value="emit('update:show', $event)"
  >
    <div class="space-y-4 p-4">
      <p class="text-xs text-neutral-400">支持录入多行长文本心得、代码笔记或富文本感言：</p>
      <textarea
        v-model="textVal"
        rows="14"
        class="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-neutral-100 focus:outline-none focus:border-blue-500/50 resize-none font-mono leading-relaxed"
        placeholder="录入详细描述..."
      ></textarea>

      <div class="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" @click="emit('update:show', false)">取消</Button>
        <Button variant="primary" size="sm" @click="handleSave">保存改动</Button>
      </div>
    </div>
  </Drawer>
</template>
