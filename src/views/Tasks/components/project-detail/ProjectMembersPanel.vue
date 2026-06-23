<script setup lang="ts">
import { Plus, Users } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import UserAvatar from '@/components/UserAvatar.vue';
import Button from '@/components/ui/Button.vue';
import type { ProjectMember, ProjectInvitation } from './types';

const { t } = useI18n();

interface Props {
  members: ProjectMember[];
  invitations?: ProjectInvitation[];
  isOwner: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'invite'): void;
}>();
</script>

<template>
  <div class="space-y-2.5">
    <div class="flex items-center justify-between">
      <h4
        class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"
      >
        <Users class="w-3.5 h-3.5" /> {{ t('projects.members') }} ({{ members.length }})
      </h4>
      <Button
        v-if="isOwner"
        variant="secondary"
        size="sm"
        :icon="Plus"
        class="!py-0.5 !px-2 !h-6 !text-[10px]"
        @click="emit('invite')"
      >
        {{ t('projects.invite') }}
      </Button>
    </div>
    <div class="flex flex-wrap gap-1.5">
      <div
        v-for="m in members"
        :key="m.userId"
        class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
      >
        <UserAvatar :user="m.user" size="xs" />
        <span class="text-[11px] font-bold" style="color: var(--text-primary)">{{
          m.user.name || m.user.email
        }}</span>
        <span
          class="text-[7px] px-1 py-0.1 bg-slate-200 dark:bg-slate-700 text-slate-400 rounded uppercase font-black tracking-wider"
          >{{ m.role }}</span
        >
      </div>
    </div>

    <div v-if="invitations && invitations.length > 0" class="pt-1.5 space-y-1.5 text-left">
      <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">
        {{ t('projects.sentInvitationsPending') }}
      </div>
      <div class="flex flex-wrap gap-1.5">
        <div
          v-for="inv in invitations"
          :key="inv.id"
          class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/40 border border-dashed rounded-lg"
          style="border-color: var(--border-base)"
        >
          <UserAvatar :user="inv.invitee" size="xs" />
          <span class="text-[11px] font-bold text-slate-400">{{
            inv.invitee.name || inv.invitee.email
          }}</span>
          <span
            class="text-[7px] px-1 py-0.1 bg-amber-500/10 text-amber-500 rounded uppercase font-black tracking-wider"
            >PENDING</span
          >
        </div>
      </div>
    </div>
  </div>
</template>
