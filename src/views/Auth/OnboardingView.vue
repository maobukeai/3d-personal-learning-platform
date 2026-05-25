<script setup lang="ts">
import { useRouter } from 'vue-router';
import { User, Users, ArrowRight, CheckCircle2, Sparkles } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const handleStartPersonal = () => {
  // Personal workspace is default
  router.push('/dashboard');
};

const handleJoinTeam = () => {
  router.push('/explore-teams');
};
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center p-3 sm:p-6 bg-slate-50 dark:bg-slate-900 font-sans animate-fade-in overflow-hidden"
  >
    <div class="max-w-4xl w-full flex flex-col justify-between my-auto">
      <!-- Header -->
      <div class="text-center mb-5 sm:mb-10 md:mb-12">
        <div
          class="inline-flex items-center justify-center w-10 h-10 sm:w-16 h-16 bg-accent rounded-xl sm:rounded-2xl shadow-xl shadow-accent/20 mb-3 sm:mb-6 rotate-3"
        >
          <Sparkles class="w-5 h-5 sm:w-8 h-8 text-white" />
        </div>
        <h1 class="text-xl sm:text-3xl md:text-4xl font-black text-slate-800 dark:text-white mb-2 sm:mb-4 tracking-tight px-1">
          欢迎来到 <span class="text-accent">3D 创意学习中心</span>
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-xs sm:text-base md:text-lg max-w-xl mx-auto leading-relaxed px-2">
          你好，<span class="font-bold text-slate-700 dark:text-slate-200">{{
            authStore.user?.name
          }}</span
          >！请选择你接下来的首要目标：
        </p>
      </div>

      <!-- Options Grid: horizontal on both small and large screens for zero scroll -->
      <div class="grid grid-cols-2 gap-3 sm:gap-6 md:gap-8 px-1 sm:px-0">
        <!-- Personal Learning -->
        <div
          class="group relative bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-accent dark:hover:border-accent hover:shadow-2xl transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
          @click="handleStartPersonal"
        >
          <div
            class="absolute -right-6 -top-6 w-20 h-20 sm:w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors"
          ></div>

          <div class="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div
                class="w-10 h-10 sm:w-14 h-14 bg-accent-subtle rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 group-hover:scale-105 transition-transform"
              >
                <User class="w-5 h-5 sm:w-7 h-7 text-accent" />
              </div>

              <h3 class="text-xs sm:text-lg md:text-xl font-bold text-slate-800 dark:text-white mb-1.5 sm:mb-3">开启个人空间</h3>
              <p class="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 mb-3 sm:mb-6 leading-relaxed line-clamp-2 sm:line-clamp-none">
                专属个人私密创作空间，管理个人资产，不受他人打扰。
              </p>

              <!-- Features list hidden on mobile to enforce zero scroll -->
              <ul class="hidden sm:block space-y-3 mb-6 sm:mb-8">
                <li
                  class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <CheckCircle2 class="w-4 h-4 text-emerald-500" /> 私密资产库与作品集
                </li>
                <li
                  class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <CheckCircle2 class="w-4 h-4 text-emerald-500" /> 个人学习路线与任务板
                </li>
                <li
                  class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <CheckCircle2 class="w-4 h-4 text-emerald-500" /> 沉浸式 3D 学习体验
                </li>
              </ul>
            </div>

            <div
              class="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-base font-bold text-accent group-hover:gap-3 transition-all mt-2"
            >
              开始学习 <ArrowRight class="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        <!-- Team Collaboration -->
        <div
          class="group relative bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 hover:shadow-2xl transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
          @click="handleJoinTeam"
        >
          <div
            class="absolute -right-6 -top-6 w-20 h-20 sm:w-32 h-32 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-colors"
          ></div>

          <div class="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div
                class="w-10 h-10 sm:w-14 h-14 bg-orange-50 dark:bg-orange-900/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 group-hover:scale-105 transition-transform"
              >
                <Users class="w-5 h-5 sm:w-7 h-7 text-orange-500" />
              </div>

              <h3 class="text-xs sm:text-lg md:text-xl font-bold text-slate-800 dark:text-white mb-1.5 sm:mb-3">
                加入学习小组
              </h3>
              <p class="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 mb-3 sm:mb-6 leading-relaxed line-clamp-2 sm:line-clamp-none">
                与志同道合的设计师一起进步，共享资源分配任务。
              </p>

              <!-- Features list hidden on mobile to enforce zero scroll -->
              <ul class="hidden sm:block space-y-3 mb-6 sm:mb-8">
                <li
                  class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <CheckCircle2 class="w-4 h-4 text-orange-500" /> 团队共享 3D 资产库
                </li>
                <li
                  class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <CheckCircle2 class="w-4 h-4 text-orange-500" /> 协作项目管理与讨论
                </li>
                <li
                  class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <CheckCircle2 class="w-4 h-4 text-orange-500" /> 实时消息与在线协作
                </li>
              </ul>
            </div>

            <div
              class="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-base font-bold text-orange-500 group-hover:gap-3 transition-all mt-2"
            >
              探索小组 <ArrowRight class="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Info: single line row on mobile to save vertical space -->
      <div
        class="mt-6 sm:mt-12 md:mt-16 pt-4 sm:pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between gap-4 w-full"
      >
        <div class="flex items-center gap-4 text-left">
          <div class="flex flex-col">
            <span class="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5"
              >当前状态</span
            >
            <div class="flex items-center gap-1.5">
              <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span class="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300"
                >个人空间就绪</span
              >
            </div>
          </div>
        </div>

        <button type="button" class="text-[10px] sm:text-sm font-bold text-slate-400 hover:text-accent transition-colors text-right" @click="router.push('/dashboard')">
          稍后设置，直接进入控制台
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group {
  backface-visibility: hidden;
}
</style>
