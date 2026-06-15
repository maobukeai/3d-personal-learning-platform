<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';
import type { ProjectMember } from '@/types';

const props = defineProps<{
  projectId: string;
  members: ProjectMember[];
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const visible = ref(false);
const taskForm = ref({
  title: '',
  description: '',
  assigneeId: '',
  dueDate: '',
  participantIds: [] as string[],
});

const open = () => {
  taskForm.value = {
    title: '',
    description: '',
    assigneeId: '',
    dueDate: '',
    participantIds: [],
  };
  visible.value = true;
};

const handleCreateTask = async () => {
  if (!taskForm.value.title.trim()) {
    ElMessage.warning('请输入任务名称');
    return;
  }
  try {
    const payload = {
      ...taskForm.value,
      participantIds:
        taskForm.value.participantIds.length > 0 ? taskForm.value.participantIds : undefined,
    };
    await api.post(`/api/projects/${props.projectId}/tasks`, payload);
    visible.value = false;
    emit('saved');
    ElMessage.success('任务已分配');
  } catch (_error) {
    ElMessage.error('分配任务失败');
  }
};

defineExpose({ open });
</script>

<template>
  <Modal :show="visible" title="分配新任务" size="md" @close="visible = false">
    <div class="space-y-6 p-1 text-left">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >任务名称</label
        >
        <Input
          v-model="taskForm.title"
          type="text"
          placeholder="简明扼要..."
          glass
          input-class="!py-3.5 !h-12"
        />
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >执行标准 (描述)</label
        >
        <textarea
          v-model="taskForm.description"
          rows="4"
          class="w-full px-5 py-4 border rounded-2xl text-sm focus:outline-none transition-all resize-none glass-input"
          style="border-color: var(--border-base); color: var(--text-primary)"
          placeholder="交付物包含哪些内容？"
        ></textarea>
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >委派给</label
        >
        <el-select
          v-model="taskForm.assigneeId"
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
          v-model="taskForm.participantIds"
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
          v-model="taskForm.dueDate"
          type="date"
          placeholder="最后期限"
          class="!w-full !rounded-2xl custom-date-picker"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex gap-4">
        <Button variant="secondary" class="flex-1" @click="visible = false"> 取消 </Button>
        <Button variant="primary" class="flex-[2]" @click="handleCreateTask"> 确认下发 </Button>
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
