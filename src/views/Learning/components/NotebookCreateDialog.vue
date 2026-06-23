<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

const props = defineProps<{
  localNotebooks: string[];
  categories: string[];
}>();

const emit = defineEmits<{
  (e: 'created', name: string): void;
}>();

const visible = ref(false);
const newNotebookName = ref('');

const open = () => {
  newNotebookName.value = '';
  visible.value = true;
};

const handleCreate = () => {
  const name = newNotebookName.value.trim();
  if (!name) return;
  if (props.localNotebooks.includes(name) || props.categories.includes(name)) {
    ElMessage.warning('该笔记本已存在');
    return;
  }
  emit('created', name);
  visible.value = false;
};

defineExpose({ open });
</script>

<template>
  <Modal :show="visible" title="新建笔记本" size="sm" glass-card @close="visible = false">
    <div class="mobile-adaptive space-y-4">
      <div>
        <label
          class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2 block"
          >笔记本名称</label
        >
        <Input
          v-model="newNotebookName"
          placeholder="例如：Three.js 进阶"
          @keyup.enter="handleCreate"
        />
      </div>
    </div>
    <template #footer>
      <div class="mobile-row flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="visible = false">取消</Button>
        <Button variant="primary" size="sm" class="font-bold" @click="handleCreate">创建</Button>
      </div>
    </template>
  </Modal>
</template>
