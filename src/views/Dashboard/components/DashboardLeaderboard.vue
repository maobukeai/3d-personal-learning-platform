<script setup lang="ts">
import { Trophy } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import type { LeaderboardMember } from '../types';

defineProps<{
  leaderboardTop: LeaderboardMember[];
}>();

function formatNumber(value: number | string | undefined) {
  if (value === undefined) return '0';
  const numericValue =
    typeof value === 'number'
      ? value
      : Number.parseFloat(value.replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numericValue) ? numericValue.toLocaleString('zh-CN') : '0';
}
</script>

<template>
  <Card hoverable glow class="leader-card h-full" padding="none">
    <div class="dashboard-panel-header">
      <div>
        <h3>社区积分榜</h3>
        <p>TOP {{ leaderboardTop.length }}</p>
      </div>
      <Trophy class="h-4.5 w-4.5 text-amber-500 shrink-0" />
    </div>

    <div class="flex flex-col min-h-0 flex-1">
      <div v-if="leaderboardTop.length" class="dashboard-panel-list flex-1">
        <div v-for="member in leaderboardTop" :key="member.id" class="leader-row">
          <Badge
            :variant="member.rank <= 3 ? 'warning' : 'primary'"
            :outline="member.rank > 3"
            class="!w-[22px] !h-[22px] !p-0 !inline-flex !items-center !justify-center !rounded-full shrink-0"
          >
            {{ member.rank }}
          </Badge>
          <UserAvatar :user="{ name: member.name, avatarUrl: member.avatarUrl }" size="xs" />
          <span class="leader-name">{{ member.name }}</span>
          <strong class="text-xs font-extrabold text-accent">{{
            formatNumber(member.score ?? member.points ?? 0)
          }}</strong>
        </div>
      </div>
      <div v-else class="dashboard-panel-empty">
        <Trophy class="h-5 w-5 opacity-40" />
        <span>暂无排行</span>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.leader-card {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.leader-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.leader-row:hover {
  background-color: var(--bg-hover);
}

.leader-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}

.leader-row strong {
  margin-left: auto;
}
</style>
