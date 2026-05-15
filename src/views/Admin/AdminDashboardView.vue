<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Users,
  Box,
  MessageSquare,
  BookOpen,
  TrendingUp,
  Clock,
  Layout,
  UserPlus,
  Plus,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Video,
  Megaphone,
  RefreshCw,
  Trash2,
  History,
  Send,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage } from 'element-plus';

const router = useRouter();

const stats = ref([
  { label: '总用户数', value: '0', color: 'text-blue-600', icon: Users, route: '/admin/users' },
  { label: '3D资产', value: '0', color: 'text-emerald-600', icon: Box, route: '/admin/assets' },
  { label: '材质材料', value: '0', color: 'text-amber-600', icon: Layers, route: '/admin/audits' },
  { label: '作品展示', value: '0', color: 'text-rose-600', icon: Video, route: '/admin/audits' },
  {
    label: '学院课程',
    value: '0',
    color: 'text-indigo-600',
    icon: BookOpen,
    route: '/admin/courses',
  },
  { label: '活跃团队', value: '0', color: 'text-teal-600', icon: UserPlus, route: '/admin/teams' },
  {
    label: '待办审核',
    value: '0',
    color: 'text-orange-600',
    icon: AlertCircle,
    route: '/admin/audits',
  },
  {
    label: '反馈中心',
    value: '0',
    color: 'text-purple-600',
    icon: MessageSquare,
    route: '/admin/feedback',
  },
]);

const recentUsers = ref<any[]>([]);
const recentAssets = ref<any[]>([]);
const isLoading = ref(true);

const showBroadcastModal = ref(false);
const broadcastTab = ref('send'); // 'send' or 'history'
const isBroadcasting = ref(false);
const broadcastHistory = ref<any[]>([]);
const isHistoryLoading = ref(false);
const broadcastForm = ref({
  title: '',
  content: '',
  link: '',
});

const fetchBroadcastHistory = async () => {
  try {
    isHistoryLoading.value = true;
    const { data } = await api.get('/api/admin/broadcasts');
    broadcastHistory.value = data;
  } catch (error) {
    console.error('Fetch broadcast history error:', error);
  } finally {
    isHistoryLoading.value = false;
  }
};

const handleSendBroadcast = async () => {
  if (!broadcastForm.value.title || !broadcastForm.value.content) {
    ElMessage.warning('请填写完整的标题和内容');
    return;
  }

  try {
    isBroadcasting.value = true;
    const { data } = await api.post('/api/admin/broadcast', broadcastForm.value);
    ElMessage.success(data.message);
    broadcastForm.value = { title: '', content: '', link: '' };
    if (broadcastTab.value === 'history') {
      fetchBroadcastHistory();
    } else {
      showBroadcastModal.value = false;
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '广播发送失败');
  } finally {
    isBroadcasting.value = false;
  }
};

const handleDeleteBroadcast = async (id: string) => {
  try {
    await api.delete(`/api/admin/broadcasts/${id}`);
    ElMessage.success('广播已成功撤回');
    fetchBroadcastHistory();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '撤回失败');
  }
};

const switchBroadcastTab = (tab: string) => {
  broadcastTab.value = tab;
  if (tab === 'history') {
    fetchBroadcastHistory();
  }
};

const fetchAdminStats = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/stats');

    stats.value[0].value = data.counts.users.toString();
    stats.value[1].value = data.counts.assets.toString();
    stats.value[2].value = data.counts.materials.toString();
    stats.value[3].value = data.counts.showcases.toString();
    stats.value[4].value = data.counts.courses.toString();
    stats.value[5].value = data.counts.teams.toString();

    const totalPending =
      (data.counts.pendingAssets || 0) +
      (data.counts.pendingMaterials || 0) +
      (data.counts.pendingShowcases || 0);
    stats.value[6].value = totalPending.toString();
    stats.value[7].value = data.counts.openFeedbacks.toString();

    recentUsers.value = data.recentUsers;
    recentAssets.value = data.recentAssets;
  } catch (error) {
    console.error('Fetch admin stats error:', error);
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString();
};

onMounted(() => {
  fetchAdminStats();
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Admin Header -->
    <div
      class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div>
        <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">
          管理后台概览
        </h1>
        <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">
          监控平台运行状态及待办事项
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors duration-300"
          style="background-color: var(--bg-app); border-color: var(--border-base)"
        >
          <Calendar class="w-4 h-4 text-slate-400" />
          <span class="text-xs font-bold" style="color: var(--text-secondary)">{{
            new Date().toLocaleDateString()
          }}</span>
        </div>
      </div>
    </div>

    <!-- Main Content Scroll Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-7xl mx-auto space-y-8">
        <!-- Quick Actions -->
        <div
          class="p-8 rounded-3xl border transition-colors duration-300"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <h3 class="font-bold text-lg mb-6" style="color: var(--text-primary)">管理操作</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              class="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              style="border-color: var(--border-base)"
              @click="router.push('/admin/users')"
            >
              <div
                class="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 group-hover:scale-110 transition-transform"
              >
                <Users class="w-6 h-6" />
              </div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">用户管理</span>
            </button>
            <button
              class="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              style="border-color: var(--border-base)"
              @click="router.push('/admin/audits')"
            >
              <div
                class="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 group-hover:scale-110 transition-transform"
              >
                <CheckCircle2 class="w-6 h-6" />
              </div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">内容审核</span>
            </button>
            <button
              class="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              style="border-color: var(--border-base)"
              @click="router.push('/admin/courses')"
            >
              <div
                class="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 group-hover:scale-110 transition-transform"
              >
                <BookOpen class="w-6 h-6" />
              </div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">课程管理</span>
            </button>
            <button
              class="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              style="border-color: var(--border-base)"
              @click="router.push('/admin/roadmaps')"
            >
              <div
                class="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 group-hover:scale-110 transition-transform"
              >
                <Clock class="w-6 h-6" />
              </div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">学习路线</span>
            </button>
            <button
              class="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              style="border-color: var(--border-base)"
              @click="router.push('/admin/teams')"
            >
              <div
                class="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 group-hover:scale-110 transition-transform"
              >
                <UserPlus class="w-6 h-6" />
              </div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">团队管理</span>
            </button>
            <button
              class="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              style="border-color: var(--border-base)"
              @click="router.push('/admin/feedback')"
            >
              <div
                class="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 group-hover:scale-110 transition-transform"
              >
                <MessageSquare class="w-6 h-6" />
              </div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">反馈中心</span>
            </button>
            <button
              class="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              style="border-color: var(--border-base)"
              @click="router.push('/admin/settings')"
            >
              <div
                class="p-3 rounded-xl bg-slate-50 dark:bg-white/10 text-slate-600 group-hover:scale-110 transition-transform"
              >
                <Layout class="w-6 h-6" />
              </div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">系统设置</span>
            </button>
            <button
              class="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              style="border-color: var(--border-base)"
              @click="showBroadcastModal = true"
            >
              <div
                class="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 group-hover:scale-110 transition-transform"
              >
                <Megaphone class="w-6 h-6" />
              </div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">全站广播</span>
            </button>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md cursor-pointer group"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
            @click="router.push(stat.route)"
          >
            <div class="flex items-start justify-between mb-4">
              <div class="p-3 rounded-2xl bg-slate-50 dark:bg-white/5" :class="stat.color">
                <component :is="stat.icon" class="w-6 h-6" />
              </div>
              <TrendingUp
                v-if="stat.value !== '0'"
                class="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
            <p
              class="text-xs font-bold uppercase tracking-wider mb-1"
              style="color: var(--text-muted)"
            >
              {{ stat.label }}
            </p>
            <h2 class="text-3xl font-black" style="color: var(--text-primary)">{{ stat.value }}</h2>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Recent Users -->
          <div
            class="p-8 rounded-3xl border transition-colors duration-300"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div class="flex items-center justify-between mb-8">
              <h3 class="font-bold text-lg" style="color: var(--text-primary)">最新注册用户</h3>
              <button
                class="text-xs font-bold text-accent hover:underline"
                @click="router.push('/admin/users')"
              >
                管理所有用户
              </button>
            </div>
            <div class="space-y-4">
              <div
                v-for="user in recentUsers"
                :key="user.id"
                class="flex items-center justify-between p-4 rounded-2xl border transition-all hover:bg-slate-50 dark:hover:bg-white/5"
                style="border-color: var(--border-base)"
              >
                <div class="flex items-center gap-4">
                  <div
                    class="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center overflow-hidden"
                  >
                    <img
                      v-if="user.avatarUrl"
                      :src="user.avatarUrl"
                      class="w-full h-full object-cover"
                    />
                    <Users v-else class="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p class="text-sm font-bold" style="color: var(--text-primary)">
                      {{ user.name || '匿名用户' }}
                    </p>
                    <p class="text-[10px]" style="color: var(--text-muted)">{{ user.email }}</p>
                  </div>
                </div>
                <span class="text-[10px] font-bold" style="color: var(--text-muted)">{{
                  formatDate(user.createdAt)
                }}</span>
              </div>
              <div v-if="recentUsers.length === 0" class="py-12 text-center text-slate-400">
                <p class="text-sm font-bold">暂无新用户</p>
              </div>
            </div>
          </div>

          <!-- Recent Assets -->
          <div
            class="p-8 rounded-3xl border transition-colors duration-300"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div class="flex items-center justify-between mb-8">
              <h3 class="font-bold text-lg" style="color: var(--text-primary)">最新提交资产</h3>
              <button
                class="text-xs font-bold text-accent hover:underline"
                @click="router.push('/admin/assets')"
              >
                审核所有资产
              </button>
            </div>
            <div class="space-y-4">
              <div
                v-for="asset in recentAssets"
                :key="asset.id"
                class="flex items-center justify-between p-4 rounded-2xl border transition-all hover:bg-slate-50 dark:hover:bg-white/5"
                style="border-color: var(--border-base)"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 overflow-hidden flex-shrink-0"
                  >
                    <img
                      v-if="asset.thumbnail"
                      :src="asset.thumbnail"
                      class="w-full h-full object-cover"
                    />
                    <Box v-else class="w-full h-full p-3 text-slate-400" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold truncate" style="color: var(--text-primary)">
                      {{ asset.title }}
                    </p>
                    <p class="text-[10px]" style="color: var(--text-muted)">
                      作者: {{ asset.user.name }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0"
                    :class="{
                      'bg-amber-100 text-amber-600': asset.status === 'PENDING',
                      'bg-emerald-100 text-emerald-600': asset.status === 'APPROVED',
                      'bg-rose-100 text-rose-600': asset.status === 'REJECTED',
                    }"
                  >
                    {{ asset.status }}
                  </span>
                </div>
              </div>
              <div v-if="recentAssets.length === 0" class="py-12 text-center text-slate-400">
                <p class="text-sm font-bold">暂无资产提交</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Broadcast Modal -->
    <div
      v-if="showBroadcastModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-xl rounded-3xl p-8 shadow-2xl transition-colors duration-300"
        style="background-color: var(--bg-card)"
      >
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="p-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600">
              <Megaphone class="w-6 h-6" />
            </div>
            <div>
              <h3 class="text-xl font-bold" style="color: var(--text-primary)">全站系统广播</h3>
              <p class="text-xs text-slate-400 mt-1">管理并向所有用户发布通知消息</p>
            </div>
          </div>
          <button
            class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full"
            @click="showBroadcastModal = false"
          >
            <Plus class="w-6 h-6 rotate-45 text-slate-400" />
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex p-1 gap-2 rounded-2xl mb-6" style="background-color: var(--bg-app)">
          <button
            class="flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            :style="
              broadcastTab === 'send'
                ? 'background-color: var(--bg-card); color: var(--text-primary); box-shadow: 0 4px 12px rgba(0,0,0,0.05)'
                : 'color: var(--text-muted)'
            "
            @click="switchBroadcastTab('send')"
          >
            <Send class="w-3.5 h-3.5" />
            发送新广播
          </button>
          <button
            class="flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            :style="
              broadcastTab === 'history'
                ? 'background-color: var(--bg-card); color: var(--text-primary); box-shadow: 0 4px 12px rgba(0,0,0,0.05)'
                : 'color: var(--text-muted)'
            "
            @click="switchBroadcastTab('history')"
          >
            <History class="w-3.5 h-3.5" />
            广播历史
          </button>
        </div>

        <!-- Send Tab -->
        <div v-if="broadcastTab === 'send'" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >广播标题</label
            >
            <input
              v-model="broadcastForm.title"
              type="text"
              placeholder="输入广播标题..."
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >广播内容</label
            >
            <textarea
              v-model="broadcastForm.content"
              rows="4"
              placeholder="输入广播详细内容..."
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            ></textarea>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >跳转链接 (可选)</label
            >
            <input
              v-model="broadcastForm.link"
              type="text"
              placeholder="https://... 或 /path"
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>

          <div class="pt-4">
            <button
              :disabled="isBroadcasting"
              class="w-full py-4 rounded-2xl bg-rose-500 text-white font-bold transition-all shadow-lg shadow-rose-500/20 hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2"
              @click="handleSendBroadcast"
            >
              <RefreshCw v-if="isBroadcasting" class="w-4 h-4 animate-spin" />
              {{ isBroadcasting ? '正在发送...' : '立即发布广播' }}
            </button>
          </div>
        </div>

        <!-- History Tab -->
        <div v-else class="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
          <div
            v-if="isHistoryLoading"
            class="py-20 flex flex-col items-center justify-center text-slate-400"
          >
            <RefreshCw class="w-8 h-8 animate-spin mb-4" />
            <p class="text-xs font-bold">正在加载历史记录...</p>
          </div>
          <div v-else-if="broadcastHistory.length === 0" class="py-20 text-center text-slate-400">
            <Megaphone class="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p class="text-sm font-bold">暂无广播记录</p>
          </div>
          <div
            v-for="broadcast in broadcastHistory"
            v-else
            :key="broadcast.id"
            class="p-4 rounded-2xl border transition-colors hover:bg-slate-50 dark:hover:bg-white/5 relative group"
            style="border-color: var(--border-base)"
          >
            <div class="flex items-start justify-between mb-2">
              <h4 class="font-bold text-sm pr-8" style="color: var(--text-primary)">
                {{ broadcast.title }}
              </h4>
              <button
                class="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors opacity-0 group-hover:opacity-100"
                @click="handleDeleteBroadcast(broadcast.id)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
            <p class="text-xs line-clamp-2 mb-3" style="color: var(--text-muted)">
              {{ broadcast.content }}
            </p>
            <div class="flex items-center justify-between mt-auto">
              <span class="text-[10px] font-bold" style="color: var(--text-muted)">{{
                new Date(broadcast.createdAt).toLocaleString()
              }}</span>
              <span
                v-if="broadcast.link"
                class="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10"
                style="color: var(--text-secondary)"
                >链接: {{ broadcast.link }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
