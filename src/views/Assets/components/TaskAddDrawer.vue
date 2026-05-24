<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { X } from 'lucide-vue-next';
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
  <el-drawer
    v-model="visible"
    title="分配新任务"
    size="400px"
    :show-close="false"
    class="custom-drawer"
    destroy-on-close
  >
    <template #header="{ close }">
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-black tracking-tight" style="color: var(--text-primary)">
          下达任务
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
          v-model="taskForm.title"
          type="text"
          class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
          style="border-color: var(--border-base); color: var(--text-primary)"
          placeholder="简明扼要..."
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
          class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all resize-none"
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
          v-model="taskForm.dueDate"
          type="date"
          placeholder="最后期限"
          class="!w-full !rounded-2xl custom-date-picker"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex gap-4 p-4 border-t" style="border-color: var(--border-base)">
        <button type="button" class="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl font-black transition-all cursor-pointer" style="color: var(--text-primary)" @click="visible = false">
          取消
        </button>
        <button type="button" class="flex-[2] py-4 bg-accent text-white rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer" @click="handleCreateTask">
          确认下发
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
</style>
