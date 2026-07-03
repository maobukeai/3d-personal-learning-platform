<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { RefreshCw, MessageSquare, Box, Layers, Puzzle } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import Modal from '@/components/ui/Modal.vue';
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

interface HelpRequestReply {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  linkedPlugin?: any;
  linkedAsset?: any;
  linkedMaterial?: any;
}

const props = defineProps<{
  show: boolean;
  request: HelpRequest | null;
  replies: HelpRequestReply[];
  isRepliesLoading: boolean;
  isSubmittingReply: boolean;
  approvedItemsForLinking: { id: string; title: string }[];
  linkLabel: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'post-reply', payload: { content: string; linkedItemId: string }): void;
  (e: 'resolve', requestId: string): void;
  (e: 'open-linked-item', itemId: string): void;
}>();

const newReplyContent = ref('');
const linkedItemId = ref('');

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      newReplyContent.value = '';
      linkedItemId.value = '';
    }
  },
);

const handlePostReply = () => {
  if (!newReplyContent.value.trim()) return;
  emit('post-reply', {
    content: newReplyContent.value.trim(),
    linkedItemId: linkedItemId.value,
  });
  newReplyContent.value = '';
  linkedItemId.value = '';
};

// Normalizes whichever linked entity exists in the reply
const getNormalizedLinkedItem = (reply: HelpRequestReply) => {
  const item = reply.linkedPlugin || reply.linkedAsset || reply.linkedMaterial;
  if (!item) return null;

  return {
    id: item.id,
    title: item.title || '',
    subtitle: item.version || item.type || item.resolution || '',
    thumbnail: item.previewUrl || item.thumbnail || null,
    downloads: item.downloads || 0,
    rawType: reply.linkedPlugin ? 'plugin' : reply.linkedAsset ? 'asset' : 'material',
  };
};
</script>

<template>
  <Modal :show="show" size="xl" @close="emit('close')">
    <template v-if="request" #header>
      <div class="flex items-center gap-2">
        <span
          class="px-2 py-0.5 rounded text-[10px] font-bold"
          :class="
            request.status === 'RESOLVED'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          "
        >
          {{
            request.status === 'RESOLVED'
              ? label('已解决', 'Resolved')
              : label('求助中', 'Open')
          }}
        </span>
        <h3 class="text-sm sm:text-base font-bold text-[var(--text-primary)]">
          {{ request.title }}
        </h3>
      </div>
    </template>

    <div
      v-if="request"
      class="flex flex-col gap-5 text-left max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar"
    >
      <!-- Main Post -->
      <div class="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col gap-3">
        <p class="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
          {{ request.description }}
        </p>

        <div class="flex justify-between items-center text-xs text-[var(--text-muted)] border-t border-white/5 pt-3 mt-1">
          <div class="flex items-center gap-2">
            <div
              class="w-5 h-5 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center shrink-0"
            >
              <img
                v-if="request.user?.avatarUrl"
                :src="getAssetUrl(request.user.avatarUrl)"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-[9px] font-bold text-slate-400">{{
                request.user?.name?.slice(0, 1) || 'U'
              }}</span>
            </div>
            <span class="font-bold text-[var(--text-primary)]">{{
              request.user?.name
            }}</span>
            <span>{{ label('发布于', 'posted on') }} {{ new Date(request.createdAt).toLocaleString() }}</span>
          </div>

          <Button
            v-if="request.status === 'OPEN'"
            variant="secondary"
            size="sm"
            class="border-emerald-500/20 hover:bg-emerald-500/[0.05] !text-emerald-400 !h-7"
            @click="emit('resolve', request.id)"
          >
            {{ label('标记为已解决', 'Mark as Resolved') }}
          </Button>
        </div>
      </div>

      <!-- Replies Section -->
      <div class="flex flex-col gap-3">
        <h4 class="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">
          {{ label('社区回复', 'Replies') }} ({{ replies.length }})
        </h4>

        <div v-if="isRepliesLoading" class="flex justify-center py-6">
          <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
        </div>
        <div
          v-else-if="replies.length === 0"
          class="text-center py-8 bg-white/[0.005] border border-dashed border-white/5 rounded-2xl text-xs text-[var(--text-muted)] font-semibold"
        >
          {{ label('暂无回复，发表你的见解吧！', 'No replies yet. Share your thoughts!') }}
        </div>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="reply in replies"
            :key="reply.id"
            class="p-4 rounded-2xl bg-white/[0.005] border border-white/5 flex flex-col gap-2.5 text-xs text-left"
          >
            <p class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
              {{ reply.content }}
            </p>

            <!-- Linked Entity Card (Supports Plugin, Asset, Material) -->
            <div
              v-if="getNormalizedLinkedItem(reply)"
              class="mt-1.5 p-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-3 cursor-pointer max-w-sm"
              @click="emit('open-linked-item', getNormalizedLinkedItem(reply)!.id)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div
                  class="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center shrink-0"
                >
                  <img
                    v-if="getNormalizedLinkedItem(reply)!.thumbnail"
                    :src="getAssetUrl(getNormalizedLinkedItem(reply)!.thumbnail)"
                    class="w-full h-full object-cover"
                  />
                  <component
                    :is="getNormalizedLinkedItem(reply)!.rawType === 'plugin' ? Puzzle : getNormalizedLinkedItem(reply)!.rawType === 'asset' ? Box : Layers"
                    v-else
                    class="w-5 h-5 text-slate-400"
                  />
                </div>
                <div class="min-w-0 flex flex-col gap-0.5">
                  <span class="font-bold text-[var(--text-primary)] truncate text-xs">{{
                    getNormalizedLinkedItem(reply)!.title
                  }}</span>
                  <span class="text-[9px] text-[var(--text-muted)] font-mono">{{
                    getNormalizedLinkedItem(reply)!.subtitle
                  }}</span>
                </div>
              </div>
              <div class="text-[10px] text-[var(--text-muted)] shrink-0 font-semibold">
                {{ getNormalizedLinkedItem(reply)!.downloads }} {{ label('下载', 'DLs') }}
              </div>
            </div>

            <!-- Reply author info -->
            <div class="flex justify-between items-center border-t border-white/5 pt-2.5 mt-1 text-[10px] text-[var(--text-muted)]">
              <div class="flex items-center gap-1.5">
                <div
                  class="w-4 h-4 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center shrink-0"
                >
                  <img
                    v-if="reply.user?.avatarUrl"
                    :src="getAssetUrl(reply.user.avatarUrl)"
                    class="w-full h-full object-cover"
                  />
                  <span v-else class="text-[8px] font-bold text-slate-400">{{
                    reply.user?.name?.slice(0, 1) || 'U'
                  }}</span>
                </div>
                <span class="font-semibold text-[var(--text-primary)]">{{
                  reply.user?.name
                }}</span>
                <span>{{ label('回复于', 'replied') }} {{ new Date(reply.createdAt).toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Reply Editor -->
      <div
        v-if="request.status === 'OPEN'"
        class="flex flex-col gap-3 border-t border-white/5 pt-5 mt-2"
      >
        <h4 class="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">
          {{ label('发表回复', 'Post Reply') }}
        </h4>
        <textarea
          v-model="newReplyContent"
          rows="3"
          class="w-full rounded-xl bg-white/[0.01] border border-white/10 focus:border-indigo-500/50 p-3 text-xs text-[var(--text-primary)] outline-none resize-none focus:ring-1 focus:ring-indigo-500/20"
          :placeholder="label('在此输入回复内容...', 'Type your reply here...')"
        ></textarea>

        <div class="flex items-center justify-between gap-3 flex-wrap">
          <!-- Item Link Selection -->
          <div class="flex items-center gap-2 text-xs">
            <span class="text-[var(--text-muted)]">{{ linkLabel }}</span>
            <select
              v-model="linkedItemId"
              class="rounded-lg bg-slate-950 border border-white/10 text-[var(--text-primary)] py-1 px-2 text-xs outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="">{{ label('无', 'None') }}</option>
              <option
                v-for="item in approvedItemsForLinking"
                :key="item.id"
                :value="item.id"
              >
                {{ item.title }}
              </option>
            </select>
          </div>

          <Button
            variant="primary"
            size="sm"
            :disabled="isSubmittingReply || !newReplyContent.trim()"
            class="flex items-center gap-1.5 cursor-pointer"
            @click="handlePostReply"
          >
            <RefreshCw v-if="isSubmittingReply" class="w-3 h-3 animate-spin" />
            <MessageSquare v-else class="w-3.5 h-3.5" />
            <span>{{ label('发表回复', 'Submit Reply') }}</span>
          </Button>
        </div>
      </div>
    </div>
  </Modal>
</template>
