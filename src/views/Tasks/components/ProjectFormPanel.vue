<script setup lang="ts">
import { ref, computed } from 'vue';
import { X, Maximize2, Minimize2, Trash2 } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import UserAvatar from '@/components/UserAvatar.vue';

interface TeamMember {
  id: string;
  name?: string;
  email: string;
  avatarUrl?: string | null;
}

const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const props = defineProps<{
  teamMembers: TeamMember[];
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const isDrawerOpen = ref(false);
const isEditMode = ref(false);
const projectFormViewMode = ref(localStorage.getItem('project_form_view_mode') || 'drawer');

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

const projectMembers = ref<any[]>([]);

const toggleProjectFormViewMode = () => {
  projectFormViewMode.value = projectFormViewMode.value === 'drawer' ? 'modal' : 'drawer';
  localStorage.setItem('project_form_view_mode', projectFormViewMode.value);
};

const colors = [
  { name: '电光蓝', value: 'bg-blue-500' },
  { name: '极光绿', value: 'bg-emerald-500' },
  { name: '霓虹紫', value: 'bg-purple-500' },
  { name: '日落橙', value: 'bg-orange-500' },
  { name: '蔷薇红', value: 'bg-rose-500' },
  { name: '品牌色', value: 'bg-accent' },
];

const statusOptions = [
  { value: 'PLANNED', label: '规划中' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'PAUSED', label: '已暂停' },
  { value: 'COMPLETED', label: '已完成' },
];

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

const openEdit = (project: any) => {
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
    ElMessage.warning('请输入项目标题');
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
      ElMessage.success('项目已更新');
    } else {
      await api.post('/api/projects', {
        ...projectForm.value,
        teamId: workspaceStore.activeTeamId,
      });
      ElMessage.success('项目已创建');
    }
    isDrawerOpen.value = false;
    emit('saved');
  } catch {
    ElMessage.error(isEditMode.value ? '更新项目失败' : '创建项目失败');
  }
};

const handleRemoveMember = async (userId: string) => {
  try {
    await api.post(`/api/projects/${projectForm.value.id}/members/remove`, { userId });
    ElMessage.success('已移出项目成员');
    projectMembers.value = projectMembers.value.filter((m) => m.userId !== userId);
    emit('saved');
  } catch {
    ElMessage.error('移除成员失败');
  }
};

defineExpose({
  openAdd,
  openEdit,
});
</script>

<template>
  <!-- Project Settings/Create Custom Dialog/Drawer -->
  <Transition :name="projectFormViewMode === 'drawer' ? 'project-form-slide' : 'project-form-fade'">
    <div
      v-if="isDrawerOpen"
      class="fixed inset-0 z-50 flex transition-all duration-300"
      :class="
        projectFormViewMode === 'drawer'
          ? 'justify-end'
          : 'items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm'
      "
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 cursor-pointer"
        :class="projectFormViewMode === 'drawer' ? 'bg-black/40 backdrop-blur-sm' : ''"
        @click="isDrawerOpen = false"
      ></div>

      <!-- Content Container -->
      <div
        class="project-form-content relative shadow-2xl flex flex-col overflow-hidden transition-all duration-300 border-[var(--border-base)]"
        :class="[
          projectFormViewMode === 'drawer'
            ? 'w-full sm:w-[500px] h-full sm:rounded-l-2xl border-l'
            : 'w-full max-w-lg h-[90vh] md:h-[85vh] rounded-2xl border',
        ]"
        :style="{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-base)',
        }"
      >
        <!-- Header -->
        <div
          class="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style="border-color: var(--border-base)"
        >
          <h3
            class="text-lg sm:text-xl font-black tracking-tight"
            style="color: var(--text-primary)"
          >
            {{ isEditMode ? '配置项目' : '启动新项目' }}
          </h3>
          <div class="flex items-center gap-2">
            <!-- View Mode Toggle -->
            <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all text-slate-500 dark:text-slate-400 cursor-pointer bg-transparent border-none" :title="projectFormViewMode === 'drawer' ? '切换为弹窗模式' : '切换为抽屉模式'" @click="toggleProjectFormViewMode">
              <component
                :is="projectFormViewMode === 'drawer' ? Maximize2 : Minimize2"
                class="w-4.5 h-4.5"
              />
            </button>
            <button type="button" class="p-2 bg-slate-100 dark:bg-slate-800 hover:scale-110 rounded-full transition-all cursor-pointer border-none" @click="isDrawerOpen = false">
              <X class="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-5 scrollbar-hide space-y-3.5 text-left">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
              >项目标识 (名称)</label
            >
            <input
              v-model="projectForm.title"
              type="text"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
              style="border-color: var(--border-base); color: var(--text-primary)"
              placeholder="例如：代码 M8 重构"
            />
          </div>
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
              >项目愿景 (描述)</label
            >
            <textarea
              v-model="projectForm.description"
              rows="2"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all resize-none"
              style="border-color: var(--border-base); color: var(--text-primary)"
              placeholder="一句话概括这个项目的终极目标..."
            ></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1 text-left"
                >交付物 (截止日期)</label
              >
              <el-date-picker
                v-model="projectForm.dueDate"
                type="date"
                placeholder="Deadline"
                class="!w-full !rounded-xl custom-date-picker-compact"
              />
            </div>
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1 text-left"
                >视觉色彩</label
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
                >当前状态</label
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
                <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                  >项目完成进度 (基于关联任务自动计算)</label
                >
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
                >可见性与报名</label
              >
              <el-select v-model="projectForm.visibility" class="!w-full custom-select-compact">
                <el-option label="私有 (仅邀请)" value="PRIVATE" />
                <el-option label="公开 (成员可报名)" value="PUBLIC" />
              </el-select>
            </div>
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1 text-left"
                >人员满载限制</label
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
              >分类标签 (逗号分隔)</label
            >
            <input
              v-model="projectForm.tags"
              type="text"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
              style="border-color: var(--border-base); color: var(--text-primary)"
              placeholder="如：3D建模, WebGL, 内部工具"
            />
          </div>

          <!-- Member Management in Edit Mode -->
          <div v-if="isEditMode" class="space-y-3">
            <!-- Current Members list -->
            <div v-if="projectMembers.length > 0">
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
                >当前项目成员 ({{ projectMembers.length }})</label
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
                  <button v-if="m.role !== 'OWNER' && m.userId !== authStore.user?.id" type="button" class="p-1 hover:text-rose-500 text-slate-400 rounded transition-all hover:bg-rose-55 dark:hover:bg-rose-500/10 bg-transparent border-none cursor-pointer" title="移出项目" @click="handleRemoveMember(m.userId)">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Invite Select for Edit Mode -->
            <div v-if="availableTeamMembers.length > 0">
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
                >邀请新项目成员</label
              >
              <el-select
                v-model="projectForm.inviteUserIds"
                multiple
                placeholder="选择要邀请的成员"
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
                >直接加入的成员</label
              >
              <el-select
                v-model="projectForm.memberIds"
                multiple
                placeholder="选择直接加入的成员"
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
                >发送邀请的成员</label
              >
              <el-select
                v-model="projectForm.inviteUserIds"
                multiple
                placeholder="选择要邀请的成员"
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
                被邀请的成员将收到通知，可自行决定是否加入
              </p>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="flex gap-3.5 p-3.5 border-t shrink-0 bg-slate-50/30 dark:bg-slate-900/10" style="border-color: var(--border-base)">
          <button type="button" class="flex-1 py-2 sm:py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-black transition-all text-xs border-none cursor-pointer" style="color: var(--text-primary)" @click="isDrawerOpen = false">
            取消
          </button>
          <button type="button" class="flex-[2] py-2 sm:py-2.5 bg-accent text-white rounded-xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs border-none cursor-pointer" @click="handleSaveProject">
            {{ isEditMode ? '确认并应用更改' : '正式启动项目' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
