<script setup lang="ts">
import { Cloud, Edit2, Trash2, RefreshCw } from 'lucide-vue-next';
import type { CloudflareDnsRecord } from './DnsRecordForm.vue';

interface Props {
  records: CloudflareDnsRecord[];
  loading?: boolean;
}

withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  (e: 'edit', record: CloudflareDnsRecord): void;
  (e: 'delete', record: CloudflareDnsRecord): void;
}>();

const formatTtl = (ttl: number) => {
  if (ttl === 1) return 'Auto';
  if (ttl >= 86400) return `${ttl / 86400} day`;
  if (ttl >= 3600) return `${ttl / 3600} hr`;
  if (ttl >= 60) return `${ttl / 60} min`;
  return `${ttl}s`;
};
</script>

<template>
  <div class="flex-1 overflow-auto border rounded-xl" style="border-color: var(--border-base)">
    <table class="w-full text-left text-xs">
      <thead class="sticky top-0 z-10" style="background-color: var(--bg-hover)">
        <tr>
          <th class="px-3 py-2 font-bold">类型</th>
          <th class="px-3 py-2 font-bold">名称</th>
          <th class="px-3 py-2 font-bold">内容</th>
          <th class="px-3 py-2 font-bold">代理</th>
          <th class="px-3 py-2 font-bold">TTL</th>
          <th class="px-3 py-2 font-bold text-right">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="6" class="px-3 py-10 text-center" style="color: var(--text-muted)">
            <RefreshCw class="w-4 h-4 animate-spin inline-block" />
          </td>
        </tr>
        <tr v-else-if="records.length === 0">
          <td colspan="6" class="px-3 py-10 text-center" style="color: var(--text-muted)">
            暂无 DNS 记录
          </td>
        </tr>
        <tr
          v-for="record in records"
          :key="record.id"
          class="border-t"
          style="border-color: var(--border-base)"
        >
          <td class="px-3 py-2 font-bold">{{ record.type }}</td>
          <td class="px-3 py-2 font-mono text-[11px]">{{ record.name }}</td>
          <td
            class="px-3 py-2 font-mono text-[11px] max-w-[280px] truncate"
            :title="record.content"
          >
            {{ record.content }}
          </td>
          <td class="px-3 py-2">
            <div class="flex items-center gap-1.5">
              <span
                class="transition-colors duration-200"
                :class="record.proxied ? 'text-orange-500' : 'text-slate-400'"
                :title="record.proxied ? '已代理: 加速并受保护' : '仅 DNS: 绕过代理'"
              >
                <Cloud class="w-4 h-4 inline-block" />
              </span>
              <span
                class="text-[10px] font-bold"
                :style="{
                  color: record.proxied ? 'var(--text-primary)' : 'var(--text-secondary)',
                }"
              >
                {{ record.proxied ? '已代理' : '仅 DNS' }}
              </span>
            </div>
          </td>
          <td class="px-3 py-2">{{ formatTtl(record.ttl) }}</td>
          <td class="px-3 py-2">
            <div class="flex items-center justify-end gap-1">
              <button
                type="button"
                class="p-1 rounded hover:bg-hover cursor-pointer"
                @click="emit('edit', record)"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                class="p-1 rounded hover:bg-rose-50 text-rose-500 cursor-pointer"
                @click="emit('delete', record)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
