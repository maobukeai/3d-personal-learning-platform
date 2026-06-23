<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Sparkles,
  User,
  FolderOpen,
  Download,
  Edit3,
  Trash2,
  Target,
  CircleCheck,
} from 'lucide-vue-next';
import type { Roadmap } from '@/types';

interface RoadmapWithProject extends Roadmap {
  project?: { id: string; teamId: string | null } | null;
}

interface Props {
  roadmap: RoadmapWithProject | null;
  progress: number;
  completedCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  completedCount: 0,
});

const emit = defineEmits<{
  (e: 'enter-project'): void;
  (e: 'export'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
}>();

const { t } = useI18n();

const stepCount = computed(() => props.roadmap?.steps?.length || 0);
</script>

<template>
  <div
    v-if="roadmap"
    class="p-2.5 sm:p-4 rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md relative overflow-hidden"
  >
    <div
      class="absolute -right-10 -top-10 w-36 h-36 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl"
    ></div>
    <div
      class="absolute -left-10 -bottom-10 w-36 h-36 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl"
    ></div>

    <div class="space-y-2 relative z-10">
      <!-- Row 1: Title & Badges on the left, Actions on the right -->
      <div
        class="mobile-row flex items-center justify-between gap-3 border-b border-slate-100/50 dark:border-slate-800 pb-1.5 sm:pb-2"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <h2
            class="text-xs sm:text-base md:text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none truncate"
          >
            {{ roadmap.title }}
          </h2>
          <span
            v-if="roadmap.projectId"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[8px] sm:text-[10px] font-black rounded-full shrink-0"
          >
            <FolderOpen class="w-2.5 h-2.5" /> {{ t('roadmaps.projectRoadmap') }}
          </span>
          <span
            v-else-if="roadmap.creatorId === null"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] sm:text-[10px] font-black rounded-full shrink-0"
          >
            <Sparkles class="w-2 h-2" /> {{ t('roadmaps.officialRecommend') }}
          </span>
          <span
            v-else
            class="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-accent/10 text-accent text-[8px] sm:text-[10px] font-black rounded-full shrink-0"
          >
            <User class="w-2 h-2" /> {{ t('roadmaps.myLearningPlan') }}
          </span>
        </div>

        <!-- Actions inline next to Title! -->
        <div class="flex items-center gap-1 shrink-0">
          <button
            v-if="roadmap.projectId"
            type="button"
            class="p-1 px-1.5 sm:px-2.5 rounded bg-accent hover:opacity-90 text-[8px] sm:text-[11px] font-black text-white transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-accent/10 border-none animate-in fade-in"
            @click="emit('enter-project')"
          >
            <FolderOpen class="w-2.5 h-2.5" />
            <span>{{ t('roadmaps.enterRelatedProject') }}</span>
          </button>
          <button
            type="button"
            class="p-1 px-1.5 sm:px-2 rounded bg-slate-500/5 border border-slate-200/50 dark:border-slate-800 text-[8px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center gap-0.5 cursor-pointer shadow-sm"
            @click="emit('export')"
          >
            <Download class="w-2.5 h-2.5" />
            <span>{{ t('roadmaps.exportAction') }}</span>
          </button>
          <template v-if="roadmap.creatorId !== null">
            <button
              type="button"
              class="p-1 px-1.5 sm:px-2 rounded bg-slate-500/10 hover:bg-slate-500/20 text-[8px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-0.5 cursor-pointer"
              @click="emit('edit')"
            >
              <Edit3 class="w-2.5 h-2.5" />
              <span>{{ t('roadmaps.modify') }}</span>
            </button>
            <button
              type="button"
              class="p-1 px-1.5 sm:px-2 rounded bg-red-500/10 hover:bg-red-500/20 text-[8px] sm:text-[11px] font-bold text-red-600 dark:text-red-400 transition-all flex items-center gap-0.5 cursor-pointer"
              @click="emit('delete')"
            >
              <Trash2 class="w-2.5 h-2.5" />
              <span>{{ t('roadmaps.delete') }}</span>
            </button>
          </template>
        </div>
      </div>

      <!-- Row 2: Description, Metadata & Progress Bar (Always single row!) -->
      <div
        class="mobile-row flex flex-row items-center justify-between gap-3 text-[9px] sm:text-[11px] text-slate-400 dark:text-slate-500"
      >
        <div class="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
          <p class="text-[9px] sm:text-xs text-slate-500 leading-relaxed truncate max-w-xl">
            {{ roadmap.description || t('roadmaps.defaultDesc') }}
          </p>

          <!-- Combined metadata -->
          <div class="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-0.5">
            <span class="hidden xs:flex items-center gap-0.5 font-medium">
              <User class="w-3 h-3 text-slate-400/80 dark:text-slate-500/80" />
              {{
                t('roadmaps.createdBy', {
                  creator:
                    roadmap.creatorId === null
                      ? t('roadmaps.creatorSystem')
                      : t('roadmaps.creatorSelf'),
                })
              }}
            </span>

            <div class="hidden xs:block w-px h-2 bg-slate-200 dark:bg-slate-800"></div>

            <div
              class="flex items-center gap-0.5 shrink-0 font-bold text-slate-600 dark:text-slate-400"
            >
              <Target class="w-3 h-3 text-accent/80" />
              {{ stepCount }}
              <span class="font-normal text-slate-400">{{ t('roadmaps.stageUnit') }}</span>
            </div>

            <div class="w-px h-2 bg-slate-200 dark:bg-slate-800"></div>

            <div
              class="flex items-center gap-0.5 shrink-0 font-bold text-slate-600 dark:text-slate-400"
            >
              <CircleCheck class="w-3 h-3 text-emerald-500/80" />
              {{ completedCount }}
              <span class="font-normal text-slate-400">{{ t('roadmaps.unlocked') }}</span>
            </div>
          </div>
        </div>

        <!-- Progress Bar ALWAYS aligned on the right side of Row 2 -->
        <div class="w-20 sm:w-44 flex items-center gap-1 sm:gap-1.5 shrink-0 self-center">
          <div class="flex-1 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-accent to-emerald-500 rounded-full transition-all duration-700"
              :style="{ width: progress + '%' }"
            ></div>
          </div>
          <span
            class="text-[9px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0"
          >
            {{ progress }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
