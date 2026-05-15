<script setup lang="ts">
import { Hammer, Loader2 } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { useSystemStore } from '@/stores/system';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const systemStore = useSystemStore();
const authStore = useAuthStore();

const goToLogin = async () => {
  if (authStore.isAuthenticated) {
    authStore.logout();
  }
  router.push('/login');
};
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
    style="background-color: var(--bg-app)"
  >
    <!-- Decorative background elements -->
    <div
      class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full"
    ></div>
    <div
      class="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-600/10 blur-[100px] rounded-full"
    ></div>

    <div class="max-w-2xl w-full text-center relative z-10">
      <div
        class="inline-flex items-center justify-center w-24 h-24 bg-rose-500/10 rounded-3xl mb-8 relative group"
      >
        <Hammer class="w-12 h-12 text-rose-500 transition-transform group-hover:rotate-[-10deg]" />
        <div class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full animate-ping"></div>
      </div>

      <h1 class="text-4xl font-black mb-4 tracking-tight" style="color: var(--text-primary)">
        系统维护中
      </h1>

      <p
        class="text-lg font-medium mb-12 max-w-lg mx-auto leading-relaxed"
        style="color: var(--text-secondary)"
      >
        为了给您提供更好的体验，{{ systemStore.settings.PLATFORM_NAME }} 正在进行系统升级与维护。
        请稍后再来，感谢您的理解与配合。
      </p>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <div
          class="flex items-center gap-3 px-6 py-3 bg-white/5 border rounded-2xl"
          style="border-color: var(--border-base)"
        >
          <Loader2 class="w-4 h-4 text-accent animate-spin" />
          <span class="text-sm font-bold" style="color: var(--text-primary)"
            >正在优化 3D 渲染引擎...</span
          >
        </div>
      </div>

      <div class="mt-16 pt-8 border-t" style="border-color: var(--border-base)">
        <p
          class="text-xs font-bold uppercase tracking-widest mb-4"
          style="color: var(--text-muted)"
        >
          如果您是管理员
        </p>
        <button
          class="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:scale-105 transition-all active:scale-95"
          @click="goToLogin"
        >
          进入后台管理
        </button>
      </div>
    </div>

    <div
      class="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest opacity-30"
      style="color: var(--text-muted)"
    >
      &copy; 2026 {{ systemStore.settings.PLATFORM_NAME }}
    </div>
  </div>
</template>
