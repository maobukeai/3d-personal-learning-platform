<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { formatDate } from '@/utils/format';
import { ClipboardCheck, Briefcase, BarChart3, ArrowRight } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { getApiErrorMessage } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import api from '@/utils/api';
import type {
  DetailedMember,
  InsightMemberCapacity,
  MemberInsightDetail,
  RecommendationSeverity,
  TeamUser,
} from './teamDetailTypes';

const props = defineProps<{
  show: boolean;
  teamId: string;
  userId: string | null;
  members: DetailedMember[];
  capacityByUserId: Map<string, InsightMemberCapacity>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'navigate', targetRoute: string): void;
  (e: 'view-profile', userId: string): void;
  (e: 'chat', user: TeamUser): void;
}>();

const isLoading = ref(false);
const memberInsight = ref<MemberInsightDetail | null>(null);

const selectedMember = computed(() => {
  const uid = props.userId;
  if (!uid) return null;
  return props.members.find((m) => m.userId === uid) || null;
});

const selectedMemberCapacity = computed(() => {
  const uid = props.userId;
  if (!uid) return null;
  return props.capacityByUserId.get(uid) || null;
});

const drawerTasks = computed(() => {
  if (!memberInsight.value) return [];
  if (memberInsight.value.tasks.overdue.length > 0) return memberInsight.value.tasks.overdue;
  if (memberInsight.value.tasks.active.length > 0) return memberInsight.value.tasks.active;
  return memberInsight.value.tasks.recent;
});

const drawerTaskTitle = computed(() => {
  if (!memberInsight.value) return '任务流';
  if (memberInsight.value.tasks.overdue.length > 0) return '逾期任务';
  if (memberInsight.value.tasks.active.length > 0) return '进行中任务';
  return '最近完成任务';
});

const fetchMemberInsight = async (userId: string) => {
  isLoading.value = true;
  memberInsight.value = null;
  try {
    const response = await api.get(`/api/teams/${props.teamId}/members/${userId}/insight`);
    if (props.userId === userId) {
      memberInsight.value = response.data;
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '获取画像失败'));
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => [props.show, props.userId],
  ([show, userId]) => {
    if (show && userId) {
      void fetchMemberInsight(userId as string);
    }
  },
  { immediate: true },
);

watch(
  () => props.show,
  (show) => {
    if (!show) {
      memberInsight.value = null;
      isLoading.value = false;
    }
  },
);

const roleLabel = (role?: string) => {
  if (role === 'OWNER') return '所有者';
  if (role === 'ADMIN') return '管理员';
  return '成员';
};

const navigate = (targetRoute?: string) => {
  if (targetRoute) {
    emit('navigate', targetRoute);
  }
};

const severityClass = (severity: 'critical' | 'high' | 'medium' | RecommendationSeverity) => {
  if (severity === 'critical') return 'bg-rose-500/10 text-rose-500';
  if (severity === 'high') return 'bg-orange-500/10 text-orange-500';
  return 'bg-amber-500/10 text-amber-500';
};

const severityLabel = (severity: 'critical' | 'high' | 'medium' | RecommendationSeverity) => {
  if (severity === 'critical') return '紧急';
  if (severity === 'high') return '高';
  return '中';
};

const capacityClass = (score?: number) => {
  if (score === undefined || score < 60) return 'bg-emerald-500/10 text-emerald-500';
  if (score < 80) return 'bg-sky-500/10 text-sky-500';
  if (score < 90) return 'bg-amber-500/10 text-amber-500';
  return 'bg-rose-500/10 text-rose-500';
};

const priorityClass = (p?: string) => {
  if (p === 'HIGH') return 'bg-rose-500/10 text-rose-500';
  if (p === 'MEDIUM') return 'bg-amber-500/10 text-amber-500';
  return 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400';
};

const taskStatusLabel = (status?: string) => {
  if (status === 'TODO') return '待办';
  if (status === 'IN_PROGRESS') return '进行中';
  if (status === 'DONE') return '已完成';
  return '未指派';
};

const progressWidth = (percent: number) => {
  return `${Math.min(100, Math.max(0, percent))}%`;
};
</script>

<template>
  <Modal :show="show" size="md" glass-card @close="$emit('close')">
    <template #header>
      <div class="flex items-center gap-3 min-w-0">
        <UserAvatar v-if="selectedMember" :user="selectedMember.user" size="md" />
        <div class="min-w-0 text-left">
          <p class="text-sm font-black truncate text-[var(--text-primary)]">
            {{ selectedMember?.user.name || memberInsight?.member.user.name || '未命名成员' }}
          </p>
          <p class="text-[10px] font-bold text-slate-400 truncate">
            {{ selectedMember?.user.email || memberInsight?.member.user.email || '成员画像' }}
          </p>
        </div>
      </div>
    </template>

    <div v-if="isLoading" class="py-12 flex flex-col items-center justify-center text-slate-400">
      <div
        class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-3"
      ></div>
      <p class="text-xs font-black">正在生成成员画像</p>
    </div>

    <div v-else-if="memberInsight" class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <section
        class="p-3 rounded-xl border animate-in fade-in duration-300"
        style="border-color: var(--border-base); background: rgb(148 163 184 / 0.04)"
      >
        <div class="flex justify-between items-center">
          <div class="text-left">
            <p class="text-[10px] font-black text-slate-400 leading-none">容量分</p>
            <strong class="text-3xl font-black mt-1 block leading-none text-[var(--text-primary)]">
              {{ memberInsight.stats.capacityScore }}
            </strong>
          </div>
          <span
            class="px-2.5 py-1 rounded-md text-[10px] font-black"
            :class="capacityClass(memberInsight.stats.capacityScore)"
          >
            {{ selectedMemberCapacity?.focus || '工作节奏' }}
          </span>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-center">
          <div
            class="p-2 bg-white/5 dark:bg-black/20 border rounded-lg"
            style="border-color: var(--border-base)"
          >
            <span class="block text-[9px] font-black text-slate-400 uppercase tracking-widest"
              >项目</span
            >
            <strong
              class="block text-base font-black mt-1 leading-none text-[var(--text-primary)]"
              >{{ memberInsight.stats.projects }}</strong
            >
          </div>
          <div
            class="p-2 bg-white/5 dark:bg-black/20 border rounded-lg"
            style="border-color: var(--border-base)"
          >
            <span class="block text-[9px] font-black text-slate-400 uppercase tracking-widest"
              >进行</span
            >
            <strong
              class="block text-base font-black mt-1 leading-none text-[var(--text-primary)]"
              >{{ memberInsight.stats.activeTasks }}</strong
            >
          </div>
          <div
            class="p-2 bg-white/5 dark:bg-black/20 border rounded-lg"
            style="border-color: var(--border-base)"
          >
            <span class="block text-[9px] font-black text-slate-400 uppercase tracking-widest"
              >逾期</span
            >
            <strong
              class="block text-base font-black mt-1 leading-none text-[var(--text-primary)]"
              >{{ memberInsight.stats.overdueTasks }}</strong
            >
          </div>
          <div
            class="p-2 bg-white/5 dark:bg-black/20 border rounded-lg"
            style="border-color: var(--border-base)"
          >
            <span class="block text-[9px] font-black text-slate-400 uppercase tracking-widest"
              >完成率</span
            >
            <strong class="block text-base font-black mt-1 leading-none text-[var(--text-primary)]"
              >{{ memberInsight.stats.completionRate }}%</strong
            >
          </div>
        </div>
      </section>

      <section
        class="p-3 rounded-xl border text-left"
        style="border-color: var(--border-base); background: rgb(148 163 184 / 0.04)"
      >
        <div
          class="flex items-center gap-1.5 mb-2 font-black text-xs text-slate-700 dark:text-slate-200"
        >
          <ClipboardCheck class="w-4 h-4 text-amber-500" />
          <span>建议动作</span>
        </div>
        <div
          v-if="memberInsight.recommendations.length === 0"
          class="text-center py-4 text-slate-400 text-xs italic"
        >
          无特别建议动作
        </div>
        <div v-else class="space-y-2">
          <button
            v-for="item in memberInsight.recommendations"
            :key="item.id"
            type="button"
            class="hover:bg-accent/5 p-2 bg-white/5 rounded-lg border flex items-center gap-2 w-full text-left cursor-pointer"
            style="border-color: var(--border-base)"
            @click="navigate(item.targetRoute)"
          >
            <span
              class="px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0"
              :class="severityClass(item.severity)"
            >
              {{ severityLabel(item.severity) }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[11px] font-black truncate text-[var(--text-primary)]">{{
                item.title
              }}</span>
              <span class="block text-[9px] font-bold text-slate-400 truncate mt-0.5">{{
                item.description
              }}</span>
            </span>
            <ArrowRight class="w-3.5 h-3.5 text-slate-300 shrink-0" />
          </button>
        </div>
      </section>

      <section
        class="p-3 rounded-xl border text-left"
        style="border-color: var(--border-base); background: rgb(148 163 184 / 0.04)"
      >
        <div
          class="flex items-center gap-1.5 mb-2 font-black text-xs text-slate-700 dark:text-slate-200"
        >
          <Briefcase class="w-4 h-4 text-accent" />
          <span>{{ drawerTaskTitle }}</span>
        </div>
        <div v-if="drawerTasks.length === 0" class="text-center py-4 text-slate-400 text-xs italic">
          暂无任务记录
        </div>
        <div v-else class="space-y-2">
          <button
            v-for="task in drawerTasks"
            :key="task.id"
            type="button"
            class="hover:bg-accent/5 p-2 bg-white/5 rounded-lg border flex items-center justify-between w-full text-left cursor-pointer"
            style="border-color: var(--border-base)"
            @click="navigate(task.targetRoute)"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-[11px] font-black truncate text-[var(--text-primary)]">{{
                task.title
              }}</span>
              <span class="block text-[9px] font-bold text-slate-400 truncate mt-0.5">
                {{ task.project?.title || '独立任务' }} · {{ taskStatusLabel(task.status) }} ·
                {{ formatDate(task.dueDate || task.updatedAt) }}
              </span>
            </span>
            <span
              class="px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 ml-2"
              :class="priorityClass(task.priority)"
            >
              {{ task.priority || 'NONE' }}
            </span>
          </button>
        </div>
      </section>

      <section
        class="p-3 rounded-xl border text-left"
        style="border-color: var(--border-base); background: rgb(148 163 184 / 0.04)"
      >
        <div
          class="flex items-center gap-1.5 mb-2 font-black text-xs text-slate-700 dark:text-slate-200"
        >
          <BarChart3 class="w-4 h-4 text-emerald-500" />
          <span>参与项目</span>
        </div>
        <div
          v-if="memberInsight.projects.length === 0"
          class="text-center py-4 text-slate-400 text-xs italic"
        >
          暂未参与项目
        </div>
        <div v-else class="space-y-2">
          <button
            v-for="project in memberInsight.projects.slice(0, 6)"
            :key="project.id"
            type="button"
            class="hover:bg-accent/5 p-2 bg-white/5 rounded-lg border flex items-center justify-between w-full text-left cursor-pointer"
            style="border-color: var(--border-base)"
            @click="navigate(project.targetRoute)"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-[11px] font-black truncate text-[var(--text-primary)]">{{
                project.title
              }}</span>
              <span class="block text-[9px] font-bold text-slate-400 truncate mt-0.5">
                {{ roleLabel(project.role) }} · {{ project.activeTasks }} 进行 ·
                {{ project.overdueTasks }} 逾期
              </span>
            </span>
            <span class="w-14 shrink-0 ml-2">
              <span class="block text-right text-[9px] font-black text-slate-400"
                >{{ project.progress }}%</span
              >
              <span
                class="block h-1 mt-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
              >
                <span
                  class="block h-full rounded-full bg-accent"
                  :style="{ width: progressWidth(project.progress) }"
                ></span>
              </span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <template v-if="memberInsight" #footer>
      <div class="flex items-center gap-3 w-full">
        <Button
          variant="secondary"
          class="flex-1"
          size="md"
          @click="$emit('view-profile', memberInsight.member.userId)"
        >
          查看资料
        </Button>
        <Button
          variant="primary"
          class="flex-1"
          size="md"
          @click="$emit('chat', memberInsight.member.user)"
        >
          发起私聊
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.animate-in {
  animation: animate-in 0.5s ease-out;
}

@keyframes animate-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
