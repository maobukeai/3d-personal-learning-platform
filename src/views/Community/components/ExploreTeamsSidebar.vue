<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ChevronLeft, Sparkles, Layers, Users, Trophy, Plus, ArrowRight } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';

defineProps<{
  activeTeamsCount: number;
  t: (key: string, ...args: unknown[]) => string;
}>();

const emit = defineEmits<{
  (e: 'create'): void;
}>();

const router = useRouter();
</script>

<template>
  <aside
    class="w-full md:w-80 lg:w-[360px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/20 backdrop-blur-xl p-4 sm:p-6 lg:p-7 flex flex-col justify-between overflow-y-auto custom-scrollbar gap-6 relative z-10 mobile-adaptive"
  >
    <div class="flex flex-col gap-6">
      <Button
        variant="glass"
        size="sm"
        :icon="ChevronLeft"
        class="!rounded-full !py-0.5 !px-3 !h-7 hover:!text-accent transition-all text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] self-start shadow-sm"
        @click="router.back()"
      >
        {{ t('teams.back') }}
      </Button>

      <div>
        <div
          class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-accent/10 backdrop-blur-md border border-accent/20 text-accent rounded-full mb-3"
        >
          <Sparkles class="w-2.5 h-2.5" />
          <span class="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">{{
            t('teams.title')
          }}</span>
        </div>
        <h1
          class="text-xl sm:text-2xl font-black tracking-tight leading-tight"
          style="color: var(--text-primary)"
        >
          {{ t('teams.collaborateTitle') }}
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-accent via-blue-400 to-indigo-500 block mt-1"
            >{{ t('teams.collaborateSub') }}</span
          >
        </h1>
        <p class="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
          {{ t('teams.welcomeText') }}
        </p>
      </div>

      <div class="flex flex-col gap-2.5">
        <div
          class="flex items-center gap-3 px-3 py-2.5 bg-white/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-2xs hover:border-accent/20 transition-all duration-300"
        >
          <div class="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Layers class="w-4 h-4 text-accent" />
          </div>
          <div>
            <div class="font-black" style="color: var(--text-primary)">
              {{ t('teams.assetLib') }}
            </div>
            <div class="text-[10px] text-slate-400 font-medium mt-0.5">
              共享模型、资源与学习成果
            </div>
          </div>
        </div>

        <div
          class="flex items-center gap-3 px-3 py-2.5 bg-white/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-2xs hover:border-accent/20 transition-all duration-300"
        >
          <div
            class="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0"
          >
            <Users class="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div class="font-black" style="color: var(--text-primary)">
              {{ t('teams.realtimeCollab') }}
            </div>
            <div class="text-[10px] text-slate-400 font-medium mt-0.5">
              多人实时编辑、协作与评论
            </div>
          </div>
        </div>

        <div
          class="flex items-center gap-3 px-3 py-2.5 bg-white/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-2xs hover:border-accent/20 transition-all duration-300"
        >
          <div class="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Trophy class="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div class="font-black" style="color: var(--text-primary)">
              {{ t('teams.tutorSupport') }}
            </div>
            <div class="text-[10px] text-slate-400 font-medium mt-0.5">
              行业大咖、导师在线答疑解惑
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="group relative bg-white/80 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-2xl hover:shadow-lg hover:border-accent transition-all duration-300 cursor-pointer overflow-hidden mt-6 shadow-2xs"
      @click="emit('create')"
    >
      <div
        class="absolute -right-6 -top-6 w-20 h-20 bg-accent/10 rounded-full blur-2xl group-hover:bg-accent/20 transition-colors duration-700"
      ></div>

      <div class="relative z-10 flex items-center gap-3.5 mb-2">
        <div
          class="w-9 h-9 bg-gradient-to-br from-accent to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-accent/20 group-hover:rotate-6 transition-all"
        >
          <Plus class="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h3
            class="text-sm sm:text-base font-black tracking-tight"
            style="color: var(--text-primary)"
          >
            {{ t('teams.createTitle') }}
          </h3>
          <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Start Now
          </div>
        </div>
      </div>

      <p class="text-xs text-slate-500 dark:text-slate-400 mb-3.5 leading-relaxed font-medium">
        {{ t('teams.createSub') }}
      </p>

      <div class="flex items-center justify-between mobile-row">
        <div
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] sm:text-xs bg-accent text-white rounded-lg font-black uppercase tracking-wider shadow-md shadow-accent/20"
        >
          {{ t('teams.startCreate') }} <ArrowRight class="w-3 h-3" />
        </div>
        <div class="text-right">
          <div class="text-base font-black leading-none" style="color: var(--text-primary)">
            {{ activeTeamsCount }}
          </div>
          <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            {{ t('teams.activeTeams') }}
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
