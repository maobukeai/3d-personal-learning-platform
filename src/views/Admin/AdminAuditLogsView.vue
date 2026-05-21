<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { RefreshCw, Terminal, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';

const logs = ref<any[]>([]);
const total = ref(0);
const currentPage = ref(1);
const totalPages = ref(1);
const isLoading = ref(true);

const moduleFilter = ref('');
const actionFilter = ref('');

const modules = [
  { label: '全部模块', value: '' },
  { label: '系统设置', value: 'SETTINGS' },
  { label: '用户管理', value: 'USER' },
  { label: '资产管理', value: 'ASSET' },
  { label: '认证', value: 'AUTH' },
  { label: '内容审核', value: 'MATERIAL' },
  { label: '作品展示', value: 'SHOWCASE' },
];

const fetchLogs = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/audit-logs', {
      params: {
        page: currentPage.value,
        module: moduleFilter.value,
        action: actionFilter.value,
      },
    });
    logs.value = data.logs;
    total.value = data.total;
    totalPages.value = data.pages;
  } catch (error) {
    ElMessage.error('获取审计日志失败');
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString();
};

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    LOGIN: '登录',
    LOGOUT: '登出',
    UPDATE_SETTINGS: '更新设置',
    CREATE_USER: '创建用户',
    UPDATE_USER: '更新用户',
    DELETE_USER: '删除用户',
    RESET_PASSWORD: '重置密码',
    APPROVE_ASSET: '通过资产',
    REJECT_ASSET: '拒绝资产',
    DELETE_ASSET: '删除资产',
    APPROVE_MATERIAL: '通过材料',
    REJECT_MATERIAL: '拒绝材料',
    APPROVE_SHOWCASE: '通过作品',
    REJECT_SHOWCASE: '拒绝作品',
  };
  return labels[action] || action;
};

const getModuleColor = (module: string) => {
  const colors: Record<string, string> = {
    SETTINGS: 'bg-blue-500',
    USER: 'bg-purple-500',
    ASSET: 'bg-orange-500',
    AUTH: 'bg-emerald-500',
    MATERIAL: 'bg-cyan-500',
    SHOWCASE: 'bg-rose-500',
  };
  return colors[module] || 'bg-slate-500';
};

watch([moduleFilter, actionFilter], () => {
  currentPage.value = 1;
  fetchLogs();
});

onMounted(fetchLogs);
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
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-slate-500/10 via-zinc-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-slate-900 text-white shadow-sm border border-slate-700 shrink-0"
          >
            <Terminal class="w-4 h-4" />
          </span>
          <h1 class="text-sm font-black tracking-tight shrink-0" style="color: var(--text-primary)">
            审计日志
          </h1>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <button
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="fetchLogs"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span class="hidden sm:inline">刷新</span>
          </button>
        </div>
      </div>

      <!-- Row 2: 状态与检索 Pills -->
      <div
        class="px-4 sm:px-8 py-2 flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 模块 Pills -->
        <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
          <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button
              v-for="m in modules"
              :key="m.value"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0"
              :class="[
                moduleFilter === m.value
                  ? m.value === 'SETTINGS'
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 ring-1 ring-blue-500/20 font-extrabold shadow-sm'
                    : m.value === 'USER'
                      ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 ring-1 ring-purple-500/20 font-extrabold shadow-sm'
                      : m.value === 'ASSET'
                        ? 'bg-orange-500/10 text-orange-600 border-orange-500/30 ring-1 ring-orange-500/20 font-extrabold shadow-sm'
                        : m.value === 'AUTH'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                          : m.value === 'MATERIAL'
                            ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30 ring-1 ring-cyan-500/20 font-extrabold shadow-sm'
                            : m.value === 'SHOWCASE'
                              ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 ring-1 ring-rose-500/20 font-extrabold shadow-sm'
                              : 'bg-slate-500/10 text-slate-600 border-slate-500/30 ring-1 ring-slate-500/20 font-extrabold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              ]"
              @click="moduleFilter = m.value"
            >
              <span>{{ m.label }}</span>
            </button>
          </div>
        </div>

        <!-- 检索与统计 -->
        <div class="w-full flex items-center justify-between lg:justify-end gap-3 lg:w-auto shrink-0">
          <div class="relative flex-1 lg:flex-none lg:w-64">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">操作类型</span>
            <input
              v-model="actionFilter"
              type="text"
              placeholder="例如: LOGIN, CREATE_USER..."
              class="w-full pl-16 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-slate-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
            共计: <span class="text-slate-900 dark:text-white font-extrabold">{{ total }}</span> 条记录
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex flex-col p-4 sm:p-8">
      <div
        class="flex-1 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] border shadow-sm flex flex-col overflow-hidden transition-colors duration-300"
        style="border-color: var(--border-base)"
      >
        <!-- Desktop Table View -->
        <div class="hidden md:block overflow-x-auto flex-1 scrollbar-hide">
          <table class="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr
                class="border-b bg-slate-50/50 dark:bg-slate-800/50"
                style="border-color: var(--border-base)"
              >
                <th
                  class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  时间
                </th>
                <th
                  class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  操作者
                </th>
                <th
                  class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  模块
                </th>
                <th
                  class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  操作
                </th>
                <th
                  class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  描述
                </th>
                <th
                  class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  IP地址
                </th>
              </tr>
            </thead>
            <tbody class="divide-y" style="border-color: var(--border-base)">
              <!-- Loading Skeleton -->
              <template v-if="isLoading">
                <tr v-for="i in 5" :key="i" class="animate-pulse">
                  <td v-for="j in 6" :key="j" class="px-8 py-6">
                    <div class="h-4 bg-slate-100 dark:bg-white/5 rounded w-full"></div>
                  </td>
                </tr>
              </template>
              <!-- Data Rows -->
              <tr
                v-for="log in logs"
                v-else
                :key="log.id"
                class="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
              >
                <td class="px-8 py-5">
                  <div class="flex flex-col">
                    <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                      formatDate(log.createdAt).split(' ')[0]
                    }}</span>
                    <span class="text-[10px] text-slate-400">{{
                      formatDate(log.createdAt).split(' ')[1]
                    }}</span>
                  </div>
                </td>
                <td class="px-8 py-5">
                  <div class="flex items-center gap-3">
                    <UserAvatar :user="log.user" size="md" />
                    <div class="flex flex-col min-w-0">
                      <span
                        class="text-xs font-black truncate"
                        style="color: var(--text-primary)"
                        >{{ log.user?.name || '系统' }}</span
                      >
                      <span class="text-[10px] text-slate-400 truncate">{{
                        log.user?.email || 'SYSTEM'
                      }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-8 py-5">
                  <span
                    class="px-2.5 py-1 rounded-lg text-[9px] font-black text-white uppercase tracking-wider"
                    :class="getModuleColor(log.module)"
                  >
                    {{ log.module }}
                  </span>
                </td>
                <td class="px-8 py-5">
                  <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                    getActionLabel(log.action)
                  }}</span>
                </td>
                <td class="px-8 py-5">
                  <p class="text-xs text-slate-500 line-clamp-1 max-w-xs">
                    {{ log.description || '-' }}
                  </p>
                </td>
                <td class="px-8 py-5">
                  <span class="text-[10px] font-mono text-slate-400">{{
                    log.ipAddress || 'Unknown'
                  }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Card View -->
        <div class="md:hidden flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          <template v-if="isLoading">
            <div
              v-for="i in 5"
              :key="i"
              class="p-4 rounded-2xl border animate-pulse space-y-3"
              style="border-color: var(--border-base); background-color: var(--bg-app)"
            >
              <div class="flex justify-between items-center">
                <div class="h-4 bg-slate-100 dark:bg-white/5 rounded w-24"></div>
                <div class="h-4 bg-slate-100 dark:bg-white/5 rounded w-16"></div>
              </div>
              <div class="h-4 bg-slate-100 dark:bg-white/5 rounded w-full"></div>
              <div class="h-4 bg-slate-100 dark:bg-white/5 rounded w-2/3"></div>
            </div>
          </template>
          <div
            v-for="log in logs"
            v-else
            :key="log.id"
            class="p-4 rounded-2xl border transition-all"
            style="border-color: var(--border-base); background-color: var(--bg-app)"
          >
            <div class="flex justify-between items-start mb-3">
              <div class="flex items-center gap-3">
                <UserAvatar :user="log.user" size="sm" />
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-black truncate" style="color: var(--text-primary)">{{
                    log.user?.name || '系统'
                  }}</span>
                  <span class="text-[10px] text-slate-400">{{
                    formatDate(log.createdAt).split(' ')[1]
                  }}</span>
                </div>
              </div>
              <span
                class="px-2 py-0.5 rounded-lg text-[8px] font-black text-white uppercase tracking-wider"
                :class="getModuleColor(log.module)"
              >
                {{ log.module }}
              </span>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                  getActionLabel(log.action)
                }}</span>
                <span class="text-[10px] font-mono text-slate-400">{{ log.ipAddress }}</span>
              </div>
              <p class="text-[11px] text-slate-500 leading-relaxed">
                {{ log.description || '-' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div
          class="p-6 border-t flex items-center justify-between bg-slate-50/30 dark:bg-white/5 transition-colors duration-300"
          style="border-color: var(--border-base)"
        >
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            第 {{ currentPage }} / {{ totalPages }} 页
          </div>
          <div class="flex items-center gap-2">
            <button
              :disabled="currentPage === 1"
              class="p-2 rounded-xl border hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 transition-all shadow-sm"
              style="border-color: var(--border-base)"
              @click="currentPage--"
            >
              <ChevronLeft class="w-4 h-4" />
            </button>
            <button
              :disabled="currentPage === totalPages"
              class="p-2 rounded-xl border hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 transition-all shadow-sm"
              style="border-color: var(--border-base)"
              @click="currentPage++"
            >
              <ChevronRight class="w-4 h-4" />
            </button>
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
