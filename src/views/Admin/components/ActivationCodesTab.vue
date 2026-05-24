<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
  Ticket,
  Trash2,
  Copy,
  Search,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getApiErrorMessage } from '@/utils/error';
import api from '@/utils/api';

interface Props {
  activationCodes: ActivationCode[];
  plans: SubscriptionPlan[];
  isLoading: boolean;
}

interface SubscriptionPlan {
  id: string;
  name?: string;
  displayName?: string | null;
  badgeColor?: string | null;
  price?: number | string | null;
}

interface ActivationCodeUser {
  name?: string | null;
  email?: string | null;
}

type CodeStatus = 'ALL' | 'ACTIVE' | 'USED' | 'DISABLED';

interface ActivationCode {
  id: string;
  code: string;
  status: Exclude<CodeStatus, 'ALL'> | string;
  plan?: SubscriptionPlan | null;
  usedBy?: ActivationCodeUser | null;
  bindEmail?: string;
  durationDays?: number;
  expiresAt?: string;
  usedAt?: string;
  createdAt: string;
  description?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const showCodeDialog = ref(false);
const isGeneratingCodes = ref(false);
const codeSearchQuery = ref('');
const codeStatusFilter = ref<CodeStatus>('ALL');

const codeForm = ref({
  planId: '',
  durationPreset: '30',
  durationDays: 30,
  quantity: 5,
  expiresAt: '',
  bindEmail: '',
  description: '',
  prefix: '',
});

watch(
  () => codeForm.value.durationPreset,
  (newVal) => {
    if (newVal !== 'custom') {
      codeForm.value.durationDays = parseInt(newVal, 10);
    }
  },
);

const filteredCodes = computed(() => {
  let result = props.activationCodes;
  if (codeStatusFilter.value !== 'ALL') {
    if (codeStatusFilter.value === 'DISABLED') {
      result = result.filter((code) => code.status !== 'ACTIVE' && code.status !== 'USED');
    } else {
      result = result.filter((code) => code.status === codeStatusFilter.value);
    }
  }
  if (codeSearchQuery.value) {
    const q = codeSearchQuery.value.toLowerCase();
    result = result.filter(
      (code) =>
        code.code.toLowerCase().includes(q) ||
        (code.plan?.displayName || code.plan?.name || '').toLowerCase().includes(q) ||
        (code.usedBy?.name || code.usedBy?.email || '').toLowerCase().includes(q),
    );
  }
  return result;
});

const openCreateCodes = () => {
  codeForm.value = {
    planId: props.plans[0]?.id || '',
    durationPreset: '30',
    durationDays: 30,
    quantity: 5,
    expiresAt: '',
    bindEmail: '',
    description: '',
    prefix: '',
  };
  showCodeDialog.value = true;
};

defineExpose({ openCreateCodes });

const handleGenerateCodes = async () => {
  if (!codeForm.value.planId) {
    ElMessage.warning('请选择订阅计划');
    return;
  }
  isGeneratingCodes.value = true;
  try {
    await api.post('/api/admin/activation-codes', codeForm.value);
    ElMessage.success('激活码生成成功');
    showCodeDialog.value = false;
    emit('refresh');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '生成激活码失败'));
  } finally {
    isGeneratingCodes.value = false;
  }
};

const handleDeleteCode = async (code: ActivationCode) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除/失效该激活码 (${code.code}) 吗？此操作不可恢复。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
    await api.delete(`/api/admin/activation-codes/${code.id}`);
    ElMessage.success('激活码已删除');
    emit('refresh');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '删除失败'));
    }
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(
    () => ElMessage.success('已复制到剪贴板'),
    () => ElMessage.error('复制失败'),
  );
};
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-200">
    <!-- Filter Bar inside Tab Component for high cohesion -->
    <div
      class="py-2.5 flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
    >
      <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
        <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
          <button
v-for="filter in [
              { key: 'ALL', label: '所有激活码', count: activationCodes.length },
              {
                key: 'ACTIVE',
                label: '未使用',
                count: activationCodes.filter((c) => c.status === 'ACTIVE').length,
              },
              {
                key: 'USED',
                label: '已使用',
                count: activationCodes.filter((c) => c.status === 'USED').length,
              },
              {
                key: 'DISABLED',
                label: '已失效',
                count: activationCodes.filter(
                  (c) => c.status !== 'ACTIVE' && c.status !== 'USED',
                ).length,
              },
            ]" :key="filter.key" type="button" class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0" :class="[
              codeStatusFilter === filter.key
                ? filter.key === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                  : filter.key === 'USED'
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/30 ring-1 ring-blue-500/20 font-extrabold shadow-sm'
                    : filter.key === 'DISABLED'
                      ? 'bg-slate-500/10 text-slate-500 border-slate-500/30 ring-1 ring-slate-500/20 font-extrabold shadow-sm'
                      : 'bg-violet-500/10 text-violet-500 border-violet-500/30 ring-1 ring-violet-500/20 font-extrabold shadow-sm'
                : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
            ]" @click="codeStatusFilter = filter.key as CodeStatus">
            <span>{{ filter.label }}</span>
            <span class="opacity-60">({{ filter.count }})</span>
          </button>
        </div>
      </div>

      <div class="w-full flex items-center justify-between md:justify-end gap-3 md:w-auto shrink-0">
        <div class="relative flex-1 md:flex-none md:w-64">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            v-model="codeSearchQuery"
            type="text"
            placeholder="搜索激活码、计划或使用者..."
            class="w-full pl-9 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-violet-500/20 outline-none text-[11px] shadow-sm"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
          已过滤:
          <span class="text-violet-600 font-extrabold">{{ filteredCodes.length }}</span> / 总计:
          {{ activationCodes.length }}
        </div>
      </div>
    </div>

    <!-- Desktop Table View -->
    <div
      class="hidden md:block rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden overflow-x-auto scrollbar-hide"
    >
      <table class="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr class="bg-[var(--bg-app)]/50 border-b border-[var(--border-base)]">
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              激活码
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              订阅计划
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              天数
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              绑定邮箱
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              过期时间
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              备注
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              状态
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              使用者
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              生成时间
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-base)]">
          <tr
            v-for="c in filteredCodes"
            :key="c.id"
            class="hover:bg-[var(--bg-app)]/30 transition-colors"
          >
            <td class="px-4 sm:px-6 py-3.5 sm:py-4">
              <div class="flex items-center gap-2">
                <code
                  class="text-xs font-mono font-bold text-[var(--text-primary)] select-all"
                  >{{ c.code }}</code
                >
                <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 hover:text-accent transition-all" title="复制激活码" @click="copyToClipboard(c.code)">
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :style="{
                  backgroundColor: (c.plan?.badgeColor || '#8b5cf6') + '15',
                  color: c.plan?.badgeColor || '#8b5cf6',
                }"
              >
                {{ c.plan?.displayName || c.plan?.name }}
              </span>
            </td>
            <td
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs font-bold text-[var(--text-secondary)]"
            >
              {{ c.durationDays }} 天
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
              {{ c.bindEmail || '无限制' }}
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
              {{ c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '永久有效' }}
            </td>
            <td
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)] max-w-[150px] truncate"
              :title="c.description"
            >
              {{ c.description || '-' }}
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="
                  c.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : c.status === 'USED'
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'bg-slate-500/10 text-slate-500'
                "
              >
                {{
                  c.status === 'ACTIVE' ? '未使用' : c.status === 'USED' ? '已使用' : '已失效'
                }}
              </span>
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
              <div v-if="c.usedBy">
                <p class="font-bold text-[var(--text-primary)]">
                  {{ c.usedBy.name || '已使用' }}
                </p>
                <p class="text-[9px] text-[var(--text-muted)]">{{ c.usedBy.email }}</p>
              </div>
              <div v-else>-</div>
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
              {{ new Date(c.createdAt).toLocaleString() }}
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4">
              <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-500 transition-all" title="删除" @click="handleDeleteCode(c)">
                <Trash2 class="w-4 h-4" />
              </button>
            </td>
          </tr>
          <tr v-if="filteredCodes.length === 0">
            <td colspan="10" class="px-6 py-16 text-center">
              <div class="flex flex-col items-center gap-3 opacity-20">
                <Ticket class="w-10 h-10" />
                <p class="text-sm font-medium">暂无激活码记录</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View -->
    <div class="md:hidden space-y-4">
      <div
        v-for="c in filteredCodes"
        :key="c.id"
        class="p-5 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] space-y-4 text-xs"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <code
              class="text-xs font-mono font-bold text-[var(--text-primary)] select-all truncate"
              >{{ c.code }}</code
            >
            <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 hover:text-accent transition-all shrink-0" title="复制激活码" @click="copyToClipboard(c.code)">
              <Copy class="w-3.5 h-3.5" />
            </button>
          </div>
          <div class="flex flex-row items-center gap-1.5 shrink-0">
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-bold"
              :style="{
                backgroundColor: (c.plan?.badgeColor || '#8b5cf6') + '15',
                color: c.plan?.badgeColor || '#8b5cf6',
              }"
            >
              {{ c.plan?.displayName || c.plan?.name }}
            </span>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-bold"
              :class="
                c.status === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : c.status === 'USED'
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'bg-slate-500/10 text-slate-500'
              "
            >
              {{
                c.status === 'ACTIVE' ? '未使用' : c.status === 'USED' ? '已使用' : '已失效'
              }}
            </span>
          </div>
        </div>

        <div
          class="grid grid-cols-4 gap-1.5 text-[9px] xs:text-[10px] border-t border-[var(--border-base)] pt-3 min-w-0"
        >
          <div class="min-w-0">
            <span class="text-[var(--text-muted)] block mb-0.5 truncate">天数</span>
            <span class="font-bold text-[var(--text-secondary)] truncate block"
              >{{ c.durationDays }}天</span
            >
          </div>
          <div class="min-w-0">
            <span class="text-[var(--text-muted)] block mb-0.5 truncate">绑定邮箱</span>
            <span
              class="font-bold text-[var(--text-secondary)] truncate block"
              :title="c.bindEmail || '无限制'"
            >
              {{ c.bindEmail || '无限制' }}
            </span>
          </div>
          <div class="min-w-0">
            <span class="text-[var(--text-muted)] block mb-0.5 truncate">过期时间</span>
            <span class="font-bold text-[var(--text-secondary)] truncate block">
              {{ c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '永久有效' }}
            </span>
          </div>
          <div class="min-w-0">
            <span class="text-[var(--text-muted)] block mb-0.5 truncate">生成时间</span>
            <span class="font-bold text-[var(--text-secondary)] truncate block">
              {{ new Date(c.createdAt).toLocaleDateString() }}
            </span>
          </div>
          <div class="col-span-2 border-t border-[var(--border-base)] pt-2.5">
            <span class="text-[var(--text-muted)] block mb-0.5">备注</span>
            <p class="text-[var(--text-secondary)] text-xs line-clamp-2">
              {{ c.description || '-' }}
            </p>
          </div>
          <div
            v-if="c.usedBy"
            class="col-span-2 border-t border-[var(--border-base)] pt-2.5 min-w-0"
          >
            <span class="text-[var(--text-muted)] block mb-0.5">使用者</span>
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-bold text-[var(--text-primary)] text-xs truncate">{{
                c.usedBy.name || '已使用'
              }}</span>
              <span class="text-[var(--text-muted)] text-[10px] font-mono truncate"
                >({{ c.usedBy.email }})</span
              >
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end pt-3 border-t border-[var(--border-base)]">
          <button type="button" class="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold transition-all" @click="handleDeleteCode(c)">
            <Trash2 class="w-3.5 h-3.5" />
            删除激活码
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredCodes.length === 0" class="py-16 text-center">
        <div class="flex flex-col items-center gap-3 opacity-20">
          <Ticket class="w-10 h-10" />
          <p class="text-sm font-medium">暂无激活码记录</p>
        </div>
      </div>
    </div>

    <!-- Code Generate Dialog -->
    <Transition name="fade">
      <div v-if="showCodeDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showCodeDialog = false"
        ></div>
        <div
          class="relative w-full max-w-md p-5 sm:p-8 rounded-3xl shadow-2xl space-y-6 bg-[var(--bg-card)] max-h-[85vh] overflow-y-auto scrollbar-hide"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold text-[var(--text-primary)]">生成激活码</h3>
            <button type="button" class="text-[var(--text-secondary)]" @click="showCodeDialog = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Plan Selection -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >订阅计划</label
            >
            <select
              v-model="codeForm.planId"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            >
              <option v-for="plan in plans" :key="plan.id" :value="plan.id">
                {{ plan.displayName || plan.name }} (￥{{ plan.price }}/月)
              </option>
            </select>
          </div>

          <!-- Duration Preset & Custom Days -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >卡片类型 / 持续时间</label
            >
            <div class="grid grid-cols-5 gap-2">
              <button
v-for="preset in [
                  { label: '月卡', value: '30' },
                  { label: '季卡', value: '90' },
                  { label: '半年', value: '180' },
                  { label: '年卡', value: '365' },
                  { label: '自定义', value: 'custom' },
                ]" :key="preset.value" type="button" class="py-2 text-[10px] font-bold rounded-xl border transition-all" :style="{
                  backgroundColor:
                    codeForm.durationPreset === preset.value
                      ? 'rgba(var(--color-primary-rgb, 14, 165, 233), 0.15)'
                      : 'var(--bg-app)',
                  borderColor:
                    codeForm.durationPreset === preset.value
                      ? 'var(--accent)'
                      : 'var(--border-base)',
                  color:
                    codeForm.durationPreset === preset.value
                      ? 'var(--accent)'
                      : 'var(--text-secondary)',
                }" @click="codeForm.durationPreset = preset.value">
                {{ preset.label }}
              </button>
            </div>
            <!-- Custom Days Input -->
            <div v-if="codeForm.durationPreset === 'custom'" class="pt-2">
              <input
                v-model.number="codeForm.durationDays"
                type="number"
                min="1"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="请输入自定义天数，例如 15 天"
              />
            </div>
            <div v-else class="text-[10px] text-emerald-500 font-bold ml-1">
              已选择: {{ codeForm.durationDays }} 天
            </div>
          </div>

          <!-- Code Prefix -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >激活码前缀 (可选)</label
            >
            <input
              v-model="codeForm.prefix"
              type="text"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="如 'VIP'，格式将为 VIP-PLAN-XXXX..."
            />
          </div>

          <!-- Bind Email -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >绑定邮箱限制 (可选)</label
            >
            <input
              v-model="codeForm.bindEmail"
              type="email"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="仅限指定邮箱用户兑换"
            />
          </div>

          <!-- Expiration Date -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >过期失效日期 (可选)</label
            >
            <input
              v-model="codeForm.expiresAt"
              type="date"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >使用备注 (可选)</label
            >
            <input
              v-model="codeForm.description"
              type="text"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="如 '活动赠送'、'测试激活码'"
            />
          </div>

          <!-- Quantity -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >生成数量</label
            >
            <input
              v-model.number="codeForm.quantity"
              type="number"
              min="1"
              max="100"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="如 5"
            />
          </div>

          <div class="flex gap-3 pt-4">
            <button type="button" class="flex-1 py-3 rounded-2xl font-bold text-sm border border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-all" @click="showCodeDialog = false">
              取消
            </button>
            <button type="button" :disabled="isGeneratingCodes" class="flex-1 py-3 rounded-2xl font-bold text-sm bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50" @click="handleGenerateCodes">
              <template v-if="isGeneratingCodes">
                <div
                  class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                ></div>
                生成中...
              </template>
              <template v-else> 生成激活码 </template>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
