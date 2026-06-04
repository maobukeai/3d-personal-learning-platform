<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted, computed } from 'vue';
import {
  MessageSquare,
  Search,
  Clock,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
  Trash2,
  Send,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';
import type { Feedback } from '@/types';

type FeedbackStatusFilter = 'ALL' | Feedback['status'];
type AdminFeedback = Feedback & {
  attachmentUrl?: string | null;
  user: NonNullable<Feedback['user']>;
};

const feedbacks = ref<AdminFeedback[]>([]);
const isLoading = ref(false);
const searchQuery = ref('');
const filterStatus = ref<FeedbackStatusFilter>('ALL');

const fetchFeedbacks = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/admin/feedback');
    feedbacks.value = response.data;
  } catch (_error) {
    ElMessage.error(t('admin.failed_to_get_feedback'));
  } finally {
    isLoading.value = false;
  }
};

const filteredFeedbacks = computed(() => {
  return feedbacks.value.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.user.name?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.user.email.toLowerCase().includes(searchQuery.value.toLowerCase());

    const matchesStatus = filterStatus.value === 'ALL' || item.status === filterStatus.value;

    return matchesSearch && matchesStatus;
  });
});

// Reply functionality
const replyDialogVisible = ref(false);
const isSubmittingReply = ref(false);
const currentFeedback = ref<AdminFeedback | null>(null);
const replyText = ref('');

const openReplyDialog = (item: AdminFeedback) => {
  currentFeedback.value = item;
  replyText.value = item.adminReply || '';
  replyDialogVisible.value = true;
};

const handleReply = async () => {
  if (!currentFeedback.value) return;

  isSubmittingReply.value = true;
  try {
    await api.put(`/api/admin/feedback/${currentFeedback.value.id}/status`, {
      adminReply: replyText.value,
    });
    ElMessage.success(t('admin.reply_sent'));
    replyDialogVisible.value = false;
    fetchFeedbacks();
  } catch (_error) {
    ElMessage.error(t('admin.failed_to_send_reply'));
  } finally {
    isSubmittingReply.value = false;
  }
};

const updateStatus = async (id: string, status: string) => {
  try {
    await api.put(`/api/admin/feedback/${id}/status`, { status });
    ElMessage.success(t('admin.status_updated'));
    fetchFeedbacks();
  } catch (_error) {
    ElMessage.error(t('admin.update_status_failed'));
  }
};

const setFilterStatus = (status: string) => {
  if (
    status === 'ALL' ||
    status === 'OPEN' ||
    status === 'IN_PROGRESS' ||
    status === 'RESOLVED' ||
    status === 'CLOSED'
  ) {
    filterStatus.value = status;
  }
};

const deleteFeedback = async (id: string) => {
  try {
    await ElMessageBox.confirm(t('admin.are_you_sure_you_16'), t('admin.confirm_deletion_1'), {
      confirmButtonText: t('admin.confirm_deletion'),
      cancelButtonText: t('admin.cancel'),
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });

    await api.delete(`/api/admin/feedback/${id}`);
    ElMessage.success(t('admin.delete_successfully'));
    fetchFeedbacks();
  } catch (error: unknown) {
    if (error !== 'cancel') {
      ElMessage.error(t('admin.delete_failed'));
    }
  }
};

const getStatusType = (status: string): "primary" | "success" | "warning" | "info" | "danger" | undefined => {
  switch (status) {
    case 'OPEN':
      return 'danger';
    case 'IN_PROGRESS':
      return 'warning';
    case 'RESOLVED':
      return 'success';
    case 'CLOSED':
      return 'info';
    default:
      return 'info';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'OPEN':
      return t('admin.pending');
    case 'IN_PROGRESS':
      return t('admin.processing');
    case 'RESOLVED':
      return t('admin.resolved');
    case 'CLOSED':
      return t('admin.closed');
    default:
      return status;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'HIGH':
      return 'text-rose-600 bg-rose-50';
    case 'MEDIUM':
      return 'text-amber-600 bg-amber-50';
    case 'LOW':
      return 'text-emerald-600 bg-emerald-50';
    default:
      return 'text-slate-600 bg-slate-50';
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'HIGH':
      return t('admin.high');
    case 'MEDIUM':
      return t('admin.in');
    case 'LOW':
      return t('admin.low');
    default:
      return priority;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const previewVisible = ref(false);
const previewImageUrl = ref('');

const showImage = (url: string) => {
  previewImageUrl.value = url;
  previewVisible.value = true;
};

onMounted(fetchFeedbacks);
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- 奢华顶栏 (超紧凑高阶版) -->
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- 极光背景装饰 -->
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-indigo-500/10 text-indigo-500 shadow-sm border border-indigo-500/20"
          >
            <MessageSquare class="w-4 h-4" />
          </span>
          <div>
            <h1 class="text-sm font-black tracking-tight" style="color: var(--text-primary)">
              用户反馈管理
            </h1>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button
type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="fetchFeedbacks"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span class="hidden sm:inline">{{ $t('admin.refresh') }}</span>
          </button>
        </div>
      </div>

      <!-- Row 2: 状态与检索 Pills -->
      <div
        class="px-4 sm:px-8 py-2 flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 状态 Pills -->
        <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
          <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button
v-for="filter in [
                { key: 'ALL', label: $t('admin.all_feedback'), count: feedbacks.length },
                { key: 'OPEN', label: $t('admin.pending'), count: feedbacks.filter(f => f.status === 'OPEN').length },
                { key: 'IN_PROGRESS', label: $t('admin.processing'), count: feedbacks.filter(f => f.status === 'IN_PROGRESS').length },
                { key: 'RESOLVED', label: $t('admin.resolved'), count: feedbacks.filter(f => f.status === 'RESOLVED').length },
                { key: 'CLOSED', label: $t('admin.closed'), count: feedbacks.filter(f => f.status === 'CLOSED').length }
              ]"
              :key="filter.key"
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0"
              :class="[
                filterStatus === filter.key
                  ? filter.key === 'OPEN'
                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 ring-1 ring-rose-500/20 font-extrabold shadow-sm'
                    : filter.key === 'IN_PROGRESS'
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 ring-1 ring-amber-500/20 font-extrabold shadow-sm'
                      : filter.key === 'RESOLVED'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                        : filter.key === 'CLOSED'
                          ? 'bg-slate-500/10 text-slate-500 border-slate-500/30 ring-1 ring-slate-500/20 font-extrabold shadow-sm'
                          : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 ring-1 ring-indigo-500/20 font-extrabold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              ]"
              @click="setFilterStatus(filter.key)"
            >
              <span>{{ filter.label }}</span>
              <span class="opacity-60">({{ filter.count }})</span>
            </button>
          </div>
        </div>

        <!-- 检索与统计 -->
        <div class="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0">
          <div class="relative flex-1 md:flex-none md:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('admin.search_feedback_content_username')"
              class="w-full pl-9 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
            已过滤: <span class="text-indigo-600 font-extrabold">{{ filteredFeedbacks.length }}</span> / 总计: {{ feedbacks.length }}
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 scrollbar-hide">
      <div class="max-w-none space-y-4">
        <div
          v-if="isLoading"
          class="flex flex-col items-center justify-center py-20 text-slate-400"
        >
          <RefreshCw class="w-8 h-8 animate-spin mb-4" />
          <p class="text-sm font-medium">{{ $t('admin.loading_feedback_list') }}</p>
        </div>

        <template v-else>
          <div
            v-for="item in filteredFeedbacks"
            :key="item.id"
            class="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all duration-300"
          >
            <div class="flex items-start gap-4">
              <!-- User Info Side -->
              <div class="flex flex-col items-center gap-2 w-20 shrink-0">
                <UserAvatar :user="item.user" size="md" />
                <div class="text-center">
                  <p class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-20">
                    {{ item.user.name }}
                  </p>
                  <p class="text-[9px] text-slate-400 truncate w-20">{{ item.user.email }}</p>
                </div>
              </div>

              <!-- Main Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      :class="getPriorityColor(item.priority)"
                    >
                      {{ getPriorityLabel(item.priority) }} 优先级
                    </span>
                    <span
                      class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider"
                    >
                      {{ item.type }}
                    </span>
                    <h3
                      class="text-base font-bold text-slate-800 dark:text-slate-100 truncate ml-1"
                    >
                      {{ item.title }}
                    </h3>
                  </div>
                  <div class="flex items-center gap-2">
                    <Clock class="w-3.5 h-3.5 text-slate-400" />
                    <span class="text-xs text-slate-400 font-medium">{{
                      formatDate(item.createdAt)
                    }}</span>
                  </div>
                </div>

                <p
                  class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2 group-hover:line-clamp-none transition-all"
                >
                  {{ item.description }}
                </p>

                <!-- Attachment Preview -->
                <div v-if="item.attachmentUrl" class="mb-4">
                  <div
                    class="relative w-32 h-20 rounded-lg overflow-hidden border border-slate-200 cursor-zoom-in hover:opacity-90 transition-opacity"
                    @click="showImage(item.attachmentUrl)"
                  >
                    <img alt="" :src="item.attachmentUrl" class="w-full h-full object-cover" />
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <ImageIcon class="w-4 h-4 text-white drop-shadow-md" />
                    </div>
                  </div>
                </div>

                <!-- Admin Reply Display -->
                <div
                  v-if="item.adminReply"
                  class="mt-4 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5"
                >
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <div class="p-1 bg-indigo-100 dark:bg-indigo-900/40 rounded-md">
                        <MessageSquare class="w-3 h-3 text-indigo-600" />
                      </div>
                      <span class="text-[10px] font-black uppercase text-indigo-600 tracking-wider"
                        >{{ $t('admin.official_reply') }}</span
                      >
                    </div>
                    <span v-if="item.repliedAt" class="text-[9px] text-slate-400 font-bold">
                      回复于 {{ formatDate(item.repliedAt) }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-600 dark:text-slate-300 italic">
                    {{ item.adminReply }}
                  </p>
                </div>

                <div
                  class="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800/50 mt-4"
                >
                  <div class="flex items-center gap-4">
                    <el-tag
                      :type="getStatusType(item.status)"
                      size="small"
                      effect="light"
                      class="font-bold border-none px-3"
                    >
                      {{ getStatusLabel(item.status) }}
                    </el-tag>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
type="button"
                      class="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-200 dark:shadow-none"
                      @click="openReplyDialog(item)"
                    >
                      <MessageSquare class="w-3 h-3" />
                      {{ item.adminReply ? t('admin.edit_reply') : $t('admin.reply_to_user') }}
                    </button>

                    <el-dropdown trigger="click">
                      <button
type="button"
                        class="px-4 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-2"
                      >
                        状态 <ChevronRight class="w-3 h-3" />
                      </button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item @click="updateStatus(item.id, 'OPEN')"
                            >{{ $t('admin.set_as_pending') }}</el-dropdown-item
                          >
                          <el-dropdown-item @click="updateStatus(item.id, 'IN_PROGRESS')"
                            >{{ $t('admin.set_as_processing') }}</el-dropdown-item
                          >
                          <el-dropdown-item @click="updateStatus(item.id, 'RESOLVED')"
                            >{{ $t('admin.mark_as_solved') }}</el-dropdown-item
                          >
                          <el-dropdown-item @click="updateStatus(item.id, 'CLOSED')"
                            >{{ $t('admin.close_feedback') }}</el-dropdown-item
                          >
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>

                    <button
type="button"
                      class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      :title="$t('admin.delete_record')"
                      @click="deleteFeedback(item.id)"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="filteredFeedbacks.length === 0"
            class="flex flex-col items-center justify-center py-20 text-slate-400"
          >
            <div class="p-4 bg-slate-50 rounded-full mb-4">
              <CheckCircle2 class="w-12 h-12 opacity-20" />
            </div>
            <p class="text-sm font-medium">{{ $t('admin.no_matching_feedback_record') }}</p>
          </div>
        </template>
      </div>
    </div>

    <!-- Reply Dialog -->
    <el-dialog v-model="replyDialogVisible" :title="$t('admin.respond_to_user_feedback')" width="500px" destroy-on-close>
      <div v-if="currentFeedback" class="space-y-4">
        <div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            原始反馈
          </p>
          <p class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
            {{ currentFeedback.title }}
          </p>
          <p class="text-xs text-slate-500 line-clamp-3 italic">
            "{{ currentFeedback.description }}"
          </p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2"
            >{{ $t('admin.your_reply') }}</label
          >
          <el-input
            v-model="replyText"
            type="textarea"
            :rows="6"
            :placeholder="$t('admin.enter_your_formal_reply')"
            maxlength="1000"
            show-word-limit
          />
        </div>

        <div class="flex items-center gap-2 py-2">
          <p class="text-[10px] text-slate-400">{{ $t('admin.tip_after_sending_a') }}</p>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button
type="button"
            class="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs hover:bg-slate-50 transition-all"
            @click="replyDialogVisible = false"
          >
            取消
          </button>
          <button
type="button"
            :disabled="isSubmittingReply || !replyText.trim()"
            class="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
            @click="handleReply"
          >
            <RefreshCw v-if="isSubmittingReply" class="w-3.5 h-3.5 animate-spin" />
            <Send v-else class="w-3.5 h-3.5" />
            {{ currentFeedback?.adminReply ? t('admin.update_reply') : $t('admin.send_reply') }}
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- Image Preview Dialog -->
    <el-dialog v-model="previewVisible" :title="$t('admin.picture_preview')" width="60%" destroy-on-close>
      <img alt="" :src="previewImageUrl" class="w-full h-auto rounded-xl" />
    </el-dialog>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
