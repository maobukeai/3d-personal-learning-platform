<script setup lang="ts">
import { computed } from 'vue';
import { Star, ArrowRight, X, Users, Award, Zap, Compass } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import type { TeamMember } from '@/types';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import { TEAM_CORE_VALUES_SEPARATOR } from '@/utils/team';

interface GroupDetailTeam {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  image?: string | null;
  category?: string | null;
  rating?: string | number | null;
  members?: number | TeamMember[];
  _count?: {
    members?: number;
  };
}

const props = defineProps<{
  visible: boolean;
  group: GroupDetailTeam | null;
}>();

const emit = defineEmits(['update:visible', 'join']);

const handleClose = () => {
  emit('update:visible', false);
};

const handleJoin = () => {
  if (props.group) {
    emit('join', props.group.name);
  }
};

const displayMembers = computed(() => {
  return Array.isArray(props.group?.members) ? props.group.members : [];
});

const parsedData = computed(() => {
  const desc = props.group?.description || '';
  const parts = desc.split(TEAM_CORE_VALUES_SEPARATOR);
  if (parts.length > 1) {
    try {
      const parsedValues = JSON.parse(parts[1]);
      return {
        description: parts[0],
        customValues: parsedValues.values || [],
      };
    } catch {
      // Fallback on JSON parse error
    }
  }
  return {
    description: desc,
    customValues: null,
  };
});

const defaultCoreValues = [
  {
    title: '技术共享',
    desc: '从基础几何体到复杂着色器与实时动画，汇聚前沿 3D 渲染与WebGL技术方案。',
    icon: Zap,
    colorClass:
      'bg-amber-500/10 text-amber-500 dark:text-amber-400 group-hover/val:bg-amber-500 group-hover/val:text-white',
    hoverClass:
      'hover:border-amber-500/30 hover:shadow-[0_0_15px_rgba(245,158,11,0.08)] hover:bg-amber-500/[0.02]',
  },
  {
    title: '协同创作',
    desc: '联合不同背景的创作者，在云端工作流中共同迭代 3D 交互场景与产品级案例。',
    icon: Compass,
    colorClass:
      'bg-blue-500/10 text-blue-500 dark:text-blue-400 group-hover/val:bg-blue-500 group-hover/val:text-white',
    hoverClass:
      'hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(59,130,246,0.08)] hover:bg-blue-500/[0.02]',
  },
  {
    title: '共同成长',
    desc: '通过每周命题挑战赛与同行评议机制，全方位锤炼 3D 艺术品味与技术深度。',
    icon: Award,
    colorClass:
      'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 group-hover/val:bg-emerald-500 group-hover/val:text-white',
    hoverClass:
      'hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.08)] hover:bg-emerald-500/[0.02]',
  },
];

const coreValues = computed(() => {
  if (parsedData.value.customValues && parsedData.value.customValues.length > 0) {
    const icons = [Zap, Compass, Award];
    const colors = [
      'bg-amber-500/10 text-amber-500 dark:text-amber-400 group-hover/val:bg-amber-500 group-hover/val:text-white',
      'bg-blue-500/10 text-blue-500 dark:text-blue-400 group-hover/val:bg-blue-500 group-hover/val:text-white',
      'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 group-hover/val:bg-emerald-500 group-hover/val:text-white',
    ];
    const hovers = [
      'hover:border-amber-500/30 hover:shadow-[0_0_15px_rgba(245,158,11,0.08)] hover:bg-amber-500/[0.02]',
      'hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(59,130,246,0.08)] hover:bg-blue-500/[0.02]',
      'hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.08)] hover:bg-emerald-500/[0.02]',
    ];
    return parsedData.value.customValues.map((v: any, index: number) => ({
      title: v.title,
      desc: v.desc,
      icon: icons[index % icons.length],
      colorClass: colors[index % colors.length],
      hoverClass: hovers[index % hovers.length],
    }));
  }
  return defaultCoreValues;
});

const memberCount = computed(() => {
  if (props.group?._count?.members !== undefined) return props.group._count.members;
  if (Array.isArray(props.group?.members)) return props.group.members.length;
  if (typeof props.group?.members === 'number') return props.group.members;
  return 1;
});
</script>

<template>
  <Modal :show="props.visible" size="xl" padding="none" @close="handleClose">
    <div v-if="props.group" class="relative group/panel overflow-hidden rounded-2xl outline-none">
      <!-- Custom Close Button -->
      <Button
        variant="glass"
        class="!absolute top-4 right-4 !z-50 !w-8 !h-8 !p-0 !rounded-full bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-white flex items-center justify-center shrink-0 hover:rotate-90 transition-all duration-500 shadow-md"
        @click="handleClose"
      >
        <X class="w-4 h-4" />
      </Button>

      <div class="flex flex-col md:flex-row md:h-[580px] max-h-[85vh] overflow-hidden">
        <!-- Left: Image & Quick Stats (Gradient and Visual Sidebar) -->
        <div class="h-56 md:h-auto md:w-[48%] relative shrink-0 overflow-hidden bg-slate-900">
          <img
            :src="
              props.group.avatarUrl ||
              props.group.image ||
              `https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=500&q=80`
            "
            class="w-full h-full object-cover scale-100 group-hover/panel:scale-105 transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] filter brightness-[0.88]"
            :alt="props.group.name"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"
          ></div>

          <div
            class="absolute bottom-6 left-6 right-6 md:bottom-8 md:left-8 md:right-8 text-white select-none"
          >
            <span
              class="px-2.5 py-0.5 rounded-md bg-accent text-[9px] font-black uppercase tracking-widest shadow-sm border border-white/15 backdrop-blur-md"
            >
              {{ props.group.category || '公开小组' }}
            </span>
            <h2
              class="text-xl md:text-2xl font-black mt-2.5 leading-snug tracking-tight drop-shadow-md"
            >
              {{ props.group.name }}
            </h2>

            <!-- Glassmorphic Stats Panel -->
            <div
              class="mt-4 md:mt-5 p-3 rounded-xl bg-white/5 dark:bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-around"
            >
              <div class="flex flex-col items-center">
                <span class="text-[9px] font-bold text-white/50 uppercase tracking-widest"
                  >成员</span
                >
                <span class="text-sm md:text-base font-black mt-0.5">{{ memberCount }}</span>
              </div>
              <div class="w-px h-8 bg-white/10"></div>
              <div class="flex flex-col items-center">
                <span class="text-[9px] font-bold text-white/50 uppercase tracking-widest"
                  >评分</span
                >
                <div class="flex items-center gap-1 mt-0.5">
                  <Star class="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span class="text-sm md:text-base font-black">{{
                    props.group.rating || '5.0'
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Detailed Content -->
        <div
          class="flex-1 p-5 md:p-8 overflow-y-auto scrollbar-hide flex flex-col bg-white dark:bg-slate-900"
        >
          <div class="space-y-5 flex-1 pb-4">
            <!-- About Section -->
            <section class="animate-fade-in" style="animation-delay: 50ms">
              <div class="flex items-center gap-2 mb-2 md:mb-3">
                <div
                  class="w-1 h-3 bg-gradient-to-b from-accent to-accent-dark rounded-full shadow-xs shadow-accent"
                ></div>
                <h3
                  class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none"
                >
                  关于小组
                </h3>
              </div>
              <p
                class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-3 border-l-2 border-slate-100 dark:border-slate-800"
              >
                {{
                  parsedData.description ||
                  '这是一个充满活力的学习社区，我们不仅分享最前沿的 3D 技术，更注重通过实战项目提升每位成员的创作能力。加入我们，与全球优秀的创作者共同进步。'
                }}
              </p>
            </section>

            <!-- Core Values Section -->
            <section class="animate-fade-in" style="animation-delay: 150ms">
              <div class="flex items-center gap-2 mb-3">
                <div
                  class="w-1 h-3 bg-gradient-to-b from-accent to-accent-dark rounded-full shadow-xs shadow-accent"
                ></div>
                <h3
                  class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none"
                >
                  核心价值
                </h3>
              </div>
              <div class="grid grid-cols-1 gap-2.5">
                <div
                  v-for="(val, i) in coreValues"
                  :key="i"
                  class="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/10 border border-slate-100/50 dark:border-slate-800/40 hover:-translate-y-0.5 transition-all duration-300 group/val"
                  :class="val.hoverClass"
                >
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 shadow-xs"
                    :class="val.colorClass"
                  >
                    <component
                      :is="val.icon"
                      class="w-4 h-4 transition-transform duration-300 group-hover/val:scale-110"
                    />
                  </div>
                  <div>
                    <h4
                      class="font-black text-slate-800 dark:text-slate-200 text-xs group-hover/val:text-accent transition-colors duration-300"
                    >
                      {{ val.title }}
                    </h4>
                    <p
                      class="text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5"
                    >
                      {{ val.desc }}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <!-- Active Members Section -->
            <section class="animate-fade-in" style="animation-delay: 250ms">
              <div class="flex items-center gap-2 mb-3">
                <div
                  class="w-1 h-3 bg-gradient-to-b from-accent to-accent-dark rounded-full shadow-xs shadow-accent"
                ></div>
                <h3
                  class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none"
                >
                  活跃成员
                </h3>
              </div>
              <div
                class="flex items-center gap-3 bg-slate-50/30 dark:bg-slate-800/5 p-2 rounded-xl border border-slate-100/30 dark:border-slate-800/20"
              >
                <div class="flex -space-x-2.5 pl-1">
                  <template v-if="displayMembers.length">
                    <UserAvatar
                      v-for="member in displayMembers"
                      :key="member.id"
                      :user="member.user"
                      size="xs"
                      class="ring-2 ring-white dark:ring-slate-900 hover:scale-110 hover:z-25 transition-transform duration-300 cursor-pointer"
                      :title="member.user?.name || member.user?.email || '小组成员'"
                    />
                  </template>
                  <div
                    v-else
                    class="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-xs"
                  >
                    <Users class="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
                <span class="text-[10px] font-black text-slate-500 dark:text-slate-400">
                  {{ memberCount }} 位团队成员已加入
                </span>
              </div>
            </section>
          </div>

          <!-- Sticky Footer Action -->
          <div
            class="pt-4 flex items-center justify-between mt-auto bg-white dark:bg-slate-900 outline-none"
            style="
              border-top: 1px solid var(--border-base) !important;
              border-left: none !important;
              border-right: none !important;
              border-bottom: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              outline: none !important;
            "
          >
            <div
              class="flex items-center gap-3 bg-slate-50/30 dark:bg-slate-800/5 p-2 px-3 rounded-xl border border-slate-100/30 dark:border-slate-800/20 outline-none"
            >
              <span
                class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest"
                >加入要求</span
              >
              <Badge variant="success" dot>免审通道</Badge>
            </div>
            <Button
              variant="primary"
              :icon="ArrowRight"
              icon-position="right"
              class="relative overflow-hidden !px-6 !py-2.5 !rounded-xl font-black text-xs hover:scale-102 hover:-translate-y-0.5 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/35 transition-all duration-300 shrink-0 !bg-gradient-to-r !from-accent !to-accent-dark border-none text-white hover:brightness-105 group/btn"
              @click="handleJoin"
            >
              申请加入
              <span
                class="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-[100%] group-hover/btn:animate-shimmer-sweep pointer-events-none"
              ></span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(8px);
}

@keyframes fadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shimmer-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.group-hover\/btn\:animate-shimmer-sweep {
  animation: shimmer-sweep 1s ease-in-out;
}
</style>
