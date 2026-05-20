<script setup lang="ts">
import { Users, Check } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';

interface Member {
  id: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

interface TeamCount {
  members?: number;
}

interface Team {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  members?: Member[];
  _count?: TeamCount;
}

interface Props {
  team: Team;
  isJoined?: boolean;
  isApplying?: boolean;
  index?: number;
}

withDefaults(defineProps<Props>(), {
  isJoined: false,
  isApplying: false,
  index: 0,
});

const emit = defineEmits<{
  (e: 'click', team: Team): void;
  (e: 'join', team: Team): void;
  (e: 'enter', team: Team): void;
}>();
</script>

<template>
  <div
    class="group relative bg-white/70 dark:bg-slate-800/70 rounded-[20px] lg:rounded-[24px] border border-white/50 dark:border-slate-700/50 overflow-hidden hover:shadow-xl hover:border-accent/30 hover:-translate-y-1 transition-all duration-500 cursor-pointer backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4"
    :style="{
      'animation-delay': `${index * 30}ms`,
      'border-color': 'var(--border-base)',
    }"
    @click="emit('click', team)"
  >
    <!-- Joined Badge -->
    <div
      v-if="isJoined"
      class="absolute top-2 right-2 lg:top-4 lg:right-4 z-20 flex items-center gap-1 px-1.5 lg:px-3 py-1 lg:py-1.5 bg-emerald-500/90 backdrop-blur-md text-white text-[7px] lg:text-[9px] font-black rounded-lg lg:rounded-xl uppercase tracking-wider shadow-md"
    >
      <Check class="w-2.5 h-2.5 lg:w-3 h-3" />
      <span class="hidden lg:inline">已加入</span>
    </div>

    <!-- Card Header / Cover Image -->
    <div class="h-24 lg:h-36 relative overflow-hidden">
      <img
        :src="
          team.avatarUrl ||
          `https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=500&q=80`
        "
        class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        alt="Team Cover"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
      ></div>
    </div>

    <!-- Card Body -->
    <div class="p-3 lg:p-5">
      <h3
        class="font-black text-slate-900 dark:text-white text-xs lg:text-base group-hover:text-accent transition-colors truncate mb-0.5 lg:mb-1"
      >
        {{ team.name }}
      </h3>
      <p
        class="text-[9px] lg:text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed h-6 lg:h-8"
      >
        {{ team.description || '探索 3D 的边界，开启创意之旅。' }}
      </p>

      <!-- Card Footer -->
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between mt-3 lg:mt-4 pt-2 lg:pt-3 border-t border-slate-50 dark:border-slate-700/50 gap-2"
      >
        <!-- Members Avatars -->
        <div class="flex items-center gap-2">
          <div class="flex -space-x-1.5">
            <template v-if="team.members && team.members.length">
              <UserAvatar
                v-for="member in team.members.slice(0, 3)"
                :key="member.id"
                :user="member.user"
                size="xs"
                class="ring-2 ring-white dark:ring-slate-800"
              />
            </template>
            <div
              v-else
              class="w-5 h-5 lg:w-6 lg:h-6 rounded-full border border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[7px] lg:text-[8px] font-black text-slate-400"
            >
              <Users class="w-2.5 h-2.5 lg:w-3 h-3" />
            </div>
          </div>
          <div class="hidden sm:block">
            <span
              class="text-[8px] lg:text-[10px] font-black block leading-none"
              style="color: var(--text-primary)"
            >
              {{ team._count?.members || 0 }}
            </span>
          </div>
        </div>

        <!-- Action Button -->
        <div class="w-full sm:w-auto" @click.stop>
          <button
            v-if="isJoined"
            class="w-full sm:w-auto flex items-center justify-center gap-1 px-2 lg:px-3 py-1 lg:py-1.5 bg-accent text-white rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-wider hover:bg-accent-dark transition-all shadow-sm"
            @click="emit('enter', team)"
          >
            进入
          </button>
          <button
            v-else
            :disabled="isApplying"
            class="w-full sm:w-auto flex items-center justify-center gap-1 px-2 lg:px-3 py-1 lg:py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-wider hover:bg-accent hover:text-white transition-all disabled:opacity-50"
            @click="emit('join', team)"
          >
            {{ isApplying ? '提交' : '加入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
