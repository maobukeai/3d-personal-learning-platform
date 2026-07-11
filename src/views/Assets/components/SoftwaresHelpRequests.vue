<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref } from 'vue';
import { ExternalLink, Puzzle, RefreshCw } from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import { logError } from '@/utils/error';
import { toast } from '@/utils/feedbackAdapter';
import { useLabel } from '@/utils/i18n';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import type {
  HelpRequest,
  HelpRequestReply,
} from '../softwaresSchema'; /** * Self-contained section that owns the help-request detail and post modals. * * Receives list data + identity as props and emits high-level events so the * container can refresh shared query state. Favorite-category modal logic * lives in `SoftwaresFavoriteCategoryModal.vue`. */
defineProps<{
  helpRequests: HelpRequest[];
  isHelpRequestsLoading: boolean;
  currentUserId?: string;
  isAdmin: boolean;
  isAuthed: boolean;
}>();
const emit = defineEmits<{
  (e: 'open-linked-software', id: string): void;
  (e: 'refresh-requests'): void;
}>();
const label =
  useLabel(); /* ------------------------------------------------------------------ * * Help-request detail modal * ------------------------------------------------------------------ */
const selectedHelpRequest = ref<HelpRequest | null>(null);
const showHelpRequestDetailModal = ref(false);
const helpRequestReplies = ref<HelpRequestReply[]>([]);
const isHelpRepliesLoading = ref(false);
const newHelpReplyContent = ref('');
const linkedSoftwareIdForReply = ref('');
const isSubmittingReply = ref(false);
const approvedSoftwaresForLinking = ref<{ id: string; title: string }[]>([]);
const fetchApprovedSoftwaresForLinking = async () => {
  try {
    const { data } = await (
      await import('@/utils/api')
    ).default.get('/api/softwares', { params: { pageSize: 100 } });
    const list = data.softwares || [];
    approvedSoftwaresForLinking.value = list.map((p: any) => ({ id: p.id, title: p.title }));
  } catch (err) {
    logError(err, { operation: 'fetch softwares for linking' });
  }
};
const openHelpRequestDetail = async (req: HelpRequest) => {
  selectedHelpRequest.value = req;
  showHelpRequestDetailModal.value = true;
  newHelpReplyContent.value = '';
  linkedSoftwareIdForReply.value = '';
  isHelpRepliesLoading.value = true;
  try {
    const api = (await import('@/utils/api')).default;
    const { data } = await api.get(`/api/softwares/requests/${req.id}`);
    helpRequestReplies.value = data.replies || [];
  } catch (err) {
    logError(err, { operation: 'load replies' });
  } finally {
    isHelpRepliesLoading.value = false;
  }
  fetchApprovedSoftwaresForLinking();
};
const handlePostReply = async () => {
  if (!selectedHelpRequest.value || !newHelpReplyContent.value.trim()) return;
  isSubmittingReply.value = true;
  try {
    const api = (await import('@/utils/api')).default;
    const { data } = await api.post(
      `/api/softwares/requests/${selectedHelpRequest.value.id}/replies`,
      {
        content: newHelpReplyContent.value.trim(),
        linkedSoftwareId: linkedSoftwareIdForReply.value || undefined,
      },
    );
    helpRequestReplies.value.push(data);
    newHelpReplyContent.value = '';
    linkedSoftwareIdForReply.value = '';
    toast.success(label('回复发表成功', 'Reply posted successfully'));
    selectedHelpRequest.value._count = selectedHelpRequest.value._count || { replies: 0 };
    selectedHelpRequest.value._count.replies += 1;
    emit('refresh-requests');
  } catch (err) {
    logError(err, { operation: 'post reply' });
    toast.error(label('回复失败', 'Failed to reply'));
  } finally {
    isSubmittingReply.value = false;
  }
};
const handleResolveRequest = async (requestId: string) => {
  try {
    const api = (await import('@/utils/api')).default;
    await api.post(`/api/softwares/requests/${requestId}/resolve`);
    toast.success(label('求助帖已解决并关闭', 'Request marked as resolved'));
    if (selectedHelpRequest.value) selectedHelpRequest.value.status = 'RESOLVED';
    emit('refresh-requests');
  } catch (err) {
    logError(err, { operation: 'resolve request' });
    toast.error(label('操作失败', 'Action failed'));
  }
};
const closeDetailModal = () => {
  showHelpRequestDetailModal.value = false;
  selectedHelpRequest.value = null;
}; /* ------------------------------------------------------------------ * * Help-request post modal * ------------------------------------------------------------------ */
const showHelpRequestPostDialog = ref(false);
const newHelpRequestForm = ref({ title: '', description: '' });
const isSubmittingHelpRequest = ref(false);
const openHelpRequestPostDialog = () => {
  newHelpRequestForm.value = { title: '', description: '' };
  showHelpRequestPostDialog.value = true;
};
const handlePostHelpRequest = async () => {
  if (!newHelpRequestForm.value.title.trim() || !newHelpRequestForm.value.description.trim())
    return;
  isSubmittingHelpRequest.value = true;
  try {
    const api = (await import('@/utils/api')).default;
    await api.post('/api/softwares/requests', {
      title: newHelpRequestForm.value.title.trim(),
      description: newHelpRequestForm.value.description.trim(),
    });
    toast.success(label('求助帖发布成功', 'Help request posted successfully'));
    newHelpRequestForm.value = { title: '', description: '' };
    showHelpRequestPostDialog.value = false;
    emit('refresh-requests');
  } catch (err) {
    logError(err, { operation: 'post help request' });
    toast.error(label('发布失败', 'Failed to post'));
  } finally {
    isSubmittingHelpRequest.value = false;
  }
};
defineExpose({ openHelpRequestDetail, openHelpRequestPostDialog });
</script>
<template>
  <!-- Help Request Detail Modal -->
  <Modal :show="showHelpRequestDetailModal" size="xl" @close="closeDetailModal">
    <template v-if="selectedHelpRequest" #header>
      <div class="flex items-center gap-2">
        <span
          class="px-2 py-0.5 rounded text-[10px] font-bold"
          :class="
            selectedHelpRequest.status === 'RESOLVED'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          "
        >
          {{
            selectedHelpRequest.status === 'RESOLVED'
              ? label('已解决', 'Resolved')
              : label('求助中', 'Open')
          }}
        </span>
        <h3 class="text-sm sm:text-base font-bold text-[var(--text-primary)]">
          {{ selectedHelpRequest.title }}
        </h3>
      </div>
    </template>
    <div
      v-if="selectedHelpRequest"
      class="flex flex-col gap-5 text-left max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar"
    >
      <div class="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col gap-3">
        <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <div
            class="w-5 h-5 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center shrink-0"
          >
            <img
              v-if="selectedHelpRequest.user?.avatarUrl"
              :src="getAssetUrl(selectedHelpRequest.user.avatarUrl)"
              class="w-full h-full object-cover"
            />
            <span v-else class="text-[9px] font-bold text-slate-400">{{
              selectedHelpRequest.user?.name?.slice(0, 1) || 'U'
            }}</span>
          </div>
          <span class="font-bold text-[var(--text-primary)]">{{
            selectedHelpRequest.user?.name
          }}</span>
          <span>•</span>
          <span class="font-mono">{{
            new Date(selectedHelpRequest.createdAt).toLocaleString()
          }}</span>
          <button
            v-if="
              selectedHelpRequest.status === 'OPEN' &&
              (currentUserId === selectedHelpRequest.userId || isAdmin)
            "
            class="ml-auto px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] border-0 transition-colors cursor-pointer"
            @click="handleResolveRequest(selectedHelpRequest.id)"
          >
            {{ label('标为已解决', 'Mark Resolved') }}
          </button>
        </div>
        <p
          class="text-xs sm:text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed border-t border-white/5 pt-3"
        >
          {{ selectedHelpRequest.description }}
        </p>
      </div>
      <div class="flex flex-col gap-3">
        <h4 class="text-xs font-bold text-[var(--text-primary)] border-l-2 border-indigo-500 pl-2">
          {{ label('回复与讨论', 'Replies') }} ({{ helpRequestReplies.length }})
        </h4>
        <div v-if="isHelpRepliesLoading" class="flex justify-center py-6">
          <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
        </div>
        <div
          v-else-if="helpRequestReplies.length === 0"
          class="text-center py-6 text-xs text-[var(--text-muted)]"
        >
          {{
            label('暂无回复，发表第一条回复来提供帮助吧！', 'No replies yet. Help out by replying!')
          }}
        </div>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="rep in helpRequestReplies"
            :key="rep.id"
            class="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col gap-3"
          >
            <div class="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
              <div
                class="w-4 h-4 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center shrink-0"
              >
                <img
                  v-if="rep.user?.avatarUrl"
                  :src="getAssetUrl(rep.user.avatarUrl)"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-[8px] font-bold text-slate-400">{{
                  rep.user?.name?.slice(0, 1) || 'U'
                }}</span>
              </div>
              <span class="font-bold text-[var(--text-primary)]">{{ rep.user?.name }}</span>
              <span>•</span>
              <span class="font-mono">{{ new Date(rep.createdAt).toLocaleString() }}</span>
            </div>
            <p class="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
              {{ rep.content }}
            </p>
            <div
              v-if="rep.linkedSoftware"
              class="flex items-center justify-between p-3 rounded-xl bg-indigo-600/5 border border-indigo-500/10 cursor-pointer hover:bg-indigo-600/10 transition-colors"
              @click="emit('open-linked-software', rep.linkedSoftware.id)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div
                  class="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center shrink-0"
                >
                  <img
                    v-if="rep.linkedSoftware.previewUrl"
                    :src="getAssetUrl(rep.linkedSoftware.previewUrl)"
                    class="w-full h-full object-cover"
                  />
                  <Puzzle v-else class="w-4 h-4 text-indigo-400" />
                </div>
                <div class="text-left min-w-0">
                  <div class="text-xs font-bold text-[var(--text-primary)] truncate">
                    {{ rep.linkedSoftware.title }}
                  </div>
                  <div class="text-[9px] text-[var(--text-muted)] mt-0.5">
                    v{{ rep.linkedSoftware.version }}
                  </div>
                </div>
              </div>
              <div
                class="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:underline"
              >
                <span>{{ label('查看软件', 'View Software') }}</span>
                <ExternalLink class="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="isAuthed" class="border-t border-white/10 pt-4 flex flex-col gap-3">
        <h4 class="text-xs font-bold text-[var(--text-primary)]">
          {{ label('发表回复', 'Post Reply') }}
        </h4>
        <textarea
          v-model="newHelpReplyContent"
          :placeholder="label('在此输入回复内容，提供解决方案或线索...', 'Type your reply here...')"
          class="w-full min-h-[70px] bg-white/[0.03] border border-[var(--border-base)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:border-indigo-500 outline-none resize-none placeholder-slate-500"
        ></textarea>
        <div class="flex flex-col md:flex-row md:items-center gap-3">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span
              class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0"
            >
              {{ label('关联软件(可选)', 'Link Software') }}
            </span>
            <Select
              v-model="linkedSoftwareIdForReply"
              :placeholder="
                label('选择推荐的已上架软件', 'Select a published software to recommend')
              "
              clearable
              filterable
              class="flex-1 custom-select-v2 text-xs"
            >
              <SelectOption
                v-for="p in approvedSoftwaresForLinking"
                :key="p.id"
                :label="p.title"
                :value="p.id"
              />
            </Select>
          </div>
          <Button
            variant="primary"
            size="sm"
            :loading="isSubmittingReply"
            :disabled="!newHelpReplyContent.trim()"
            class="shrink-0 flex items-center justify-center cursor-pointer"
            @click="handlePostReply"
          >
            {{ label('提交回复', 'Post Reply') }}
          </Button>
        </div>
      </div>
    </div>
  </Modal>
  <!-- Help Request Post Modal -->
  <Modal :show="showHelpRequestPostDialog" size="md" @close="showHelpRequestPostDialog = false">
    <template #header>
      <h3 class="text-sm sm:text-base font-bold text-[var(--text-primary)]">
        {{ label('发布新软件求助贴', 'Create Help Request') }}
      </h3>
    </template>
    <div class="flex flex-col gap-4 text-left">
      <div>
        <Input
          v-model="newHelpRequestForm.title"
          type="text"
          :label="label('求助标题', 'Help Title')"
          :placeholder="
            label(
              '简要描述您需要的软件或需求，如：求一个能批量烘焙动作的Blender软件',
              'Briefly describe the software or feature you need, e.g., a Blender add-on for batch baking actions',
            )
          "
          required
        />
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
        >
          {{ label('详细描述', 'Detailed Description') }}
        </label>
        <textarea
          v-model="newHelpRequestForm.description"
          :placeholder="
            label(
              '详细描述您遇到的问题、期望软件具备的功能、或者提供参考的演示视频/图片链接...',
              'Describe your problem, expected software features, or provide reference demo video/image links...',
            )
          "
          class="w-full min-h-[120px] bg-white/[0.03] border border-[var(--border-base)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:border-indigo-500 outline-none resize-none placeholder-slate-500"
        ></textarea>
      </div>
      <div class="flex justify-end gap-2 mt-2">
        <Button variant="secondary" size="sm" @click="showHelpRequestPostDialog = false">
          {{ label('取消', 'Cancel') }}
        </Button>
        <Button
          variant="primary"
          size="sm"
          :loading="isSubmittingHelpRequest"
          :disabled="!newHelpRequestForm.title.trim() || !newHelpRequestForm.description.trim()"
          @click="handlePostHelpRequest"
        >
          {{ label('发布', 'Post') }}
        </Button>
      </div>
    </div>
  </Modal>
</template>
