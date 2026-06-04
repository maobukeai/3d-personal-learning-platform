<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { Sparkles, PlayCircle } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '深夜好';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const userName = computed(() => authStore.user?.name || '创作者');
</script>

<template>
  <div class="hero-banner relative overflow-hidden rounded-2xl p-6 sm:p-8" style="min-height: 180px;">
    <!-- Animated gradient background -->
    <div class="hero-gradient absolute inset-0 z-0"></div>
    <!-- Grid overlay -->
    <div class="hero-grid absolute inset-0 z-0 opacity-20"></div>
    <!-- Floating orbs -->
    <div class="orb orb-1 absolute z-0"></div>
    <div class="orb orb-2 absolute z-0"></div>

    <div class="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <Sparkles class="w-4 h-4 text-yellow-300" />
          <span class="text-xs font-bold text-yellow-200/90 uppercase tracking-wider">创作工作台</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-black text-white mb-1.5 leading-tight">
          {{ greeting }}，{{ userName }} 👋
        </h1>
        <p class="text-sm text-white/70 max-w-md leading-relaxed">
          今天也是充满灵感的一天！继续你的 3D 创作之旅，探索无限可能。
        </p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <button
          type="button"
          class="hero-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer"
          @click="router.push('/academy')"
        >
          <PlayCircle class="w-4 h-4" />
          开始学习
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-banner {
  background: linear-gradient(135deg, #1a1f3a 0%, #0f1628 50%, #1a2040 100%);
}

.hero-gradient {
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.35) 0%,
    rgba(139, 92, 246, 0.25) 30%,
    rgba(59, 130, 246, 0.2) 60%,
    rgba(16, 185, 129, 0.1) 100%
  );
}

.hero-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
}

.orb {
  border-radius: 50%;
  filter: blur(50px);
  animation: float 8s ease-in-out infinite;
}

.orb-1 {
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%);
  top: -40px;
  right: 80px;
  animation-delay: 0s;
}

.orb-2 {
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%);
  bottom: -20px;
  right: 20px;
  animation-delay: -4s;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(-12px) scale(1.05); }
}

.hero-btn-primary {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.hero-btn-primary:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}
</style>
