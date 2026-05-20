<script setup lang="ts">
import { useRouter } from 'vue-router';
import {
  MoreHorizontal,
  CheckCircle2,
  Activity,
  Clock,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';

interface Member {
  userId: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

interface Project {
  id: string;
  title: string;
  description?: string | null;
  color?: string;
  progress?: number;
  status: string;
  tags?: string | null;
  members: Member[];
}

interface Props {
  project: Project;
  layout?: 'grid' | 'row' | 'card-simple';
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'grid',
});

const emit = defineEmits<{
  (e: 'edit', project: Project): void;
  (e: 'delete', id: string): void;
  (e: 'click', id: string): void;
}>();

const router = useRouter();

const handleClick = () => {
  emit('click', props.project.id);
  router.push({ name: 'ProjectDetail', params: { id: props.project.id } });
};

const getTagsList = (tags: string | null | undefined) => {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t);
};

const statusOptions = [
  { value: 'PLANNED', label: '规划中' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'PAUSED', label: '已暂停' },
  { value: 'COMPLETED', label: '已完成' },
];

const getStatusLabel = (status: string) => {
  return statusOptions.find((o) => o.value === status)?.label || status;
};
</script>

<template>
  <!-- Layout 1: Grid Mode -->
  <div
    v-if="layout === 'grid'"
    class="bg-white dark:bg-slate-900 rounded-[1.25rem] sm:rounded-[2.5rem] p-3.5 sm:p-8 border shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative overflow-hidden"
    style="border-color: var(--border-base)"
    @click="handleClick"
  >
    <!-- Decorator Blur -->
    <div
      class="absolute -top-10 -right-10 w-32 h-32 opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
      :class="project.color || 'bg-accent'"
    ></div>

    <div class="relative z-10 flex flex-col h-full">
      <div class="flex items-start justify-between mb-3 sm:mb-6">
        <div
          class="w-9 h-9 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl flex items-center justify-center text-white shadow-lg"
          :class="project.color || 'bg-accent'"
        >
          <span class="text-sm sm:text-xl font-black uppercase">
            {{ project.title.substring(0, 2) }}
          </span>
        </div>
        <el-dropdown trigger="click" @click.stop>
          <button
            class="p-1 sm:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg sm:rounded-xl transition-all"
            style="color: var(--text-secondary)"
          >
            <MoreHorizontal class="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <template #dropdown>
            <el-dropdown-menu class="!rounded-xl !p-2">
              <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="handleClick">
                查看详情
              </el-dropdown-item>
              <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="emit('edit', project)">
                配置项目
              </el-dropdown-item>
              <el-divider class="!my-1" />
              <el-dropdown-item
                class="!rounded-lg !text-rose-500 font-bold hover:!bg-rose-50 dark:hover:!bg-rose-500/10"
                @click="emit('delete', project.id)"
              >
                删除项目
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <h3
        class="text-sm sm:text-lg font-black group-hover:text-accent transition-colors mb-1 sm:mb-2 line-clamp-1"
        style="color: var(--text-primary)"
      >
        {{ project.title }}
      </h3>
      <p
        class="text-[9px] sm:text-xs leading-normal mb-3 sm:mb-6 line-clamp-2"
        style="color: var(--text-secondary)"
      >
        {{ project.description || '暂无项目描述。' }}
      </p>

      <!-- Tags -->
      <div class="flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-8">
        <span
          v-for="(tag, idx) in getTagsList(project.tags).slice(0, 3)"
          :key="tag"
          class="text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"
          :class="{ 'hidden sm:inline-flex': idx > 0 }"
        >
          #{{ tag }}
        </span>
        <span
          v-if="getTagsList(project.tags).length > 3"
          class="hidden sm:inline-flex text-[9px] sm:text-[10px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"
        >
          +{{ getTagsList(project.tags).length - 3 }}
        </span>
      </div>

      <!-- Progress -->
      <div class="mt-auto space-y-1.5 sm:space-y-3 mb-4 sm:mb-8">
        <div
          class="flex items-center justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-widest"
        >
          <span style="color: var(--text-secondary)">完成度</span>
          <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'">
            {{ project.progress || 0 }}%
          </span>
        </div>
        <div class="h-1 sm:h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full transition-all duration-1000"
            :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
            :style="{ width: (project.progress || 0) + '%' }"
          ></div>
        </div>
      </div>

      <!-- Footer Info -->
      <div
        class="flex items-center justify-between pt-3 sm:pt-5 border-t"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center -space-x-1 sm:-space-x-1.5">
          <div
            v-for="(m, i) in project.members.slice(0, 4)"
            :key="m.userId"
            class="z-10"
            :style="{ 'z-index': 10 - Number(i) }"
          >
            <UserAvatar
              :user="m.user"
              size="xs"
              class="sm:hidden border"
              style="border-color: var(--bg-card)"
            />
            <UserAvatar
              :user="m.user"
              size="sm"
              class="hidden sm:inline-flex border-2"
              style="border-color: var(--bg-card)"
            />
          </div>
          <div
            v-if="project.members.length > 4"
            class="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[7px] sm:text-[10px] font-bold text-slate-500"
          >
            +{{ project.members.length - 4 }}
          </div>
        </div>

        <div
          class="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black tracking-wider"
          :class="
            project.status === 'COMPLETED'
              ? 'bg-emerald-500/10 text-emerald-500'
              : project.status === 'IN_PROGRESS'
                ? 'bg-accent/10 text-accent'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          "
        >
          <CheckCircle2 v-if="project.status === 'COMPLETED'" class="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5" />
          <Activity v-else-if="project.status === 'IN_PROGRESS'" class="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5" />
          <Clock v-else class="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5" />
          {{ getStatusLabel(project.status) }}
        </div>
      </div>
    </div>
  </div>

  <!-- Layout 2: Row Mode (for Desktop Table) -->
  <tr
    v-else-if="layout === 'row'"
    class="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
    style="border-color: var(--border-base)"
    @click="handleClick"
  >
    <td class="px-8 py-6">
      <div class="flex items-center gap-4">
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-sm"
          :class="project.color || 'bg-accent'"
        >
          {{ project.title.substring(0, 1) }}
        </div>
        <div>
          <p
            class="text-sm font-black group-hover:text-accent transition-colors"
            style="color: var(--text-primary)"
          >
            {{ project.title }}
          </p>
          <p class="text-[10px] font-bold text-slate-400 mt-1 line-clamp-1 w-48">
            {{ project.description || '暂无描述' }}
          </p>
        </div>
      </div>
    </td>
    <td class="px-8 py-6">
      <div class="w-40">
        <div class="flex items-center justify-between text-[10px] font-black mb-2">
          <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'">
            {{ project.progress || 0 }}%
          </span>
        </div>
        <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full transition-all"
            :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
            :style="{ width: (project.progress || 0) + '%' }"
          ></div>
        </div>
      </div>
    </td>
    <td class="px-8 py-6">
      <span
        class="px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider"
        :class="
          project.status === 'COMPLETED'
            ? 'bg-emerald-500/10 text-emerald-500'
            : project.status === 'IN_PROGRESS'
              ? 'bg-accent/10 text-accent'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        "
      >
        {{ getStatusLabel(project.status) }}
      </span>
    </td>
    <td class="px-8 py-6">
      <div class="flex items-center -space-x-2">
        <UserAvatar
          v-for="m in project.members.slice(0, 3)"
          :key="m.userId"
          :user="m.user"
          size="sm"
          class="border-2"
          style="border-color: var(--bg-card)"
        />
        <div
          v-if="project.members.length > 3"
          class="w-8 h-8 rounded-full border-2 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500"
          style="border-color: var(--bg-card)"
        >
          +{{ project.members.length - 3 }}
        </div>
      </div>
    </td>
    <td class="px-8 py-6 text-right">
      <el-dropdown trigger="click" @click.stop>
        <button
          class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          style="color: var(--text-secondary)"
        >
          <MoreHorizontal class="w-5 h-5" />
        </button>
        <template #dropdown>
          <el-dropdown-menu class="!rounded-xl !p-2">
            <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="handleClick">
              查看详情
            </el-dropdown-item>
            <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="emit('edit', project)">
              配置项目
            </el-dropdown-item>
            <el-divider class="!my-1" />
            <el-dropdown-item
              class="!rounded-lg !text-rose-500 font-bold hover:!bg-rose-50 dark:hover:!bg-rose-500/10"
              @click="emit('delete', project.id)"
            >
              删除项目
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </td>
  </tr>

  <!-- Layout 3: Card Simple Mode (for Mobile Lists) -->
  <div
    v-else-if="layout === 'card-simple'"
    class="p-5 flex flex-col gap-4"
    @click="handleClick"
  >
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm"
          :class="project.color || 'bg-accent'"
        >
          {{ project.title.substring(0, 1) }}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-black truncate" style="color: var(--text-primary)">
            {{ project.title }}
          </p>
          <p class="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
            {{ project.description || '暂无描述' }}
          </p>
        </div>
      </div>
      <el-dropdown trigger="click" @click.stop>
        <button class="p-2 -mr-2">
          <MoreHorizontal class="w-4 h-4 text-slate-400" />
        </button>
        <template #dropdown>
          <el-dropdown-menu class="!rounded-xl !p-2">
            <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="handleClick">
              查看详情
            </el-dropdown-item>
            <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="emit('edit', project)">
              配置项目
            </el-dropdown-item>
            <el-divider class="!my-1" />
            <el-dropdown-item
              class="!rounded-lg !text-rose-500 font-bold hover:!bg-rose-50 dark:hover:!bg-rose-500/10"
              @click="emit('delete', project.id)"
            >
              删除项目
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- Progress Bar -->
    <div class="space-y-1.5">
      <div class="flex justify-between text-[10px] font-black">
        <span style="color: var(--text-secondary)">进度</span>
        <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'">
          {{ project.progress || 0 }}%
        </span>
      </div>
      <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          class="h-full rounded-full transition-all duration-1000"
          :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
          :style="{ width: (project.progress || 0) + '%' }"
        ></div>
      </div>
    </div>

    <!-- Footer: Members + Status -->
    <div class="flex items-center justify-between pt-1">
      <div class="flex items-center -space-x-1.5">
        <div
          v-for="(m, i) in project.members.slice(0, 4)"
          :key="m.userId"
          class="z-10"
          :style="{ 'z-index': 10 - Number(i) }"
        >
          <UserAvatar
            :user="m.user"
            size="sm"
            class="border-2"
            style="border-color: var(--bg-card)"
          />
        </div>
        <div
          v-if="project.members.length > 4"
          class="w-6 h-6 rounded-full border border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500"
        >
          +{{ project.members.length - 4 }}
        </div>
      </div>

      <div
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider"
        :class="
          project.status === 'COMPLETED'
            ? 'bg-emerald-500/10 text-emerald-500'
            : project.status === 'IN_PROGRESS'
              ? 'bg-accent/10 text-accent'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        "
      >
        <CheckCircle2 v-if="project.status === 'COMPLETED'" class="w-3 h-3" />
        <Activity v-else-if="project.status === 'IN_PROGRESS'" class="w-3 h-3" />
        <Clock v-else class="w-3 h-3" />
        {{ getStatusLabel(project.status) }}
      </div>
    </div>
  </div>
</template>
