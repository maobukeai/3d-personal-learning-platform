<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';
import type { ProjectMember, Task } from '@/types';

interface EditableTask extends Omit<Task, 'participants'> {
  participants?: Array<{ userId: string }>;
}

const props = defineProps<{
  members: ProjectMember[];
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const visible = ref(false);
const editingTask = ref<EditableTask | null>(null);
const editTaskForm = ref({
  title: '',
  description: '',
  assigneeId: '',
  dueDate: '',
  status: '',
  participantIds: [] as string[],
});

const open = (task: EditableTask) => {
  editingTask.value = task;
  editTaskForm.value = {
    title: task.title || '',
    description: task.description || '',
    assigneeId: task.assigneeId || '',
    dueDate: task.dueDate || '',
    status: task.status || 'TODO',
    participantIds: task.participants?.map((participant) => participant.userId) || [],
  };
  visible.value = true;
};

const handleUpdateTask = async () => {
  if (!editTaskForm.value.title.trim()) {
    ElMessage.warning('请输入任务名称');
    return;
  }
  try {
    if (!editingTask.value) return;
    await api.put(`/api/projects/tasks/${editingTask.value.id}`, editTaskForm.value);
    visible.value = false;
    emit('saved');
    ElMessage.success('任务已更新');
  } catch {
    ElMessage.error('更新失败');
  }
};

const handleDeleteTask = async () => {
  if (!editingTask.value) return;
  try {
    await ElMessageBox.confirm('确定要删除这个任务吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/tasks/${editingTask.value.id}`);
    visible.value = false;
    emit('saved');
    ElMessage.success('任务已删除');
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('删除失败');
  }
};

defineExpose({ open });
</script>

<template>
  <Modal :show="visible" title="编辑任务" size="md" @close="visible = false">
    <div class="space-y-6 p-1 text-left mobile-adaptive">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >任务名称</label
        >
        <Input v-model="editTaskForm.title" type="text" glass input-class="!py-3.5 !h-12" />
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >任务描述</label
        >
        <textarea
          v-model="editTaskForm.description"
          rows="4"
          class="w-full px-5 py-4 border rounded-2xl text-sm focus:outline-none transition-all resize-none glass-input"
          style="border-color: var(--border-base); color: var(--text-primary)"
        ></textarea>
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >当前状态</label
        >
        <el-select v-model="editTaskForm.status" class="!w-full custom-select">
          <el-option label="待处理" value="TODO" />
          <el-option label="进行中" value="IN_PROGRESS" />
          <el-option label="已完成" value="DONE" />
        </el-select>
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >委派给</label
        >
        <el-select
          v-model="editTaskForm.assigneeId"
          class="!w-full custom-select"
          placeholder="选择执行者"
          clearable
        >
          <el-option
            v-for="m in props.members"
            :key="m.userId"
            :label="m.user?.name || m.user?.email"
            :value="m.userId"
          >
            <div class="flex items-center gap-3">
              <UserAvatar :user="m.user" size="xs" />
              <span class="font-bold text-xs sm:text-sm">{{ m.user?.name || m.user?.email }}</span>
            </div>
          </el-option>
        </el-select>
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >参与人员</label
        >
        <el-select
          v-model="editTaskForm.participantIds"
          multiple
          placeholder="选择参与人员"
          class="!w-full custom-select"
        >
          <el-option
            v-for="m in props.members"
            :key="m.userId"
            :label="m.user?.name || m.user?.email"
            :value="m.userId"
          >
            <div class="flex items-center gap-3">
              <UserAvatar :user="m.user" size="xs" />
              <span class="font-bold text-xs sm:text-sm">{{ m.user?.name || m.user?.email }}</span>
            </div>
          </el-option>
        </el-select>
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >Deadline</label
        >
        <el-date-picker
          v-model="editTaskForm.dueDate"
          type="date"
          placeholder="最后期限"
          class="!w-full !rounded-2xl custom-date-picker"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex gap-4">
        <Button
          variant="secondary"
          class="flex-1 text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-transparent"
          @click="handleDeleteTask"
        >
          删除任务
        </Button>
        <Button variant="primary" class="flex-[2]" @click="handleUpdateTask"> 更新资料 </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.custom-select :deep(.el-select__wrapper) {
  border-radius: 1rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  height: 52px;
  transition: all 0.2s ease !important;
}
.dark .custom-select :deep(.el-select__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-select :deep(.el-select__wrapper.is-focused) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.15) !important;
}

.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  height: 52px;
  transition: all 0.2s ease !important;
}
.dark .custom-date-picker :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-date-picker :deep(.el-input__wrapper.is-focus) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.15) !important;
}

@media (max-width: 768px) {
  .custom-date-picker :deep(.el-input__wrapper),
  .custom-select :deep(.el-select__wrapper) {
    height: 38px !important;
    border-radius: 0.75rem !important;
  }
}
</style>
