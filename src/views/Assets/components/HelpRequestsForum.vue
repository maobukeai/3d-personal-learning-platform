<script setup lang="ts">
import { Plus, RefreshCw } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import Button from '@/components/ui/Button.vue';
import { getAssetUrl } from '@/utils/api';

const label = useLabel();

interface HelpRequest {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  userId: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  _count: { replies: number };
}

defineProps<{
  forumTitle: string;
  forumDesc: string;
  requests: HelpRequest[];
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'open-detail', request: HelpRequest): void;
  (e: 'create-request'): void;
}>();
</script>

<template>
  <div class="flex-1 flex flex-col gap-4 text-left">
    <!-- Header banner -->
    <div
      class="flex justify-between items-center bg-white/[0.01] border border-white/5 p-4 rounded-2xl shrink-0"
    >
      <div>
        <h3 class="text-sm font-bold text-[var(--text-primary)]">
          {{ forumTitle }}
        </h3>
        <p class="text-xs text-[var(--text-muted)] mt-0.5">
          {{ forumDesc }}
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        class="flex items-center gap-1 cursor-pointer"
        @click="emit('create-request')"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>{{ label('发布求助', 'Post Help Request') }}</span>
      </Button>
    </div>

    <!-- List of posts -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <RefreshCw class="w-8 h-8 animate-spin text-indigo-400" />
    </div>
    <div
      v-else-if="requests.length === 0"
      class="text-center py-12 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl font-semibold text-xs text-[var(--text-muted)]"
    >
      {{ label('当前没有求助帖，去发布一个吧！', 'No help requests yet. Post one!') }}
    </div>
    <div v-else class="grid grid-cols-1 gap-3 overflow-y-auto max-h-[70vh] pr-1.5 custom-scrollbar">
      <div
        v-for="req in requests"
        :key="req.id"
        class="p-5 rounded-2xl bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex justify-between items-center gap-4 cursor-pointer"
        @click="emit('open-detail', req)"
      >
        <div class="flex-1 flex flex-col gap-1 min-w-0">
          <div class="flex items-center gap-2">
            <span
              class="px-2 py-0.5 rounded text-[10px] font-bold"
              :class="
                req.status === 'RESOLVED'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
              "
            >
              {{
                req.status === 'RESOLVED' ? label('已解决', 'Resolved') : label('求助中', 'Open')
              }}
            </span>
            <h4 class="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
              {{ req.title }}
            </h4>
          </div>

          <p class="text-xs text-[var(--text-muted)] line-clamp-2 mt-1">
            {{ req.description }}
          </p>

          <div class="flex items-center gap-3 mt-3 text-[10px] text-[var(--text-muted)]">
            <div class="flex items-center gap-1.5">
              <div
                class="w-4 h-4 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center shrink-0"
              >
                <img
                  v-if="req.user?.avatarUrl"
                  :src="getAssetUrl(req.user.avatarUrl)"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-[8px] font-bold text-slate-400">{{
                  req.user?.name?.slice(0, 1) || 'U'
                }}</span>
              </div>
              <span>{{ req.user?.name }}</span>
            </div>
            <span>•</span>
            <span>{{ new Date(req.createdAt).toLocaleDateString() }}</span>
          </div>
        </div>

        <div class="flex flex-col items-end gap-1 font-semibold shrink-0">
          <span class="text-base text-indigo-400 font-mono">{{ req._count?.replies || 0 }}</span>
          <span class="text-[10px] text-[var(--text-muted)]">{{ label('个回复', 'Replies') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
