<script setup lang="ts">
import { Download, History } from 'lucide-vue-next';

interface BillingTransaction {
  id?: string;
  createdAt: string;
  description?: string | null;
  amount?: number | string;
  status?: string;
  paymentMethod?: string | null;
  invoiceNo?: string | null;
}

interface Props {
  transactions: BillingTransaction[];
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'export'): void;
}>();

const statusText = (status?: string) => {
  if (status === 'COMPLETED') return '已支付';
  if (status === 'PENDING') return '处理中';
  return '失败';
};

const mobileStatusText = (status?: string) => {
  return status === 'COMPLETED' ? '已付' : '待付';
};
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between mobile-row">
      <h2 class="text-lg md:text-xl font-bold text-[var(--text-primary)] truncate">账单历史</h2>
      <button
        type="button"
        class="text-xs font-bold text-accent hover:underline flex items-center gap-1.5 cursor-pointer shrink-0"
        @click="emit('export')"
      >
        <Download class="w-4 h-4" /> 导出账单
      </button>
    </div>

    <div
      class="mobile-table rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden shadow-sm"
    >
      <!-- Desktop Table (visible from md) -->
      <table class="hidden md:table w-full text-left border-collapse">
        <thead>
          <tr class="bg-[var(--bg-app)]/50 border-b border-[var(--border-base)]">
            <th
              class="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              日期
            </th>
            <th
              class="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              项目描述
            </th>
            <th
              class="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              金额
            </th>
            <th
              class="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              状态
            </th>
            <th
              class="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              发票号
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-base)]">
          <tr
            v-for="tx in transactions"
            :key="tx.id"
            class="hover:bg-[var(--bg-app)]/30 transition-colors"
          >
            <td class="px-6 py-3.5 text-sm font-medium text-[var(--text-primary)]">
              {{ new Date(tx.createdAt).toLocaleDateString() }}
            </td>
            <td class="px-6 py-3.5">
              <p class="text-sm font-bold text-[var(--text-primary)]">{{ tx.description }}</p>
              <p class="text-[10px] text-[var(--text-muted)] mt-0.5">
                {{ tx.paymentMethod || '-' }}
              </p>
            </td>
            <td class="px-6 py-3.5 text-sm font-black text-[var(--text-primary)]">
              ￥{{ tx.amount }}
            </td>
            <td class="px-6 py-3.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="
                  tx.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : tx.status === 'PENDING'
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-rose-500/10 text-rose-500'
                "
              >
                {{ statusText(tx.status) }}
              </span>
            </td>
            <td class="px-6 py-3.5 text-xs text-[var(--text-muted)] font-mono">
              {{ tx.invoiceNo || '-' }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile List (visible below md) -->
      <div class="md:hidden divide-y divide-[var(--border-base)]">
        <div
          v-for="tx in transactions"
          :key="tx.id"
          class="p-4 flex items-center justify-between gap-4 bg-[var(--bg-card)] mobile-row"
        >
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              <p class="text-xs font-black text-[var(--text-primary)] truncate">
                {{ tx.description }}
              </p>
              <span
                class="px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0"
                :class="
                  tx.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                "
              >
                {{ mobileStatusText(tx.status) }}
              </span>
            </div>
            <p class="text-[10px] text-[var(--text-muted)]">
              {{ new Date(tx.createdAt).toLocaleDateString() }}
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-black text-[var(--text-primary)]">￥{{ tx.amount }}</p>
            <p class="text-[10px] text-[var(--text-muted)] font-mono">
              {{ tx.invoiceNo?.slice(-6) || '-' }}
            </p>
          </div>
        </div>
        <div v-if="transactions.length === 0" class="p-10 text-center opacity-20">
          <History class="w-8 h-8 mx-auto mb-2" />
          <p class="text-xs font-medium">暂无记录</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .mobile-table table {
    font-size: 10px;
  }

  .mobile-table th,
  .mobile-table td {
    padding: 3px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
