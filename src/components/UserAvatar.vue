<script setup lang="ts">
import { computed, ref } from 'vue'
import { User } from 'lucide-vue-next'

const props = defineProps<{
  user?: {
    name?: string
    avatarUrl?: string
    role?: string
    subscription?: {
      plan: {
        name: string
        displayName?: string
        badgeColor?: string
      }
      status?: string
      interval?: string
    }
  } | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const imageError = ref(false)

const handleImageError = () => {
  imageError.value = true
}

const sizeConfig = {
  sm: {
    container: 'w-6 h-6',
    text: 'text-[10px]',
    badge: 'px-1.5 py-0.5 text-[7px]',
    icon: 'w-4 h-4',
    ring: 'p-[1.5px]',
    glow: '',
    particles: false,
    crown: false
  },
  md: {
    container: 'w-9 h-9',
    text: 'text-xs',
    badge: 'px-1.5 py-0.5 text-[8px]',
    icon: 'w-4 h-4',
    ring: 'p-[2px]',
    glow: '',
    particles: false,
    crown: false
  },
  lg: {
    container: 'w-12 h-12',
    text: 'text-sm',
    badge: 'px-2 py-0.5 text-[9px]',
    icon: 'w-5 h-5',
    ring: 'p-[2.5px]',
    glow: '',
    particles: true,
    crown: false
  },
  xl: {
    container: 'w-24 h-24',
    text: 'text-xl',
    badge: 'px-3 py-1 text-[10px]',
    icon: 'w-10 h-10',
    ring: 'p-[3px]',
    glow: 'avatar-glow',
    particles: true,
    crown: true
  }
}

const planName = computed(() => props.user?.subscription?.plan?.name || 'FREE')
const isAdmin = computed(() => props.user?.role === 'ADMIN')
const isActiveSubscription = computed(() => props.user?.subscription?.status === 'ACTIVE')

const frameConfig = computed(() => {
  if (isAdmin.value) {
    return {
      tier: 'admin' as const,
      badgeText: 'ADM',
      badgeIcon: '⚡',
      ringGradient: 'conic-gradient(from 0deg, #f43f5e, #e11d48, #ff2d55, #f43f5e, #fb7185, #e11d48, #f43f5e)',
      ringShadow: '0 0 16px rgba(225, 29, 72, 0.6), 0 0 32px rgba(225, 29, 72, 0.2)',
      badgeGradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #be123c 100%)',
      badgeShadow: 'rgba(225, 29, 72, 0.5)',
      animatedRing: true,
      ringStyle: 'admin-ring',
      glow: 'admin-glow',
      particleColor: 'rgba(244, 63, 94, 0.8)',
      hoverGlow: '0 0 24px rgba(225, 29, 72, 0.7), 0 0 48px rgba(225, 29, 72, 0.3)'
    }
  }

  if (!isActiveSubscription.value && planName.value !== 'FREE') {
    return {
      tier: 'expired' as const,
      badgeText: '过期',
      badgeIcon: '',
      ringGradient: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 50%, #9ca3af 100%)',
      ringShadow: 'none',
      badgeGradient: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
      badgeShadow: 'rgba(107, 114, 128, 0.3)',
      animatedRing: false,
      ringStyle: '',
      glow: '',
      particleColor: '',
      hoverGlow: 'none'
    }
  }

  if (planName.value === 'SVIP' || planName.value === 'ENTERPRISE') {
    return {
      tier: 'svip' as const,
      badgeText: 'SVIP',
      badgeIcon: '👑',
      ringGradient: 'conic-gradient(from 0deg, #fbbf24, #f59e0b, #d97706, #b45309, #d97706, #f59e0b, #fbbf24, #fcd34d, #fbbf24)',
      ringShadow: '0 0 20px rgba(245, 158, 11, 0.6), 0 0 40px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(251, 191, 36, 0.1)',
      badgeGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 40%, #d97706 100%)',
      badgeShadow: 'rgba(217, 119, 6, 0.5)',
      animatedRing: true,
      ringStyle: 'svip-ring',
      glow: 'svip-glow',
      particleColor: 'rgba(251, 191, 36, 0.9)',
      hoverGlow: '0 0 28px rgba(245, 158, 11, 0.8), 0 0 56px rgba(245, 158, 11, 0.3)'
    }
  }

  if (planName.value === 'VIP' || planName.value === 'PRO') {
    return {
      tier: 'vip' as const,
      badgeText: 'VIP',
      badgeIcon: '💎',
      ringGradient: 'conic-gradient(from 0deg, #a78bfa, #8b5cf6, #7c3aed, #6d28d9, #7c3aed, #8b5cf6, #a78bfa, #c4b5fd, #a78bfa)',
      ringShadow: '0 0 16px rgba(109, 40, 217, 0.5), 0 0 32px rgba(109, 40, 217, 0.15)',
      badgeGradient: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 40%, #6d28d9 100%)',
      badgeShadow: 'rgba(109, 40, 217, 0.5)',
      animatedRing: true,
      ringStyle: 'vip-ring',
      glow: 'vip-glow',
      particleColor: 'rgba(139, 92, 246, 0.8)',
      hoverGlow: '0 0 24px rgba(109, 40, 217, 0.7), 0 0 48px rgba(109, 40, 217, 0.25)'
    }
  }

  return {
    tier: 'free' as const,
    badgeText: '',
    badgeIcon: '',
    ringGradient: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)',
    ringShadow: '0 0 4px rgba(148, 163, 184, 0.15)',
    badgeGradient: '',
    badgeShadow: '',
    animatedRing: false,
    ringStyle: 'free-ring',
    glow: '',
    particleColor: '',
    hoverGlow: '0 0 8px rgba(148, 163, 184, 0.2)'
  }
})

const showBadge = computed(() => frameConfig.value.badgeText !== '')
const size = computed(() => sizeConfig[props.size || 'md'])
</script>

<template>
  <div class="relative inline-flex shrink-0 group/avatar">
    <div
      :class="[
        size.container,
        'relative overflow-hidden flex items-center justify-center rounded-2xl transition-all duration-500',
        frameConfig.animatedRing ? size.ring : 'p-[2px]',
        size?.glow,
        frameConfig.glow
      ]"
      :style="{
        background: frameConfig.ringGradient,
        backgroundSize: frameConfig.animatedRing ? '200% 200%' : '100% 100%',
        boxShadow: frameConfig.ringShadow
      }"
    >
      <div class="w-full h-full rounded-[inherit] overflow-hidden bg-[var(--bg-card)]">
        <img
          v-if="user?.avatarUrl && !imageError"
          :src="user.avatarUrl"
          class="w-full h-full object-cover transition-transform duration-700 group-hover/avatar:scale-110"
          :alt="user.name"
          @error="handleImageError"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
          <User :class="size.icon" />
        </div>
      </div>

      <div
        v-if="frameConfig.animatedRing"
        class="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none"
      >
        <div :class="['ring-shimmer', frameConfig.ringStyle]"></div>
        <div :class="['ring-shimmer-2', frameConfig.ringStyle]"></div>
      </div>

      <div
        v-if="size.particles && frameConfig.animatedRing"
        class="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none"
      >
        <div :class="['particles-container', frameConfig.ringStyle]">
          <span class="particle particle-1" :style="{ background: frameConfig.particleColor }"></span>
          <span class="particle particle-2" :style="{ background: frameConfig.particleColor }"></span>
          <span class="particle particle-3" :style="{ background: frameConfig.particleColor }"></span>
          <span class="particle particle-4" :style="{ background: frameConfig.particleColor }"></span>
          <span class="particle particle-5" :style="{ background: frameConfig.particleColor }"></span>
          <span class="particle particle-6" :style="{ background: frameConfig.particleColor }"></span>
        </div>
      </div>
    </div>

    <div
      v-if="size.crown && frameConfig.tier === 'svip'"
      class="absolute -top-3 left-1/2 -translate-x-1/2 z-20 text-sm pointer-events-none select-none crown-float"
    >
      👑
    </div>

    <div
      v-if="showBadge"
      :class="[
        size.badge,
        'absolute -bottom-1 -right-1 rounded-full flex items-center justify-center z-10 font-black tracking-tighter uppercase',
        'backdrop-blur-md border border-white/30 shadow-2xl animate-badge-float text-white badge-3d'
      ]"
      :style="{
        background: frameConfig.badgeGradient,
        boxShadow: `0 4px 14px ${frameConfig.badgeShadow}, inset 0 1px 0 rgba(255,255,255,0.3)`
      }"
    >
      <span v-if="frameConfig.badgeIcon" class="mr-0.5 text-[0.7em]">{{ frameConfig.badgeIcon }}</span>
      {{ frameConfig.badgeText }}

      <div class="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
        <div class="shimmer"></div>
      </div>
    </div>

    <div
      class="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500 opacity-0 group-hover/avatar:opacity-100"
      :style="{ boxShadow: frameConfig.hoverGlow }"
    ></div>
  </div>
</template>

<style scoped>
@keyframes badge-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-2px) scale(1.05); }
}

.animate-badge-float {
  animation: badge-float 3s ease-in-out infinite;
}

.badge-3d {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  border-top-color: rgba(255, 255, 255, 0.4) !important;
  border-bottom-color: rgba(0, 0, 0, 0.1) !important;
}

.shimmer {
  position: absolute;
  top: -100%;
  left: -100%;
  width: 300%;
  height: 300%;
  background: linear-gradient(
    45deg,
    transparent 0%,
    transparent 35%,
    rgba(255, 255, 255, 0.5) 50%,
    transparent 65%,
    transparent 100%
  );
  animation: shimmer 3s infinite linear;
}

@keyframes shimmer {
  0% { transform: translate(-30%, -30%); }
  100% { transform: translate(30%, 30%); }
}

@keyframes ring-rotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.free-ring {
  animation: free-breathe 4s ease-in-out infinite;
}

@keyframes free-breathe {
  0%, 100% {
    box-shadow: 0 0 4px rgba(148, 163, 184, 0.15);
    filter: brightness(1);
  }
  50% {
    box-shadow: 0 0 8px rgba(148, 163, 184, 0.25);
    filter: brightness(1.02);
  }
}

.vip-ring {
  animation: ring-rotate 4s ease infinite;
}

.svip-ring {
  animation: ring-rotate 3s ease infinite;
}

.admin-ring {
  animation: ring-rotate 2.5s ease infinite;
}

.ring-shimmer {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    rgba(255, 255, 255, 0.2) 8%,
    transparent 16%
  );
  animation: ring-spin 4s linear infinite;
}

.ring-shimmer-2 {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    from 180deg,
    transparent 0%,
    rgba(255, 255, 255, 0.12) 6%,
    transparent 12%
  );
  animation: ring-spin 6s linear infinite reverse;
}

@keyframes ring-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes glow-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.1); }
}

.avatar-glow {
  animation: glow-pulse 3s ease-in-out infinite;
}

.vip-glow {
  animation: vip-glow-pulse 3s ease-in-out infinite;
}

@keyframes vip-glow-pulse {
  0%, 100% {
    filter: brightness(1) drop-shadow(0 0 4px rgba(139, 92, 246, 0.3));
  }
  50% {
    filter: brightness(1.08) drop-shadow(0 0 10px rgba(139, 92, 246, 0.5));
  }
}

.svip-glow {
  animation: svip-glow-pulse 2.5s ease-in-out infinite;
}

@keyframes svip-glow-pulse {
  0%, 100% {
    filter: brightness(1) drop-shadow(0 0 6px rgba(251, 191, 36, 0.3));
  }
  50% {
    filter: brightness(1.12) drop-shadow(0 0 14px rgba(251, 191, 36, 0.6));
  }
}

.admin-glow {
  animation: admin-glow-pulse 2s ease-in-out infinite;
}

@keyframes admin-glow-pulse {
  0%, 100% {
    filter: brightness(1) drop-shadow(0 0 4px rgba(244, 63, 94, 0.3));
  }
  50% {
    filter: brightness(1.1) drop-shadow(0 0 12px rgba(244, 63, 94, 0.6));
  }
}

.particles-container {
  position: absolute;
  inset: 0;
}

.particle {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  opacity: 0;
  animation: particle-drift 4s ease-in-out infinite;
}

.svip-ring .particle {
  width: 4px;
  height: 4px;
  box-shadow: 0 0 4px currentColor;
}

.particle-1 { top: 5%; left: 50%; animation-delay: 0s; }
.particle-2 { top: 50%; right: 5%; animation-delay: 0.7s; }
.particle-3 { bottom: 5%; left: 50%; animation-delay: 1.4s; }
.particle-4 { top: 50%; left: 5%; animation-delay: 2.1s; }
.particle-5 { top: 15%; right: 15%; animation-delay: 2.8s; }
.particle-6 { bottom: 15%; left: 15%; animation-delay: 3.5s; }

@keyframes particle-drift {
  0% {
    opacity: 0;
    transform: scale(0) translateY(0);
  }
  20% {
    opacity: 1;
    transform: scale(1) translateY(-4px);
  }
  80% {
    opacity: 0.6;
    transform: scale(0.8) translateY(-8px);
  }
  100% {
    opacity: 0;
    transform: scale(0) translateY(-12px);
  }
}

.crown-float {
  animation: crown-bounce 2.5s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(251, 191, 36, 0.5));
}

@keyframes crown-bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-3px); }
}
</style>
