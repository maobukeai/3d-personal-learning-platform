<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  FolderArchive,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Loader2,
  HardDrive,
  KeyRound,
  Clock,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { formatDate } from '@/utils/format';
import { ElMessage } from '@/utils/feedbackBridge';

const emit = defineEmits<{
  (e: 'close-modal'): void;
}>();

const router = useRouter();

interface ExtractLogItem {
  id: string;
  userId: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  sourceId: string | null;
  sourceName: string | null;
  driveName: string | null;
  driveLink: string | null;
  drivePassword: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const logs = ref<ExtractLogItem[]>([]);
const isLoading = ref(false);
const copiedId = ref<string | null>(null);

async function fetchLogs() {
  isLoading.value = true;
  try {
    const res = await api.get('/api/mirror/user-extract-logs?page=1&pageSize=50');
    logs.value = res.data?.list || [];
  } catch {
    logs.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function handleCopy(text: string, id: string, typeDesc: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedId.value = id;
    ElMessage.success(`已复制${typeDesc}`);
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = null;
    }, 2000);
  } catch {
    ElMessage.error('复制失败，请手动选择复制');
  }
}

function handleOpenLink(link: string | null) {
  if (!link) return;
  window.open(link, '_blank', 'noopener,noreferrer');
}

function handleGoDetail(resourceId: string) {
  emit('close-modal');
  router.push(`/portal/resource/${resourceId}`);
}

async function handleDelete(id: string) {
  try {
    await api.delete(`/api/mirror/user-extract-logs/${id}`);
    logs.value = logs.value.filter((l) => l.id !== id);
    ElMessage.success('已移除该条提取记录');
  } catch {
    ElMessage.error('删除失败');
  }
}

onMounted(() => {
  fetchLogs();
});
</script>

<template>
  <div class="portal-extract-history space-y-3 py-1">
    <!-- Loading State -->
    <div v-if="isLoading" class="py-12 flex flex-col items-center justify-center space-y-2">
      <Loader2 class="w-5 h-5 animate-spin text-blue-500" />
      <span class="text-xs text-slate-400">正在加载提取记录...</span>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="logs.length === 0"
      class="py-12 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 space-y-2"
    >
      <div
        class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"
      >
        <FolderArchive class="w-5 h-5" />
      </div>
      <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">暂无资源网盘提取记录</p>
      <p class="text-[11px] text-slate-400">
        您在详情页成功获取并解密网盘链接后，将在此自动沉淀历史记录。
      </p>
    </div>

    <!-- Logs List -->
    <div v-else class="max-h-[320px] overflow-y-auto space-y-2 pr-1 scrollbar-hide">
      <div
        v-for="item in logs"
        :key="item.id"
        class="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-all space-y-2"
      >
        <!-- Top Row: Title & Drive Tag -->
        <div class="flex items-start justify-between gap-2">
          <button
            type="button"
            class="text-left font-bold text-xs text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1 flex-1 cursor-pointer transition-colors"
            :title="item.resourceTitle"
            @click="handleGoDetail(item.resourceId)"
          >
            {{ item.resourceTitle }}
          </button>
          <span
            class="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 flex items-center gap-1"
          >
            <HardDrive class="w-3 h-3" />
            {{ item.driveName || '网盘资源' }}
          </span>
        </div>

        <!-- Middle Row: Password & Time -->
        <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div class="flex items-center gap-3">
            <div
              v-if="item.drivePassword"
              class="flex items-center gap-1 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md font-mono font-medium"
            >
              <KeyRound class="w-3 h-3 text-slate-400" />
              <span>提取码：{{ item.drivePassword }}</span>
              <button
                type="button"
                class="ml-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                title="复制提取码"
                @click="handleCopy(item.drivePassword, item.id + '_pwd', '提取码')"
              >
                <Check v-if="copiedId === item.id + '_pwd'" class="w-3 h-3 text-emerald-500" />
                <Copy v-else class="w-3 h-3" />
              </button>
            </div>
            <div v-else class="text-[11px] text-slate-400">无需提取码</div>

            <div class="flex items-center gap-1 text-slate-400 text-[10px]">
              <Clock class="w-3 h-3" />
              <span>{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1">
            <button
              v-if="item.driveLink"
              type="button"
              class="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              @click="handleOpenLink(item.driveLink)"
            >
              <span>前往网盘</span>
              <ExternalLink class="w-2.5 h-2.5" />
            </button>
            <button
              v-if="item.driveLink"
              type="button"
              class="p-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 transition-colors cursor-pointer"
              title="复制网盘链接"
              @click="handleCopy(item.driveLink, item.id + '_link', '网盘链接')"
            >
              <Check v-if="copiedId === item.id + '_link'" class="w-3 h-3 text-emerald-500" />
              <Copy v-else class="w-3 h-3" />
            </button>
            <button
              type="button"
              class="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              title="移除该条提取记录"
              @click="handleDelete(item.id)"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
