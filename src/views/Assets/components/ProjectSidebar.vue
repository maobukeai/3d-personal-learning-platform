<script setup lang="ts">
import { ArrowLeft, Users, UserPlus } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import UserAvatar from '@/components/UserAvatar.vue';

const props = defineProps<{
  project: any;
  isMember: boolean;
  isMobile: boolean;
}>();

const emit = defineEmits<{
  (e: 'join'): void;
  (e: 'invite'): void;
  (e: 'open-profile', userId: string): void;
}>();

const router = useRouter();

const getTagsList = (tags: string | null) => {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t);
};
</script>

<template>
  <aside
    v-if="!props.isMobile"
    class="w-full lg:w-96 bg-white dark:bg-slate-900 border-r flex flex-col shrink-0 transition-colors z-10 shadow-[5px_0_30px_rgba(0,0,0,0.02)] overflow-y-auto"
    style="border-color: var(--border-base)"
  >
    <!-- Back & Title -->
    <div class="p-8 pb-4">
      <button type="button" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-accent hover:scale-110 transition-all mb-8 cursor-pointer" @click="router.push('/team-tasks')">
        <ArrowLeft class="w-5 h-5" />
      </button>

      <div class="flex items-start gap-4 mb-4">
        <div
          class="w-14 h-14 rounded-[1rem] flex items-center justify-center text-white text-2xl font-black shadow-lg shrink-0"
          :class="props.project.color"
        >
          {{ props.project.title.substring(0, 1) }}
        </div>
        <div>
          <h1
            class="text-2xl font-black tracking-tight leading-tight mb-2"
            style="color: var(--text-primary)"
          >
            {{ props.project.title }}
          </h1>
          <div class="flex items-center gap-2">
            <span
              class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest"
              :class="
                props.project.status === 'COMPLETED'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-accent/10 text-accent'
              "
            >
              {{
                props.project.status === 'COMPLETED'
                  ? '已完成'
                  : props.project.status === 'IN_PROGRESS'
                    ? '进行中'
                    : props.project.status === 'PAUSED'
                      ? '已暂停'
                      : '规划中'
              }}
            </span>
            <span
              class="text-[10px] font-bold text-slate-400 border px-2 py-0.5 rounded-md"
              style="border-color: var(--border-base)"
            >
              {{ props.project.visibility === 'PUBLIC' ? '公开报名' : '私有项目' }}
            </span>
          </div>
        </div>
      </div>

      <p class="text-sm leading-relaxed text-slate-500 dark:text-slate-400 mb-6 line-clamp-3">
        {{ props.project.description || '暂无详细描述，伟大的想法正在酝酿中...' }}
      </p>

      <div class="flex flex-wrap gap-2 mb-8">
        <span
          v-for="tag in getTagsList(props.project.tags)"
          :key="tag"
          class="text-xs font-bold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"
        >
          #{{ tag }}
        </span>
      </div>

      <!-- Progress -->
      <div
        class="space-y-3 mb-8 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border"
        style="border-color: var(--border-base)"
      >
        <div
          class="flex items-center justify-between text-[10px] font-black uppercase tracking-widest"
        >
          <span class="text-slate-500">总体完成度</span>
          <span :class="props.project.progress === 100 ? 'text-emerald-500' : 'text-accent'"
            >{{ props.project.progress }}%</span
          >
        </div>
        <div class="h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
          <div
            class="h-full rounded-full transition-all duration-1000"
            :class="props.project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
            :style="{ width: props.project.progress + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <div class="h-px bg-slate-100 dark:bg-slate-800 mx-8"></div>

    <!-- Members -->
    <div class="p-8 flex-1 overflow-y-auto scrollbar-hide">
      <div class="flex items-center justify-between mb-6">
        <h3
          class="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"
        >
          <Users class="w-4 h-4" /> 团队成员 ({{ props.project.members.length }}/{{
            props.project.maxMembers
          }})
        </h3>
        <div class="flex items-center gap-2">
          <button v-if="props.isMember" type="button" class="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer" @click="emit('invite')">
            <UserPlus class="w-3 h-3" /> 邀请
          </button>
          <button v-if="!props.isMember && props.project.members.length < props.project.maxMembers" type="button" class="text-xs font-bold text-accent hover:underline cursor-pointer" @click="emit('join')">
            报名加入
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div
          v-for="member in props.project.members"
          :key="member.id"
          class="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group cursor-pointer"
          @click="emit('open-profile', member.user.id)"
        >
          <UserAvatar
            :user="member.user"
            size="md"
            class="group-hover:ring-2 group-hover:ring-accent transition-all"
          />
          <div class="flex-1 min-w-0">
            <p
              class="text-sm font-bold truncate group-hover:text-accent transition-colors"
              style="color: var(--text-primary)"
            >
              {{ member.user.name || member.user.email }}
            </p>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
              {{ member.role }}
            </p>
          </div>
        </div>

        <!-- Empty Slots -->
        <div
          v-for="n in Math.max(0, props.project.maxMembers - props.project.members.length)"
          :key="`slot-${n}`"
          class="flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed opacity-50"
          style="border-color: var(--border-base)"
        >
          <div
            class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
          >
            <UserPlus class="w-4 h-4 text-slate-400" />
          </div>
          <span class="text-xs font-bold text-slate-400">虚位以待</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
