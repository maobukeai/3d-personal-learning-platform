<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { X } from 'lucide-vue-next';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';
import type { ProjectMember, Task } from '@/types';

interface EditableTask extends Task {
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
  } catch (_error) {
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
  <el-drawer
    v-model="visible"
    title="修改任务详情"
    size="400px"
    :show-close="false"
    class="custom-drawer"
    destroy-on-close
  >
    <template #header="{ close }">
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-black tracking-tight" style="color: var(--text-primary)">
          编辑任务
        </h3>
        <button type="button" class="p-2 bg-slate-100 dark:bg-slate-800 hover:scale-110 rounded-full transition-all cursor-pointer" @click="close">
          <X class="w-4 h-4 text-slate-500" />
        </button>
      </div>
    </template>

    <div class="space-y-6 p-2">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >任务名称</label
        >
        <input
          v-model="editTaskForm.title"
          type="text"
          class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
          style="border-color: var(--border-base); color: var(--text-primary)"
        />
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >任务描述</label
        >
        <textarea
          v-model="editTaskForm.description"
          rows="4"
          class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all resize-none"
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
              <span class="font-bold">{{ m.user?.name || m.user?.email }}</span>
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
              <span class="font-bold">{{ m.user?.name || m.user?.email }}</span>
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
      <div class="flex gap-4 p-4 border-t" style="border-color: var(--border-base)">
        <button type="button" class="flex-1 py-4 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl font-black hover:bg-rose-100 transition-all cursor-pointer border border-transparent" @click="handleDeleteTask">
          删除任务
        </button>
        <button type="button" class="flex-[2] py-4 bg-accent text-white rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer" @click="handleUpdateTask">
          更新资料
        </button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
:deep(.custom-drawer) {
  background-color: var(--bg-card) !important;
  border-top-left-radius: 2rem !important;
  border-bottom-left-radius: 2rem !important;
  box-shadow: -20px 0 50px rgba(0, 0, 0, 0.1) !important;
}
:deep(.el-drawer__header) {
  margin-bottom: 0 !important;
  padding: 2rem !important;
  border-bottom: 1px solid var(--border-base);
}
:deep(.el-drawer__body) {
  padding: 2rem !important;
}
:deep(.el-drawer__footer) {
  padding: 0 !important;
}
.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  padding: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
}
.custom-select :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 52px;
}

@media (max-width: 768px) {
  :deep(.custom-drawer) {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
  }

  :deep(.el-drawer__header) {
    padding: 0.875rem !important;
  }

  :deep(.el-drawer__body) {
    padding: 0.875rem !important;
  }

  :deep(.el-drawer__footer > div) {
    gap: 0.5rem !important;
    padding: 0.625rem !important;
  }

  :deep(.el-drawer__footer button) {
    min-height: 2.25rem !important;
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
    border-radius: 0.75rem !important;
    font-size: 0.75rem !important;
  }

  .custom-date-picker :deep(.el-input__wrapper),
  .custom-select :deep(.el-input__wrapper) {
    height: 38px !important;
    padding: 0.45rem 0.7rem !important;
    border-radius: 0.75rem !important;
  }
}
</style>
