<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

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
  <el-dialog
    v-model="visible"
    title="新建笔记本"
    width="360px"
    destroy-on-close
  >
    <div class="space-y-4">
      <div>
        <label class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2 block">笔记本名称</label>
        <el-input v-model="newNotebookName" placeholder="例如：Three.js 进阶" @keyup.enter="handleCreate" />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <el-button size="small" round @click="visible = false">取消</el-button>
        <el-button type="primary" size="small" round class="font-bold" @click="handleCreate">创建</el-button>
      </div>
    </template>
  </el-dialog>
</template>
