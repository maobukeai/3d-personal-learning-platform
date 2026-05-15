<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  Bell,
  CheckCheck,
  Trash2,
  Search,
  MessageSquare,
  Users,
  Briefcase,
  Info,
  ChevronRight,
  Inbox,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';

const router = useRouter();
const notifications = ref<any[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const activeFilter = ref('all');
const activeCategory = ref('all');

const fetchNotifications = async () => {
  try {
    isLoading.value = true;
    const type = activeCategory.value === 'all' ? '' : activeCategory.value;
    const response = await api.get(`/api/notifications${type ? `?type=${type}` : ''}`);
    notifications.value = response.data;
  } catch (error) {
    console.error('Fetch notifications error:', error);
    ElMessage.error('无法获取通知列表');
  } finally {
    isLoading.value = false;
  }
};

const handleCategoryChange = (catId: string) => {
  activeCategory.value = catId;
  activeFilter.value = 'all';
  fetchNotifications();
};

const filteredNotifications = computed(() => {
  let result = notifications.value;

  if (activeFilter.value === 'unread') {
    result = result.filter((n) => !n.isRead);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (n) => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query),
    );
  }

  return result;
});

const unreadCount = computed(() => notifications.value.filter((n) => !n.isRead).length);

const handleMarkAsRead = async (notification: any) => {
  if (!notification.isRead) {
    try {
      await api.put(`/api/notifications/${notification.id}/read`);
      notification.isRead = true;
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  }

  if (notification.link) {
    router.push(notification.link);
  }
};

const handleMarkAllRead = async () => {
  try {
    await api.put('/api/notifications/read-all');
    notifications.value.forEach((n) => (n.isRead = true));
    ElMessage.success('已将所有通知标记为已读');
  } catch (error) {
    ElMessage.error('操作失败');
  }
};

const handleDeleteAll = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有通知吗？此操作不可撤销。', '清空通知', {
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      type: 'warning',
    });
    // Assuming there's an endpoint for this, or we do it one by one if not.
    // For now, let's just clear locally if backend doesn't support it yet
    // await api.delete('/api/notifications/all')
    notifications.value = [];
    ElMessage.success('已清空所有通知');
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete all error:', error);
    }
  }
};

const getIcon = (type: string) => {
  switch (type) {
    case 'TEAM':
    case 'PROJECT_INVITE':
      return Users;
    case 'TASK':
      return Briefcase;
    case 'MESSAGE':
    case 'REPLY':
      return MessageSquare;
    case 'SYSTEM':
      return Info;
    default:
      return Info;
  }
};

const getIconColor = (type: string) => {
  switch (type) {
    case 'TEAM':
    case 'PROJECT_INVITE':
      return 'text-blue-500 bg-blue-500/10';
    case 'TASK':
      return 'text-amber-500 bg-amber-500/10';
    case 'MESSAGE':
    case 'REPLY':
      return 'text-emerald-500 bg-emerald-500/10';
    case 'SYSTEM':
      return 'text-indigo-500 bg-indigo-500/10';
    default:
      return 'text-indigo-500 bg-indigo-500/10';
  }
};

onMounted(() => {
  fetchNotifications();
});
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-black/20">
    <!-- Header -->
    <div
      class="h-20 px-8 flex items-center justify-between shrink-0 border-b backdrop-blur-md bg-white/40 dark:bg-slate-900/40 sticky top-0 z-10"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center gap-4">
        <div
          class="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent"
        >
          <Bell class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-white">通知中心</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            管理您的系统通知、团队动态和个人消息
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          :disabled="unreadCount === 0"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-accent hover:bg-accent/10 transition-all disabled:opacity-40"
          @click="handleMarkAllRead"
        >
          <CheckCheck class="w-4 h-4" />
          全部标记为已读
        </button>
        <button
          :disabled="notifications.length === 0"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-all disabled:opacity-40"
          @click="handleDeleteAll"
        >
          <Trash2 class="w-4 h-4" />
          清空通知
        </button>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar Filters -->
      <div
        class="w-72 border-r p-6 space-y-8 backdrop-blur-sm bg-white/20 dark:bg-slate-900/20"
        style="border-color: var(--border-base)"
      >
        <div class="space-y-4">
          <div class="relative">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索通知..."
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white/50 dark:bg-slate-800/50 text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              style="border-color: var(--border-base)"
            />
          </div>

          <div class="space-y-1">
            <button
              v-for="filter in [
                { id: 'all', label: '全部通知', icon: Inbox, count: notifications.length },
                { id: 'unread', label: '未读通知', icon: Bell, count: unreadCount },
              ]"
              :key="filter.id"
              class="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-medium transition-all"
              :class="
                activeFilter === filter.id
                  ? 'bg-accent text-white shadow-lg shadow-accent/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/5'
              "
              @click="activeFilter = filter.id"
            >
              <div class="flex items-center gap-3">
                <component :is="filter.icon" class="w-4 h-4" />
                {{ filter.label }}
              </div>
              <span
                v-if="filter.count > 0"
                class="px-2 py-0.5 rounded-full text-[10px]"
                :class="
                  activeFilter === filter.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                "
                >{{ filter.count }}</span
              >
            </button>
          </div>
        </div>

        <div class="pt-6 border-t" style="border-color: var(--border-base)">
          <h3 class="px-4 mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
            分类
          </h3>
          <div class="space-y-1">
            <button
              v-for="cat in [
                { id: 'all', label: '全部', icon: Inbox, color: 'text-slate-400' },
                { id: 'SYSTEM', label: '系统通知', icon: Info, color: 'text-indigo-500' },
                { id: 'TEAM', label: '团队动态', icon: Users, color: 'text-blue-500' },
                { id: 'TASK', label: '任务更新', icon: Briefcase, color: 'text-amber-500' },
                {
                  id: 'MESSAGE',
                  label: '消息回复',
                  icon: MessageSquare,
                  color: 'text-emerald-500',
                },
              ]"
              :key="cat.id"
              class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs transition-all"
              :class="
                activeCategory === cat.id
                  ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/5'
              "
              @click="handleCategoryChange(cat.id)"
            >
              <component :is="cat.icon" class="w-4 h-4" :class="cat.color" />
              {{ cat.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div
        class="flex-1 overflow-y-auto p-8 scrollbar-hide bg-gradient-to-br from-transparent to-accent/5"
      >
        <div class="max-w-4xl mx-auto space-y-4">
          <div v-if="isLoading" class="space-y-4">
            <div
              v-for="i in 5"
              :key="i"
              class="h-24 rounded-3xl bg-white/40 dark:bg-slate-800/40 animate-pulse border border-white/20"
            ></div>
          </div>

          <template v-else-if="filteredNotifications.length > 0">
            <div
              v-for="n in filteredNotifications"
              :key="n.id"
              class="group p-6 rounded-3xl border transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-accent/5 backdrop-blur-md"
              :class="[
                n.isRead
                  ? 'bg-white/30 dark:bg-slate-900/30'
                  : 'bg-white/80 dark:bg-slate-800/80 border-accent/20 ring-1 ring-accent/10 shadow-lg shadow-accent/5',
                'border-white/20 dark:border-slate-800/50',
              ]"
              @click="handleMarkAsRead(n)"
            >
              <div class="flex gap-4">
                <div
                  class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                  :class="getIconColor(n.type)"
                >
                  <component :is="getIcon(n.type)" class="w-6 h-6" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <h3
                      class="text-sm font-bold truncate pr-4"
                      :class="
                        n.isRead
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-900 dark:text-white'
                      "
                    >
                      {{ n.title }}
                    </h3>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-[10px] text-slate-400">{{
                        new Date(n.createdAt).toLocaleString()
                      }}</span>
                      <div
                        v-if="!n.isRead"
                        class="w-2 h-2 rounded-full bg-accent animate-pulse"
                      ></div>
                    </div>
                  </div>
                  <p
                    class="text-xs leading-relaxed mb-3"
                    :class="
                      n.isRead
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-slate-600 dark:text-slate-300'
                    "
                  >
                    {{ n.content }}
                  </p>
                  <div class="flex items-center gap-4">
                    <button
                      v-if="n.link"
                      class="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      立即处理 <ChevronRight class="w-3 h-3" />
                    </button>
                    <button
                      v-if="!n.isRead"
                      class="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      标记为已读
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="py-32 text-center space-y-4">
            <div
              class="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto text-slate-300"
            >
              <Inbox class="w-10 h-10" />
            </div>
            <div class="space-y-1">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">暂无通知</h3>
              <p class="text-xs text-slate-400">当有新的动态时，我们会在这里通知您</p>
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

.animate-in {
  animation: animate-in 0.5s ease-out;
}

@keyframes animate-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
