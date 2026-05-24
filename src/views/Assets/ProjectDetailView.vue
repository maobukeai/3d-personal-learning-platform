<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Plus,
  AlignLeft,
  KanbanSquare,
  MessageSquare,
  Search,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { getApiErrorMessage } from '@/utils/error';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';

// Subcomponents
import ProjectSidebar from './components/ProjectSidebar.vue';
import InviteMembersDialog from './components/InviteMembersDialog.vue';
import TaskAddDrawer from './components/TaskAddDrawer.vue';
import TaskEditDrawer from './components/TaskEditDrawer.vue';
import KanbanBoard from './components/KanbanBoard.vue';
import CollaborationSpace from './components/CollaborationSpace.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const projectId = computed(() => route.params.id as string);

const project = ref<any>(null);
const isLoading = ref(true);
const activeTab = ref('tasks'); // 'tasks', 'discussions', 'settings'

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

// Dialogue/Drawer References
const inviteDialogRef = ref<InstanceType<typeof InviteMembersDialog> | null>(null);
const taskAddDrawerRef = ref<InstanceType<typeof TaskAddDrawer> | null>(null);
const taskEditDrawerRef = ref<InstanceType<typeof TaskEditDrawer> | null>(null);

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleStartChat = async (user: any) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    router.push('/messages');
  } catch (_error) {
    ElMessage.error('创建对话失败');
  }
};

const taskSearchQuery = ref('');
const taskDateFilter = ref('all'); // 'all', 'overdue', 'today', 'week'
const taskAssigneeFilter = ref('all'); // 'all', 'me'

const fetchProject = async () => {
  isLoading.value = true;
  try {
    const response = await api.get(`/api/projects/${projectId.value}`);
    project.value = response.data;
  } catch (_error) {
    ElMessage.error('获取项目详情失败');
    router.push('/team-tasks');
  } finally {
    isLoading.value = false;
  }
};

const isMember = computed(() => {
  if (!project.value || !authStore.user) return false;
  return project.value.members.some((m: any) => m.userId === authStore.user?.id);
});

const existingMemberIds = computed(() => {
  if (!project.value?.members) return [];
  return project.value.members.map((m: any) => m.userId);
});

const handleJoin = async () => {
  try {
    await api.post(`/api/projects/${projectId.value}/join`);
    ElMessage.success('成功加入项目');
    fetchProject();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '加入失败'));
  }
};

const openEditTaskDialog = (task: any) => {
  taskEditDrawerRef.value?.open(task);
};

const isMobile = ref(window.innerWidth < 1024);
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 1024;
};

watch(
  () => route.params.id,
  (newId) => {
    if (newId) fetchProject();
  },
);

onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  fetchProject();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});
</script>

<template>
  <div class="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50 dark:bg-slate-955 font-sans relative">
    <!-- Global Loading -->
    <div
      v-if="isLoading"
      class="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center"
    >
      <div
        class="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin"
      ></div>
    </div>

    <template v-else-if="project">
      <!-- Left Sidebar (Project Meta) -->
      <ProjectSidebar
        :project="project"
        :is-member="isMember"
        :is-mobile="isMobile && activeTab !== 'settings'"
        @join="handleJoin"
        @invite="inviteDialogRef?.open()"
        @open-profile="openUserProfile"
      />

      <!-- Main Content Area -->
      <main
        v-if="!isMobile || activeTab !== 'settings'"
        class="flex-1 flex flex-col min-w-0 bg-transparent"
      >
        <!-- Top Navigation -->
        <header
          class="h-auto md:h-20 px-3 md:px-10 py-2.5 md:py-0 flex flex-col md:flex-row md:items-center justify-between border-b bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shrink-0 gap-2 md:gap-0"
          style="border-color: var(--border-base)"
        >
          <!-- Segmented Control + Mobile New Button -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto scrollbar-hide">
              <button
v-for="tab in [
                  { id: 'tasks', label: '敏捷看板', icon: KanbanSquare },
                  { id: 'discussions', label: '协作空间', icon: MessageSquare },
                  ...(isMobile ? [{ id: 'settings', label: '项目详情', icon: AlignLeft }] : []),
                ]" :key="tab.id" type="button" class="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-6 py-1.5 md:py-2.5 rounded-lg text-[11px] md:text-sm font-black transition-all whitespace-nowrap shrink-0 cursor-pointer" :class="
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                " @click="activeTab = tab.id">
                <component :is="tab.icon" class="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>{{ tab.label }}</span>
              </button>
            </div>

            <!-- Mobile New Task Button -->
            <button v-if="isMember && activeTab === 'tasks'" type="button" class="flex md:hidden items-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-[11px] shadow-lg shrink-0 cursor-pointer" @click="taskAddDrawerRef?.open()">
              <Plus class="w-3.5 h-3.5" /> 新建
            </button>
          </div>

          <div class="flex items-center gap-2 md:gap-4">
            <div v-if="activeTab === 'tasks'" class="relative flex-1 md:flex-none">
              <Search class="w-3.5 h-3.5 md:w-4 md:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="taskSearchQuery"
                type="text"
                placeholder="搜索任务..."
                class="pl-9 pr-3 py-2 md:py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-accent/20 w-full md:w-48 transition-all"
                style="color: var(--text-primary)"
              />
            </div>
            <button v-if="isMember && activeTab === 'tasks'" type="button" class="hidden md:flex px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-all items-center gap-2 cursor-pointer" @click="taskAddDrawerRef?.open()">
              <Plus class="w-4 h-4" /> 分配新任务
            </button>
          </div>
        </header>

        <!-- Project Kanban Filter Bar -->
        <div
          v-if="activeTab === 'tasks'"
          class="px-3 md:px-10 py-2.5 md:py-3 border-b flex items-center gap-3 md:gap-6 overflow-x-auto scrollbar-hide shrink-0"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-1.5 md:gap-2 shrink-0">
            <span
              class="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
              >截止:</span
            >
            <div class="flex p-0.5 md:p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
v-for="f in [
                  { id: 'all', label: '全部' },
                  { id: 'overdue', label: '已逾期' },
                  { id: 'today', label: '今日' },
                  { id: 'week', label: '本周' },
                ]" :key="f.id" type="button" class="px-2 md:px-3 py-1 rounded-md text-[9px] md:text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer" :class="
                  taskDateFilter === f.id
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500'
                " @click="taskDateFilter = f.id">
                {{ f.label }}
              </button>
            </div>
          </div>

          <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

          <div class="flex items-center gap-1.5 md:gap-2 shrink-0">
            <span
              class="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
              >执行人:</span
            >
            <div class="flex p-0.5 md:p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
type="button" class="px-2 md:px-3 py-1 rounded-md text-[9px] md:text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer" :class="
                  taskAssigneeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500'
                " @click="taskAssigneeFilter = 'all'">
                全部
              </button>
              <button
type="button" class="px-2 md:px-3 py-1 rounded-md text-[9px] md:text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer" :class="
                  taskAssigneeFilter === 'me'
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500'
                " @click="taskAssigneeFilter = 'me'">
                我的
              </button>
            </div>
          </div>
        </div>

        <!-- Dynamic Content -->
        <div class="flex-1 overflow-hidden relative">
          <!-- Kanban View -->
          <KanbanBoard
            v-show="activeTab === 'tasks'"
            :project="project"
            :is-member="isMember"
            :search-query="taskSearchQuery"
            :date-filter="taskDateFilter"
            :assignee-filter="taskAssigneeFilter"
            @edit-task="openEditTaskDialog"
            @open-profile="openUserProfile"
            @refresh="fetchProject"
          />

          <!-- Discussions View -->
          <CollaborationSpace
            v-show="activeTab === 'discussions'"
            :project="project"
            :project-id="projectId"
            :is-member="isMember"
            @open-profile="openUserProfile"
            @join="handleJoin"
            @refresh="fetchProject"
          />
        </div>
      </main>
    </template>

    <!-- Drawer/Dialog Components -->
    <InviteMembersDialog
      ref="inviteDialogRef"
      :project-id="projectId"
      :team-id="project?.teamId || ''"
      :existing-member-ids="existingMemberIds"
      @invited="fetchProject"
    />

    <TaskAddDrawer
      ref="taskAddDrawerRef"
      :project-id="projectId"
      :members="project?.members || []"
      @saved="fetchProject"
    />

    <TaskEditDrawer
      ref="taskEditDrawerRef"
      :members="project?.members || []"
      @saved="fetchProject"
    />

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleStartChat"
    />
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
