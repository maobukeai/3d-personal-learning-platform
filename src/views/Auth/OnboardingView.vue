<script setup lang="ts">
import { useRouter } from 'vue-router'
import { User, Users, ArrowRight, CheckCircle2, Sparkles } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const handleStartPersonal = () => {
  // Personal workspace is default
  router.push('/dashboard')
}

const handleJoinTeam = () => {
  router.push('/explore-teams')
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 font-sans">
    <div class="max-w-4xl w-full">
      <!-- Header -->
      <div class="text-center mb-12">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-2xl shadow-xl shadow-accent/20 mb-6 rotate-3">
          <Sparkles class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-4xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
          欢迎来到 <span class="text-accent">3D 创意学习中心</span>
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          你好，<span class="font-bold text-slate-700 dark:text-slate-200">{{ authStore.user?.name }}</span>！
          我们已经为你准备好了学习环境。请选择你接下来的首要目标：
        </p>
      </div>

      <!-- Options Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Personal Learning -->
        <div @click="handleStartPersonal" 
             class="group relative bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-accent dark:hover:border-accent hover:shadow-2xl transition-all cursor-pointer overflow-hidden">
          <div class="absolute -right-6 -top-6 w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors"></div>
          
          <div class="relative z-10">
            <div class="w-14 h-14 bg-accent-subtle rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <User class="w-7 h-7 text-accent" />
            </div>
            
            <h3 class="text-xl font-bold text-slate-800 dark:text-white mb-3">开启个人学习空间</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              为你自动创建的私密空间。在这里你可以管理个人资产、记录学习进度、练习 3D 建模，不受他人打扰。
            </p>
            
            <ul class="space-y-3 mb-8">
              <li class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <CheckCircle2 class="w-4 h-4 text-emerald-500" /> 私密资产库与作品集
              </li>
              <li class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <CheckCircle2 class="w-4 h-4 text-emerald-500" /> 个人学习路线与任务板
              </li>
              <li class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <CheckCircle2 class="w-4 h-4 text-emerald-500" /> 沉浸式 3D 学习体验
              </li>
            </ul>
            
            <div class="flex items-center gap-2 font-bold text-accent group-hover:gap-4 transition-all">
              开始学习 <ArrowRight class="w-4 h-4" />
            </div>
          </div>
        </div>

        <!-- Team Collaboration -->
        <div @click="handleJoinTeam" 
             class="group relative bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 hover:shadow-2xl transition-all cursor-pointer overflow-hidden">
          <div class="absolute -right-6 -top-6 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-colors"></div>
          
          <div class="relative z-10">
            <div class="w-14 h-14 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Users class="w-7 h-7 text-orange-500" />
            </div>
            
            <h3 class="text-xl font-bold text-slate-800 dark:text-white mb-3">加入或创建学习小组</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              与志同道合的设计师一起进步。在团队空间共享资源、分配任务，共同完成大型 3D 项目。
            </p>
            
            <ul class="space-y-3 mb-8">
              <li class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <CheckCircle2 class="w-4 h-4 text-orange-500" /> 团队共享 3D 资产库
              </li>
              <li class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <CheckCircle2 class="w-4 h-4 text-orange-500" /> 协作项目管理与讨论
              </li>
              <li class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <CheckCircle2 class="w-4 h-4 text-orange-500" /> 实时消息与在线协作
              </li>
            </ul>
            
            <div class="flex items-center gap-2 font-bold text-orange-500 group-hover:gap-4 transition-all">
              探索小组 <ArrowRight class="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-6">
          <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">当前状态</span>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span class="text-xs font-bold text-slate-600 dark:text-slate-300">个人空间已就绪</span>
            </div>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">系统提示</span>
            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">你可以随时在侧边栏切换空间</span>
          </div>
        </div>
        
        <button @click="router.push('/dashboard')" class="text-sm font-bold text-slate-400 hover:text-accent transition-colors">
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
