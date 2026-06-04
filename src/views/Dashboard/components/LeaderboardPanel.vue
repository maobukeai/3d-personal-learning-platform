<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Trophy, Medal, ChevronRight } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';

const router = useRouter();

interface LeaderboardEntry {
  id: string;
  name: string;
  avatarUrl?: string | null;
  score: number;
  rank: number;
}

const leaderboard = ref<LeaderboardEntry[]>([]);

const fetchLeaderboard = async () => {
  try {
    // Use public teams or any public endpoint; fallback to placeholder data
    const res = await api.get('/api/auth/leaderboard').catch(() => null);
    if (res?.data && Array.isArray(res.data)) {
      leaderboard.value = res.data.slice(0, 5);
    } else {
      // Placeholder data for demo purposes
      leaderboard.value = [
        { id: '1', name: '张三丰', score: 9840, rank: 1 },
        { id: '2', name: '李梦阳', score: 8720, rank: 2 },
        { id: '3', name: '王晓明', score: 7650, rank: 3 },
        { id: '4', name: '陈小云', score: 6430, rank: 4 },
        { id: '5', name: '刘思远', score: 5210, rank: 5 },
      ];
    }
  } catch {
    leaderboard.value = [];
  }
};

const rankMedal = (rank: number) => {
  if (rank === 1) return { icon: Trophy, class: 'rank-gold' };
  if (rank === 2) return { icon: Medal, class: 'rank-silver' };
  if (rank === 3) return { icon: Medal, class: 'rank-bronze' };
  return null;
};

onMounted(fetchLeaderboard);
</script>

<template>
  <div class="blender-card overflow-hidden">
    <div class="p-4 sm:p-5 border-b flex items-center justify-between" style="border-color: var(--border-base)">
      <div class="flex items-center gap-2">
        <Trophy class="w-4 h-4 text-yellow-500" />
        <h3 class="font-bold text-sm" style="color: var(--text-primary)">创作排行榜</h3>
      </div>
      <button
        type="button"
        class="flex items-center gap-1 text-xs font-bold text-accent hover:underline cursor-pointer transition-colors"
        @click="router.push('/community')"
      >
        查看全部 <ChevronRight class="w-3 h-3" />
      </button>
    </div>

    <div class="divide-y" style="border-color: var(--border-base)">
      <div
        v-for="entry in leaderboard"
        :key="entry.id"
        class="leaderboard-item flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors"
      >
        <!-- Rank -->
        <div class="w-7 flex items-center justify-center shrink-0">
          <component
            v-if="rankMedal(entry.rank)"
            :is="rankMedal(entry.rank)!.icon"
            class="w-4 h-4"
            :class="rankMedal(entry.rank)!.class"
          />
          <span v-else class="text-xs font-bold" style="color: var(--text-muted)">{{ entry.rank }}</span>
        </div>

        <!-- Avatar -->
        <UserAvatar :user="entry" size="sm" class="shrink-0" />

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold truncate" style="color: var(--text-primary)">{{ entry.name }}</p>
        </div>

        <!-- Score -->
        <span class="text-xs font-black tabular-nums" style="color: var(--text-primary)">
          {{ entry.score.toLocaleString() }}
          <span class="text-[9px] font-normal ml-0.5" style="color: var(--text-muted)">pts</span>
        </span>
      </div>

      <div v-if="leaderboard.length === 0" class="px-4 sm:px-5 py-8 text-center">
        <Trophy class="w-8 h-8 mx-auto mb-2 opacity-20" style="color: var(--text-muted)" />
        <p class="text-xs font-bold" style="color: var(--text-muted)">排行榜加载中...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leaderboard-item:hover {
  background-color: var(--bg-subtle);
}

.rank-gold { color: #f59e0b; filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.5)); }
.rank-silver { color: #94a3b8; }
.rank-bronze { color: #cd7c54; }
</style>
