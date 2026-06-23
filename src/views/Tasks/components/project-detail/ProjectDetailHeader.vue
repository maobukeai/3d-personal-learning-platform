<script setup lang="ts">
import { Plus, FolderOpen } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import Button from '@/components/ui/Button.vue';
import type { ProjectDetail } from './types';

const { t } = useI18n();

interface Props {
  project: ProjectDetail;
  isMember: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'join-project'): void;
  (e: 'view-in-board', projectId: string): void;
}>();
</script>

<template>
  <div class="flex items-center justify-between w-full pr-6">
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-black shadow-md shrink-0"
        :class="project.color"
      >
        {{ project.title?.substring(0, 1) }}
      </div>
      <div class="text-left">
        <h3 class="text-lg font-black tracking-tight" style="color: var(--text-primary)">
          {{ project.title }}
        </h3>
        <p class="text-[10px] font-bold text-slate-400">{{ t('projects.detailSubtitle') }}</p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <Button
        v-if="!isMember && project.visibility === 'PUBLIC'"
        variant="primary"
        size="sm"
        :icon="Plus"
        class="!bg-emerald-500 hover:!bg-emerald-600 !text-white !border-transparent !h-8 !text-xs"
        @click="emit('join-project')"
      >
        {{ t('projects.joinProject') }}
      </Button>

      <Button
        variant="secondary"
        size="sm"
        :icon="FolderOpen"
        class="!h-8 !text-xs"
        @click="emit('view-in-board', project.id)"
      >
        {{ t('projects.viewInBoard') }}
      </Button>
    </div>
  </div>
</template>
