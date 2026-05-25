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
  coverUrl?: string | null;
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
    class="group relative bg-white/70 dark:bg-slate-800/70 rounded-xl lg:rounded-2xl border border-white/50 dark:border-slate-700/50 overflow-hidden hover:shadow-xl hover:border-accent/30 hover:-translate-y-0.5 transition-all duration-500 cursor-pointer backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4"
    :style="{
      'animation-delay': `${index * 30}ms`,
      'border-color': 'var(--border-base)',
    }"
    @click="emit('click', team)"
  >
    <!-- Joined Badge: Round circle badge on mobile to avoid overflow -->
    <div
      v-if="isJoined"
      class="absolute top-1 right-1 lg:top-3 lg:right-3 z-20 flex items-center justify-center w-5 h-5 lg:w-auto lg:h-auto lg:gap-1 px-1 lg:px-2.5 py-0.5 lg:py-1 bg-emerald-500/90 backdrop-blur-md text-white text-[9px] lg:text-[10px] font-black rounded-full lg:rounded-lg uppercase tracking-wider shadow-md"
    >
      <Check class="w-2.5 h-2.5 lg:w-3.5 lg:h-3.5" />
      <span class="hidden lg:inline">已加入</span>
    </div>

    <!-- Card Header / Cover Image: Squeezed on mobile -->
    <div class="h-14 sm:h-24 lg:h-32 relative overflow-hidden shrink-0">
      <img
        :src="
          team.coverUrl ||
          team.avatarUrl ||
          `https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=500&q=80`
        " class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Team Cover" />
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
      ></div>
    </div>

    <!-- Card Body: Squeezed padding -->
    <div class="p-1.5 sm:p-3 lg:p-5 flex flex-col justify-between h-auto">
      <div>
        <h3
          class="font-black text-slate-900 dark:text-white text-[11px] sm:text-sm lg:text-base group-hover:text-accent transition-colors truncate mb-0.5 sm:mb-1"
        >
          {{ team.name }}
        </h3>
        <!-- Description hidden on mobile to fit 3-column view -->
        <p
          class="hidden sm:block text-xs lg:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed h-8 lg:h-10"
        >
          {{ team.description || '探索 3D 的边界，开启创意之旅。' }}
        </p>
      </div>

      <!-- Card Footer: simplified flex on mobile -->
      <div
        class="flex flex-row items-center justify-between mt-1.5 sm:mt-3 pt-1.5 sm:pt-2.5 border-t border-slate-50 dark:border-slate-700/50 gap-1 sm:gap-2 w-full"
      >
        <!-- Members Avatars: hidden on mobile to give space for button -->
        <div class="hidden sm:flex items-center gap-2">
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
              class="w-5 h-5 lg:w-6 lg:h-6 rounded-full border border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-black text-slate-400"
            >
              <Users class="w-3 h-3 lg:w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span
              class="text-[10px] lg:text-xs font-black block leading-none"
              style="color: var(--text-primary)"
            >
              {{ team._count?.members || 0 }}
            </span>
          </div>
        </div>

        <!-- Action Button: full-width on mobile -->
        <div class="w-full sm:w-auto" @click.stop>
          <button v-if="isJoined" type="button" class="w-full sm:w-auto flex items-center justify-center gap-1 px-1.5 sm:px-3.5 py-0.5 sm:py-1.5 bg-accent text-white rounded-md text-[9px] sm:text-xs font-black uppercase tracking-wider hover:bg-accent-dark transition-all shadow-sm cursor-pointer" @click="emit('enter', team)">
            进入
          </button>
          <button v-else type="button" :disabled="isApplying" class="w-full sm:w-auto flex items-center justify-center gap-1 px-1.5 sm:px-3.5 py-0.5 sm:py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-[9px] sm:text-xs font-black uppercase tracking-wider hover:bg-accent hover:text-white transition-all disabled:opacity-50 cursor-pointer" @click="emit('join', team)">
            {{ isApplying ? '申请' : '加入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
