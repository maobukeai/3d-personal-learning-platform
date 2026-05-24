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
  preventNavigation?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'grid',
  preventNavigation: false,
});

const emit = defineEmits<{
  (e: 'edit', project: Project): void;
  (e: 'delete', id: string): void;
  (e: 'click', id: string): void;
}>();

const router = useRouter();

const handleClick = () => {
  emit('click', props.project.id);
  if (!props.preventNavigation) {
    router.push({ name: 'ProjectDetail', params: { id: props.project.id } });
  }
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
    class="bg-white dark:bg-slate-900 rounded-[1rem] sm:rounded-[1.25rem] p-3 sm:p-4 border shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer relative overflow-hidden"
    style="border-color: var(--border-base)"
    @click="handleClick"
  >
    <!-- Decorator Blur -->
    <div
      class="absolute -top-10 -right-10 w-28 h-28 opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
      :class="project.color || 'bg-accent'"
    ></div>

    <div class="relative z-10 flex flex-col h-full">
      <div class="flex items-start justify-between mb-1.5 sm:mb-3">
        <div
          class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center text-white shadow-md"
          :class="project.color || 'bg-accent'"
        >
          <span class="text-xs sm:text-sm font-black uppercase">
            {{ project.title.substring(0, 2) }}
          </span>
        </div>
        <div @click.stop>
          <el-dropdown trigger="click">
            <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" style="color: var(--text-secondary)">
              <MoreHorizontal class="w-4 h-4 sm:w-4.5 sm:h-4.5" />
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
      </div>

      <h3
        class="text-xs sm:text-sm font-black group-hover:text-accent transition-colors mb-1 line-clamp-1"
        style="color: var(--text-primary)"
      >
        {{ project.title }}
      </h3>
      <p
        class="text-[9px] sm:text-xs leading-relaxed mb-2 sm:mb-3 line-clamp-2"
        style="color: var(--text-secondary)"
      >
        {{ project.description || '暂无项目描述。' }}
      </p>

      <!-- Tags -->
      <div class="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
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
      <div class="mt-auto space-y-1 sm:space-y-2 mb-2.5 sm:mb-3.5">
        <div
          class="flex items-center justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-widest"
        >
          <span style="color: var(--text-secondary)">完成度</span>
          <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'">
            {{ project.progress || 0 }}%
          </span>
        </div>
        <div class="h-1 sm:h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full transition-all duration-1000"
            :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
            :style="{ width: (project.progress || 0) + '%' }"
          ></div>
        </div>
      </div>

      <!-- Footer Info -->
      <div
        class="flex items-center justify-between pt-2 sm:pt-2.5 border-t"
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
          class="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[8px] sm:text-[10px] font-black tracking-wider"
          :class="
            project.status === 'COMPLETED'
              ? 'bg-emerald-500/10 text-emerald-500'
              : project.status === 'IN_PROGRESS'
                ? 'bg-accent/10 text-accent'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          "
        >
          <CheckCircle2 v-if="project.status === 'COMPLETED'" class="w-2.5 sm:w-3 h-2.5 sm:h-3" />
          <Activity v-else-if="project.status === 'IN_PROGRESS'" class="w-2.5 sm:w-3 h-2.5 sm:h-3" />
          <Clock v-else class="w-2.5 sm:w-3 h-2.5 sm:h-3" />
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
    <td class="px-6 py-2">
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm"
          :class="project.color || 'bg-accent'"
        >
          {{ project.title.substring(0, 1) }}
        </div>
        <div>
          <p
            class="text-xs font-black group-hover:text-accent transition-colors"
            style="color: var(--text-primary)"
          >
            {{ project.title }}
          </p>
          <p class="text-[10px] font-bold text-slate-400 mt-0.5 line-clamp-1 max-w-xs md:max-w-md lg:max-w-lg">
            {{ project.description || '暂无描述' }}
          </p>
        </div>
      </div>
    </td>
    <td class="px-6 py-2">
      <div class="w-32">
        <div class="flex items-center justify-between text-[10px] font-black mb-1">
          <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'">
            {{ project.progress || 0 }}%
          </span>
        </div>
        <div class="h-1 rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full transition-all"
            :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
            :style="{ width: (project.progress || 0) + '%' }"
          ></div>
        </div>
      </div>
    </td>
    <td class="px-6 py-2">
      <span
        class="px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider"
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
    <td class="px-6 py-2">
      <div class="flex items-center -space-x-1.5">
        <UserAvatar
          v-for="m in project.members.slice(0, 3)"
          :key="m.userId"
          :user="m.user"
          size="xs"
          class="border"
          style="border-color: var(--bg-card)"
        />
        <div
          v-if="project.members.length > 3"
          class="w-6 h-6 rounded-full border bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500"
          style="border-color: var(--bg-card)"
        >
          +{{ project.members.length - 3 }}
        </div>
      </div>
    </td>
    <td class="px-6 py-2 text-right">
      <div class="inline-block text-left" @click.stop>
        <el-dropdown trigger="click">
          <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" style="color: var(--text-secondary)">
            <MoreHorizontal class="w-4 h-4" />
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
      <div @click.stop>
        <el-dropdown trigger="click">
          <button type="button" class="p-2 -mr-2">
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
