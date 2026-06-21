<script setup lang="ts">
import { ref, computed } from 'vue';
import { Trash2 } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import UserAvatar from '@/components/UserAvatar.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import Modal from '@/components/ui/Modal.vue';
import type { Project, ProjectMember } from '@/types/task';

interface TeamMember {
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
}

const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const { t } = useI18n();

const props = defineProps<{
  teamMembers: TeamMember[];
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const isDrawerOpen = ref(false);
const isEditMode = ref(false);

const projectForm = ref({
  id: '',
  title: '',
  description: '',
  dueDate: '',
  color: 'bg-accent',
  tags: '',
  progress: 0,
  status: 'IN_PROGRESS',
  visibility: 'PRIVATE',
  maxMembers: 10,
  memberIds: [] as string[],
  inviteUserIds: [] as string[],
});

const projectMembers = ref<ProjectMember[]>([]);

const colors = computed(() => [
  { name: t('projects.colors.blue'), value: 'bg-blue-500' },
  { name: t('projects.colors.emerald'), value: 'bg-emerald-500' },
  { name: t('projects.colors.purple'), value: 'bg-purple-500' },
  { name: t('projects.colors.orange'), value: 'bg-orange-500' },
  { name: t('projects.colors.rose'), value: 'bg-rose-500' },
  { name: t('projects.colors.accent'), value: 'bg-accent' },
]);

const statusOptions = computed(() => [
  { value: 'PLANNED', label: t('projects.status.planned') },
  { value: 'IN_PROGRESS', label: t('projects.status.inProgress') },
  { value: 'PAUSED', label: t('projects.status.paused') },
  { value: 'COMPLETED', label: t('projects.status.completed') },
]);

const availableTeamMembers = computed(() => {
  const currentMemberIds = new Set(projectMembers.value.map((m) => m.userId));
  return props.teamMembers.filter((m) => !currentMemberIds.has(m.id));
});

const openAdd = () => {
  isEditMode.value = false;
  projectForm.value = {
    id: '',
    title: '',
    description: '',
    dueDate: '',
    color: 'bg-accent',
    tags: '',
    progress: 0,
    status: 'PLANNED',
    visibility: 'PRIVATE',
    maxMembers: 10,
    memberIds: [],
    inviteUserIds: [],
  };
  projectMembers.value = [];
  isDrawerOpen.value = true;
};

const openEdit = (project: Project) => {
  isEditMode.value = true;
  projectForm.value = {
    id: project.id,
    title: project.title,
    description: project.description || '',
    dueDate: project.dueDate || '',
    color: project.color || 'bg-accent',
    tags: project.tags || '',
    progress: project.progress || 0,
    status: project.status || 'IN_PROGRESS',
    visibility: project.visibility || 'PRIVATE',
    maxMembers: project.maxMembers || 10,
    memberIds: [],
    inviteUserIds: [],
  };
  projectMembers.value = project.members || [];
  isDrawerOpen.value = true;
};

const handleSaveProject = async () => {
  if (!projectForm.value.title.trim()) {
    ElMessage.warning(t('projects.validation.titleRequired'));
    return;
  }
  try {
    if (isEditMode.value) {
      await api.put(`/api/projects/${projectForm.value.id}`, projectForm.value);
      if (projectForm.value.inviteUserIds && projectForm.value.inviteUserIds.length > 0) {
        await api.post(`/api/projects/${projectForm.value.id}/invite`, {
          userIds: projectForm.value.inviteUserIds,
        });
      }
      ElMessage.success(t('projects.updateSuccess'));
    } else {
      await api.post('/api/projects', {
        ...projectForm.value,
        teamId: workspaceStore.activeTeamId,
      });
      ElMessage.success(t('projects.createSuccess'));
    }
    isDrawerOpen.value = false;
    emit('saved');
  } catch {
    ElMessage.error(isEditMode.value ? t('projects.updateFailed') : t('projects.createFailed'));
  }
};

const handleRemoveMember = async (userId: string) => {
  try {
    await api.post(`/api/projects/${projectForm.value.id}/members/remove`, { userId });
    ElMessage.success(t('projects.memberRemoved'));
    projectMembers.value = projectMembers.value.filter((m) => m.userId !== userId);
    emit('saved');
  } catch {
    ElMessage.error(t('projects.removeMemberFailed'));
  }
};

defineExpose({
  openAdd,
  openEdit,
});
</script>

<template>
  <!-- Project Settings/Create Custom Dialog/Drawer -->
  <Modal
    :show="isDrawerOpen"
    :title="isEditMode ? t('projects.configProject') : t('projects.startNewProject')"
    size="md"
    glass-card
    @close="isDrawerOpen = false"
  >
    <div class="space-y-3.5 text-left max-h-[65vh] overflow-y-auto pr-1">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
          >{{ t('projects.projectIdentifier') }}</label
        >
        <Input
          v-model="projectForm.title"
          type="text"
          input-class="!py-2 !h-9 text-xs"
          glass
          :placeholder="t('projects.titlePlaceholder')"
        />
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
          >{{ t('projects.projectVisionDesc') }}</label
        >
        <textarea
          v-model="projectForm.description"
          rows="2"
          class="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none transition-all resize-none glass-input"
          style="border-color: var(--border-base); color: var(--text-primary)"
          :placeholder="t('projects.visionPlaceholder')"
        ></textarea>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1 text-left"
            >{{ t('projects.deliverableDueDate') }}</label
          >
          <el-date-picker
            v-model="projectForm.dueDate"
            type="date"
            :placeholder="t('tasks.dueDate')"
            class="!w-full !rounded-xl custom-date-picker-compact"
          />
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1 text-left"
            >{{ t('projects.visualColor') }}</label
          >
          <el-select
            v-model="projectForm.color"
            class="!w-full custom-select-compact"
            popper-class="custom-select-dropdown"
          >
            <el-option v-for="c in colors" :key="c.value" :label="c.name" :value="c.value">
              <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full shadow-inner" :class="c.value"></div>
                <span class="font-bold text-xs sm:text-sm">{{ c.name }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
      </div>
      <div
        v-if="isEditMode"
        class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border space-y-3"
        style="border-color: var(--border-base)"
      >
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
            >{{ t('projects.currentStatus') }}</label
          >
          <el-select v-model="projectForm.status" class="!w-full custom-select-compact">
            <el-option
              v-for="s in statusOptions"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              t('projects.autoProgressTip')
            }}</label>
            <span class="text-xs font-black text-accent">{{ projectForm.progress }}%</span>
          </div>
          <div class="px-1.5 py-0.5">
            <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="projectForm.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
                :style="{ width: (projectForm.progress || 0) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1 text-left"
            >{{ t('projects.visibilityAndEnrollment') }}</label
          >
          <el-select v-model="projectForm.visibility" class="!w-full custom-select-compact">
            <el-option :label="t('projects.visibility.private')" value="PRIVATE" />
            <el-option :label="t('projects.visibility.public')" value="PUBLIC" />
          </el-select>
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1 text-left"
            >{{ t('projects.maxMembersLimit') }}</label
          >
          <el-input-number
            v-model="projectForm.maxMembers"
            :min="1"
            :max="50"
            class="!w-full custom-number-compact"
          />
        </div>
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
          >{{ t('projects.categoryTags') }}</label
        >
        <Input
          v-model="projectForm.tags"
          type="text"
          input-class="!py-2 !h-9 text-xs"
          glass
          :placeholder="t('projects.tagsPlaceholder')"
        />
      </div>

      <!-- Member Management in Edit Mode -->
      <div v-if="isEditMode" class="space-y-3">
        <!-- Current Members list -->
        <div v-if="projectMembers.length > 0">
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >{{ t('projects.currentMembersCount', { count: projectMembers.length }) }}</label
          >
          <div
            class="border rounded-xl p-2.5 space-y-1.5 bg-slate-50 dark:bg-slate-800/10 max-h-32 overflow-y-auto"
            style="border-color: var(--border-base)"
          >
            <div
              v-for="m in projectMembers"
              :key="m.userId"
              class="flex items-center justify-between py-1 border-b last:border-0"
              style="border-color: var(--border-base)"
            >
              <div class="flex items-center gap-2">
                <UserAvatar :user="m.user" size="xs" />
                <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                  m.user.name || m.user.email
                }}</span>
                <span
                  class="text-[8px] px-1 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-400 rounded uppercase font-black tracking-wider"
                  >{{ m.role }}</span
                >
              </div>
              <!-- Prevent removing oneself or project owner if we can identify role -->
              <button
                v-if="m.role !== 'OWNER' && m.userId !== authStore.user?.id"
                type="button"
                class="p-1 hover:text-rose-500 text-slate-400 rounded transition-all hover:bg-rose-50 dark:hover:bg-rose-500/10 bg-transparent border-none cursor-pointer"
                :title="t('projects.removeMember')"
                @click="handleRemoveMember(m.userId)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Invite Select for Edit Mode -->
        <div v-if="availableTeamMembers.length > 0">
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >{{ t('projects.inviteNewMembers') }}</label
          >
          <el-select
            v-model="projectForm.inviteUserIds"
            multiple
            :placeholder="t('projects.selectMembersToInvite')"
            class="!w-full custom-select-compact"
          >
            <el-option
              v-for="m in availableTeamMembers"
              :key="m.id"
              :label="m.name || m.email"
              :value="m.id"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m" size="sm" />
                <span class="font-bold text-xs sm:text-sm">{{ m.name || m.email }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
      </div>

      <!-- Member Management in Create Mode -->
      <template v-else-if="props.teamMembers.length > 0">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >{{ t('projects.directMembers') }}</label
          >
          <el-select
            v-model="projectForm.memberIds"
            multiple
            :placeholder="t('projects.selectDirectMembers')"
            class="!w-full custom-select-compact"
          >
            <el-option
              v-for="m in props.teamMembers"
              :key="m.id"
              :label="m.name || m.email"
              :value="m.id"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m" size="sm" />
                <span class="font-bold text-xs sm:text-sm">{{ m.name || m.email }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >{{ t('projects.invitedMembers') }}</label
          >
          <el-select
            v-model="projectForm.inviteUserIds"
            multiple
            :placeholder="t('projects.selectMembersToInvite')"
            class="!w-full custom-select-compact"
          >
            <el-option
              v-for="m in props.teamMembers"
              :key="m.id"
              :label="m.name || m.email"
              :value="m.id"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m" size="sm" />
                <span class="font-bold text-xs sm:text-sm">{{ m.name || m.email }}</span>
              </div>
            </el-option>
          </el-select>
          <p class="text-[9px] sm:text-[10px] text-slate-400 mt-1.5 ml-1">
            {{ t('projects.inviteTip') }}
          </p>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="flex gap-3.5 w-full">
        <Button variant="secondary" class="flex-1 text-xs" @click="isDrawerOpen = false">
          {{ t('common.cancel') }}
        </Button>
        <Button variant="primary" class="flex-[2] text-xs" @click="handleSaveProject">
          {{ isEditMode ? t('projects.confirmApplyChanges') : t('projects.startProject') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.custom-select-compact :deep(.el-select__wrapper) {
  border-radius: 0.75rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  transition: all 0.2s ease !important;
}
.dark .custom-select-compact :deep(.el-select__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-select-compact :deep(.el-select__wrapper.is-focused) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.15) !important;
}

.custom-date-picker-compact :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  transition: all 0.2s ease !important;
  height: 38px !important;
}
.dark .custom-date-picker-compact :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-date-picker-compact :deep(.el-input__wrapper.is-focus) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.15) !important;
}

.custom-number-compact :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  transition: all 0.2s ease !important;
}
.dark .custom-number-compact :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-number-compact :deep(.el-input__wrapper.is-focus) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.15) !important;
}
</style>
