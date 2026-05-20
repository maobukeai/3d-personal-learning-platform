<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Users } from 'lucide-vue-next';

const router = useRouter();
</script>

<template>
  <div class="p-6 sm:p-8 glass-card bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
    <div class="flex items-center gap-3 mb-4">
      <div class="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
        <Users class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
      </div>
      <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">
        团队协作
      </h3>
    </div>
    <p class="text-[11px] sm:text-xs leading-relaxed mb-5 sm:mb-6" style="color: var(--text-secondary)">
      加入一个兴趣小组，与志同道合的伙伴一起完成大型渲染项目。
    </p>
    <div class="flex -space-x-2 mb-6 sm:mb-8">
      <div
        v-for="(letter, idx) in ['K', 'J', 'Y', 'H']"
        :key="idx"
        class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white shadow-md select-none"
        style="border-color: var(--bg-card)"
        :class="[
          idx === 0 ? 'bg-gradient-to-tr from-pink-500 to-rose-400' : '',
          idx === 1 ? 'bg-gradient-to-tr from-amber-500 to-orange-400' : '',
          idx === 2 ? 'bg-gradient-to-tr from-emerald-500 to-teal-400' : '',
          idx === 3 ? 'bg-gradient-to-tr from-blue-500 to-indigo-400' : '',
        ]"
      >
        {{ letter }}
      </div>
      <div
        class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[9px] sm:text-[10px] font-bold"
        style="
          background-color: var(--bg-app);
          border-color: var(--border-base);
          color: var(--text-secondary);
        "
      >
        +5
      </div>
    </div>
    <button
      class="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[11px] sm:text-xs font-bold transition-transform hover:scale-[1.02]"
      @click="router.push('/explore-teams')"
    >
      寻找团队伙伴
    </button>
  </div>
</template>
