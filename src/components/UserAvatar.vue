<script setup lang="ts">
import { computed, ref } from 'vue';
import { User } from 'lucide-vue-next';

const props = defineProps<{
  user?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
    subscription?: {
      plan: {
        name: string;
        displayName?: string;
        badgeColor?: string;
      };
      status?: string;
      interval?: string;
    };
  } | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}>();

const imageError = ref(false);

const handleImageError = () => {
  imageError.value = true;
};

const sizeConfig = {
  xs: {
    container: 'w-5 h-5',
    text: 'text-[8px]',
    badge: 'px-0.5 py-0.5 text-[5px]',
    icon: 'w-2.5 h-2.5',
    crown: false,
  },
  sm: {
    container: 'w-6 h-6',
    text: 'text-[10px]',
    badge: 'px-1 py-0.5 text-[6px]',
    icon: 'w-3 h-3',
    crown: false,
  },
  md: {
    container: 'w-10 h-10',
    text: 'text-xs',
    badge: 'px-1.5 py-0.5 text-[7px]',
    icon: 'w-4 h-4',
    crown: false,
  },
  lg: {
    container: 'w-14 h-14',
    text: 'text-sm',
    badge: 'px-2 py-0.5 text-[9px]',
    icon: 'w-5 h-5',
    crown: false,
  },
  xl: {
    container: 'w-24 h-24',
    text: 'text-2xl',
    badge: 'px-3 py-1 text-[11px]',
    icon: 'w-10 h-10',
    crown: true,
  },
};

const planName = computed(() => props.user?.subscription?.plan?.name || 'FREE');
const isAdmin = computed(() => props.user?.role === 'ADMIN');
const isActiveSubscription = computed(() => props.user?.subscription?.status === 'ACTIVE');

const frameConfig = computed(() => {
  if (isAdmin.value) {
    return {
      tier: 'admin' as const,
      badgeText: '管理员',
      badgeIcon: '',
      color: '#ff2d55', // Vibrant neon pink/red from image
      borderWidth: '2px',
      glowIntensity: 1,
      animation: 'admin-breathe',
      hasShimmer: true,
      innerBorder: 'rgba(0,0,0,0.8)',
    };
  }

  if (!isActiveSubscription.value && planName.value !== 'FREE') {
    return {
      tier: 'expired' as const,
      badgeText: '已过期',
      badgeIcon: '',
      color: '#94a3b8',
      borderWidth: '1.5px',
      glowIntensity: 0,
      animation: 'none',
      hasShimmer: false,
      innerBorder: 'transparent',
    };
  }

  if (planName.value === 'SVIP' || planName.value === 'ENTERPRISE') {
    return {
      tier: 'svip' as const,
      badgeText: '超级会员',
      badgeIcon: '',
      color: '#fbbf24',
      borderWidth: '2px',
      glowIntensity: 0.8,
      animation: 'svip-breathe',
      hasShimmer: true,
      innerBorder: 'rgba(0,0,0,0.6)',
    };
  }

  if (planName.value === 'VIP' || planName.value === 'PRO') {
    return {
      tier: 'vip' as const,
      badgeText: '会员',
      badgeIcon: '',
      color: '#8b5cf6',
      borderWidth: '1.5px',
      glowIntensity: 0.6,
      animation: 'vip-breathe',
      hasShimmer: true,
      innerBorder: 'rgba(0,0,0,0.4)',
    };
  }

  return {
    tier: 'free' as const,
    badgeText: '',
    badgeIcon: '',
    color: 'rgba(148, 163, 184, 0.2)',
    borderWidth: '1px',
    glowIntensity: 0,
    animation: 'none',
    hasShimmer: false,
    innerBorder: 'transparent',
  };
});

const showBadge = computed(
  () => frameConfig.value.badgeText !== '' || frameConfig.value.badgeIcon !== '',
);
const size = computed(() => sizeConfig[props.size as keyof typeof sizeConfig] || sizeConfig.md);

const initials = computed(() => {
  const name = props.user?.name || props.user?.email || '';
  if (!name) return '';
  return name.charAt(0).toUpperCase();
});

const fallbackBgColor = computed(() => {
  const name = props.user?.name || props.user?.email || '?';
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-amber-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-cyan-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
});
</script>

<template>
  <div class="relative inline-flex shrink-0 group/avatar">
    <!-- Outer Glow & Neon Frame -->
    <div
      :class="[
        size.container,
        'relative rounded-[1.25rem] transition-all duration-500 flex items-center justify-center',
        frameConfig.animation !== 'none' ? 'animate-frame-glow' : '',
      ]"
      :style="{
        backgroundColor: frameConfig.innerBorder,
        boxShadow: `0 0 ${15 * frameConfig.glowIntensity}px ${frameConfig.color}${Math.round(
          frameConfig.glowIntensity * 255,
        )
          .toString(16)
          .padStart(2, '0')}`,
        padding: frameConfig.borderWidth,
        backgroundClip: 'content-box',
        border: `${frameConfig.borderWidth} solid ${frameConfig.color}`,
      }"
    >
      <!-- Inner Dark Border Container -->
      <div
        class="w-full h-full rounded-[1rem] overflow-hidden flex items-center justify-center p-[2px]"
        :style="{ backgroundColor: frameConfig.innerBorder }"
      >
        <div
          class="w-full h-full rounded-[inherit] overflow-hidden bg-[var(--bg-card)] relative z-10"
        >
          <img
            v-if="user?.avatarUrl && !imageError"
            :src="user.avatarUrl"
            class="w-full h-full object-cover transition-transform duration-700 group-hover/avatar:scale-110"
            :alt="user.name"
            @error="handleImageError"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-white font-bold"
            :class="[size.text, fallbackBgColor]"
          >
            <span v-if="initials">{{ initials }}</span>
            <User v-else :class="size.icon" />
          </div>
        </div>
      </div>

      <!-- Minimalist Shimmer -->
      <div
        v-if="frameConfig.hasShimmer"
        class="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none z-20"
      >
        <div class="minimal-shimmer"></div>
      </div>
    </div>

    <!-- Tier Crown -->
    <div
      v-if="size.crown && frameConfig.tier === 'svip'"
      class="absolute -top-3 left-1/2 -translate-x-1/2 z-30 text-sm pointer-events-none select-none crown-float"
    >
      👑
    </div>

    <!-- Pill-shaped Level Badge -->
    <div
      v-if="showBadge"
      :class="[
        size.badge,
        'absolute -bottom-1 -right-2 rounded-xl flex items-center justify-center z-30 font-black px-2',
        'backdrop-blur-md shadow-lg text-white border border-white/20',
      ]"
      :style="{
        background: frameConfig.tier === 'expired' ? '#64748b' : frameConfig.color,
        minWidth: '28px',
      }"
    >
      <span v-if="frameConfig.badgeIcon" class="text-[0.9em]">{{ frameConfig.badgeIcon }}</span>
      <span
        v-if="frameConfig.badgeText"
        class="uppercase tracking-tight text-[7.5px] whitespace-nowrap"
        >{{ frameConfig.badgeText }}</span
      >
    </div>

    <!-- Hover Effect Enhancement -->
    <div
      class="absolute inset-[-6px] rounded-[2.5rem] pointer-events-none transition-all duration-500 opacity-0 group-hover/avatar:opacity-100 blur-2xl"
      :style="{ backgroundColor: frameConfig.color, opacity: '0.2' }"
    ></div>
  </div>
</template>

<style scoped>
@keyframes frame-glow {
  0%,
  100% {
    opacity: 0.9;
    filter: brightness(1);
  }
  50% {
    opacity: 1;
    filter: brightness(1.2);
  }
}

.animate-frame-glow {
  animation: frame-glow 2s ease-in-out infinite;
}

.minimal-shimmer {
  position: absolute;
  top: 0;
  left: -150%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: skewX(-20deg);
  animation: shimmer-swipe 4s infinite linear;
}

@keyframes shimmer-swipe {
  0% {
    left: -150%;
  }
  30% {
    left: 150%;
  }
  100% {
    left: 150%;
  }
}

.crown-float {
  animation: crown-bounce 3s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

@keyframes crown-bounce {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-4px);
  }
}
</style>

<style scoped>
@keyframes frame-breathe {
  0%,
  100% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

.animate-frame-breathe {
  animation: frame-breathe 3s ease-in-out infinite;
}

.minimal-shimmer {
  position: absolute;
  top: 0;
  left: -150%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: skewX(-20deg);
  animation: shimmer-swipe 4s infinite linear;
}

@keyframes shimmer-swipe {
  0% {
    left: -150%;
  }
  30% {
    left: 150%;
  }
  100% {
    left: 150%;
  }
}

.crown-float {
  animation: crown-bounce 3s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

@keyframes crown-bounce {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-4px);
  }
}
</style>
