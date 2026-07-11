<script setup lang="ts">
import { computed } from 'vue';
import { KeyRound, Plus, Search, Clock, ShieldAlert, Download, Upload } from 'lucide-vue-next';

interface ClockSyncStatus {
  text: string;
  color: string;
  status: 'unknown' | 'perfect' | 'warning' | 'critical';
}

const props = defineProps<{
  accountCount: number;
  categoryCount: number;
  lastBackupTime: string | null;
  searchQuery: string;
  clockSyncStatus: ClockSyncStatus;
  filteredCount: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'openSecurityCenter', tab: 'calibration' | 'export' | 'import'): void;
  (e: 'add'): void;
}>();

const localSearchQuery = computed({
  get: () => props.searchQuery,
  set: (val) => emit('update:searchQuery', val),
});

const backupDateText = computed(() => {
  if (!props.lastBackupTime) return '';
  return new Date(props.lastBackupTime).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
});

const backupTitle = computed(() => {
  if (!props.lastBackupTime) return '尚未进行数据备份';
  return '上次备份时间: ' + new Date(props.lastBackupTime).toLocaleString();
});

const statusPulseClass = computed(() => {
  switch (props.clockSyncStatus.status) {
    case 'perfect':
      return 'bg-emerald-400';
    case 'warning':
      return 'bg-amber-400';
    default:
      return 'bg-rose-400';
  }
});

const statusDotClass = computed(() => {
  switch (props.clockSyncStatus.status) {
    case 'perfect':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    default:
      return 'bg-rose-500';
  }
});
</script>

<template>
  <div
    class="two-fa-header bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-transparent border rounded-xl p-3 mb-3 flex flex-row lg:flex-row justify-between items-start lg:items-center gap-3 animate-fade-in"
    style="border-color: var(--border-base)"
  >
    <div class="mobile-row flex items-center gap-2.5 w-full lg:flex-1 lg:w-auto min-w-0">
      <div
        class="p-1.5 rounded-lg shrink-0"
        style="background-color: rgba(99, 102, 241, 0.1); color: var(--accent, #6366f1)"
      >
        <KeyRound class="h-4 w-4" />
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
        <h1 class="text-sm font-bold tracking-tight shrink-0" style="color: var(--text-primary)">
          2FA 验证码管理器
        </h1>
        <!-- Compact Stats Capsule -->
        <div
          class="flex items-center gap-1.5 text-[10.5px] bg-slate-100 dark:bg-slate-800/60 border px-2 py-0.5 rounded-full select-none w-max max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
          style="border-color: var(--border-base)"
        >
          <span class="text-slate-600 dark:text-slate-300"
            >账号
            <b class="text-indigo-600 dark:text-indigo-300 font-bold ml-0.5">{{
              accountCount
            }}</b></span
          >
          <span class="text-slate-300 dark:text-slate-600">|</span>
          <span class="text-slate-600 dark:text-slate-300"
            >分组
            <b class="text-emerald-600 dark:text-emerald-300 font-bold ml-0.5">{{
              categoryCount
            }}</b></span
          >
          <span class="text-slate-300 dark:text-slate-600">|</span>
          <span
            v-if="lastBackupTime"
            class="text-emerald-600 dark:text-emerald-300 font-semibold flex items-center gap-0.5 animate-fade-in"
            :title="backupTitle"
          >
            <Clock class="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />
            <span>{{ backupDateText }}</span>
          </span>
          <span
            v-else
            class="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-0.5"
            title="尚未进行数据备份"
          >
            <ShieldAlert class="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />
            <span>未备份</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Center: Centered Search Input -->
    <div class="flex justify-center lg:flex-1 w-full lg:w-auto relative">
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input v-model="localSearchQuery" type="text" placeholder="搜索标签、邮箱或备注..." />
      </label>
      <!-- Floating Filter Result Badge -->
      <transition name="el-fade-in-linear">
        <span
          v-if="filteredCount !== totalCount"
          class="absolute -top-2 px-1.5 py-0.5 text-[8.5px] font-bold rounded bg-indigo-600 text-white border border-slate-900 shadow-md select-none shrink-0"
        >
          已过滤 {{ filteredCount }}
        </span>
      </transition>
    </div>

    <!-- Actions Group -->
    <div
      class="mobile-row flex items-center justify-between sm:justify-end gap-1.5 w-full lg:flex-1 lg:justify-end lg:w-auto shrink-0 flex-wrap"
    >
      <!-- Time Sync status check -->
      <button
        class="hover:bg-slate-700/40 border font-semibold px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[10px] bg-transparent"
        style="border-color: var(--border-base)"
        title="点击校对本地时钟与服务器时间"
        @click="emit('openSecurityCenter', 'calibration')"
      >
        <span class="relative flex h-1.5 w-1.5">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            :class="statusPulseClass"
          ></span>
          <span
            class="relative inline-flex rounded-full h-1.5 w-1.5"
            :class="statusDotClass"
          ></span>
        </span>
        <span :class="clockSyncStatus.color" class="text-[10px]">{{ clockSyncStatus.text }}</span>
      </button>

      <div class="flex items-center gap-1.5">
        <!-- Export button -->
        <button
          class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:text-indigo-400"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-secondary);
          "
          title="导出全部数据（账号 + 分组 + 备注），支持密码加密"
          @click="emit('openSecurityCenter', 'export')"
        >
          <Download class="h-3 w-3" />
          <span>导出</span>
        </button>

        <!-- Import button -->
        <button
          class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-500"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-secondary);
          "
          title="从备份 JSON 文件导入，自动还原账号与分组"
          @click="emit('openSecurityCenter', 'import')"
        >
          <Upload class="h-3 w-3" />
          <span>导入</span>
        </button>

        <Button
          variant="primary"
          class="bg-indigo-600 hover:bg-indigo-500 border-none font-semibold px-2.5 py-1 rounded-lg transition-all flex items-center gap-0.5 cursor-pointer text-[11px]"
          @click="emit('add')"
        >
          <Plus class="h-3.5 w-3.5" />
          <span>添加</span>
        </Button>
      </div>
    </div>
  </div>
</template>
