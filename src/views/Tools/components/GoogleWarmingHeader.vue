<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Shield, Plus, Calendar, Download, Upload, Key } from 'lucide-vue-next';

const props = defineProps<{
  activeTab: 'warming' | 'manage';
  testMode: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: 'warming' | 'manage'): void;
  (e: 'update:testMode', value: boolean): void;
  (e: 'export'): void;
  (e: 'import-trigger'): void;
  (e: 'password-gen'): void;
  (e: 'add-account'): void;
}>();

const { t } = useI18n();

const setTab = (tab: 'warming' | 'manage') => {
  emit('update:activeTab', tab);
};
</script>

<template>
  <div>
    <!-- Top header (compact) -->
    <div
      class="gw-header !py-2 !mb-2 flex flex-row md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-200 dark:border-slate-800/80"
    >
      <div class="flex flex-col gap-0.5 min-w-0">
        <div class="mobile-row flex flex-wrap items-center gap-2">
          <h1 class="gw-title !text-sm sm:!text-base font-bold">
            {{ t('tools.googleWarming.title') }}
          </h1>
          <span class="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
          <p class="hidden sm:inline text-[10.5px] text-slate-500 max-w-md line-clamp-1">
            {{ t('tools.googleWarming.description') }}
          </p>
        </div>
      </div>

      <div
        class="mobile-row flex items-center justify-between sm:justify-end gap-1.5 w-full md:w-auto shrink-0 flex-wrap"
      >
        <!-- Dev Test Mode toggle -->
        <label
          class="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 text-[10px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none"
        >
          <input
            :checked="props.testMode"
            type="checkbox"
            class="w-3 h-3 rounded accent-violet-500 cursor-pointer"
            @change="emit('update:testMode', ($event.target as HTMLInputElement).checked)"
          />
          <span>测试打卡</span>
        </label>

        <div class="flex items-center gap-1.5">
          <!-- Export -->
          <button
            class="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700/50 text-[11px] font-semibold hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
            title="导出全部账号为 JSON（包含密码、辅助邮箱、地区、状态等完整信息）"
            @click="emit('export')"
          >
            <Download class="w-3.5 h-3.5" />
            <span>导出</span>
          </button>

          <!-- Import -->
          <button
            class="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700/50 text-[11px] font-semibold hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
            title="从 JSON 备份文件导入，完整还原所有字段"
            @click="emit('import-trigger')"
          >
            <Upload class="w-3.5 h-3.5" />
            <span>导入</span>
          </button>

          <!-- Password Generator -->
          <button
            class="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700/50 text-[11px] font-semibold hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
            title="生成随机复杂密码"
            @click="emit('password-gen')"
          >
            <Key class="w-3.5 h-3.5" />
            <span>密码生成</span>
          </button>

          <!-- Add account -->
          <button
            class="bg-violet-600 hover:bg-violet-500 border-none font-semibold px-2.5 py-1.5 rounded transition-all flex items-center gap-0.5 cursor-pointer text-[11px] text-white"
            @click="emit('add-account')"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>{{ t('tools.googleWarming.addAccount') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Tab Switcher -->
    <div class="mobile-row flex border-b border-slate-200 dark:border-slate-800/80 mb-2 gap-1">
      <button
        :class="[
          'px-3 py-1.5 border-b-2 font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5',
          props.activeTab === 'warming'
            ? 'border-violet-500 text-violet-600 dark:text-violet-400'
            : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
        ]"
        @click="setTab('warming')"
      >
        <Calendar class="w-3.5 h-3.5" />
        <span>{{ t('tools.googleWarming.tabWarmingWorkspace') }}</span>
      </button>
      <button
        :class="[
          'px-3 py-1.5 border-b-2 font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5',
          props.activeTab === 'manage'
            ? 'border-violet-500 text-violet-600 dark:text-violet-400'
            : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
        ]"
        @click="setTab('manage')"
      >
        <Shield class="w-3.5 h-3.5" />
        <span>{{ t('tools.googleWarming.tabAccountManage') }}</span>
      </button>
    </div>
  </div>
</template>
