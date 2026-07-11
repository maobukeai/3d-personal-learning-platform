<script setup lang="ts">
import { Copy } from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import UserAvatar from '@/components/UserAvatar.vue';
import Modal from '@/components/ui/Modal.vue';
import { useAuditLogHelpers } from '@/composables/useAuditLogHelpers';
import type { User } from '@/types';

export interface AuditLog {
  id: string;
  module: string;
  action: string;
  description?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: User | null;
}

defineProps<{
  modelValue: boolean;
  log: AuditLog | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const {
  formatDateTime,
  getModuleLabel,
  getModuleTone,
  getActionLabel,
  getSeverityLabel,
  getAgentLabel,
  getActorName,
  prettyJson,
} = useAuditLogHelpers();

const copyValue = async (value: string, label = '内容') => {
  try {
    await navigator.clipboard.writeText(value);
    ElMessage.success(`${label}已复制`);
  } catch {
    ElMessage.warning('当前浏览器不允许复制');
  }
};
</script>

<template>
  <Modal :show="modelValue" size="xl" @close="emit('update:modelValue', false)">
    <template #header>
      <div v-if="log" class="flex items-center justify-between w-full pr-8 text-left">
        <div>
          <span
            class="status-pill inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1"
            :class="getModuleTone(log.module)"
          >
            {{ getModuleLabel(log.module) }}
          </span>
          <h2 class="text-lg font-black text-[var(--text-primary)] leading-tight">
            {{ getActionLabel(log.action) }}
          </h2>
          <div class="flex items-center gap-1.5 mt-1">
            <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono select-all">
              {{ log.id }}
            </span>
            <button
              type="button"
              class="p-1 rounded text-slate-400 hover:text-accent hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="复制 ID"
              @click="copyValue(log.id, '日志 ID')"
            >
              <Copy class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="log" class="space-y-4 text-left">
      <div class="detail-grid">
        <div>
          <span>时间</span><b>{{ formatDateTime(log.createdAt) }}</b>
        </div>
        <div>
          <span>风险等级</span><b>{{ getSeverityLabel(log.action) }}风险</b>
        </div>
        <div>
          <span>IP</span><b>{{ log.ipAddress || '-' }}</b>
        </div>
        <div>
          <span>设备</span><b>{{ getAgentLabel(log.userAgent) }}</b>
        </div>
      </div>

      <section class="detail-section">
        <h3>操作者</h3>
        <div class="drawer-user flex items-center gap-2.5 mt-2">
          <UserAvatar :user="log.user" size="md" />
          <div>
            <strong class="block text-sm font-black text-[var(--text-primary)]">{{
              getActorName(log.user)
            }}</strong>
            <span class="block text-xs text-[var(--text-secondary)] mt-0.5">{{
              log.user?.email || 'SYSTEM'
            }}</span>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <h3>描述</h3>
        <p class="text-sm text-[var(--text-secondary)] mt-1.5">
          {{ log.description || '无' }}
        </p>
      </section>

      <section class="detail-section">
        <h3>User Agent</h3>
        <p
          class="break-text text-xs text-[var(--text-secondary)] mt-1.5 font-medium leading-relaxed"
        >
          {{ log.userAgent || '无' }}
        </p>
      </section>

      <div class="json-grid">
        <section class="detail-section">
          <h3>旧值</h3>
          <pre>{{ prettyJson(log.oldValue) }}</pre>
        </section>
        <section class="detail-section">
          <h3>新值</h3>
          <pre>{{ prettyJson(log.newValue) }}</pre>
        </section>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.detail-grid div,
.detail-section {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  padding: 10px;
}

.detail-grid span,
.detail-section h3 {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 950;
}

.detail-grid b,
.detail-section p {
  margin-top: 5px;
  display: block;
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.6;
}

.drawer-user {
  gap: 10px;
  margin-top: 8px;
}

.drawer-user strong {
  font-size: 13px;
  font-weight: 950;
}

.drawer-user span {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 12px;
}

.break-text {
  word-break: break-word;
}

.json-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-section pre {
  max-height: 340px;
  margin: 8px 0 0;
  overflow: auto;
  border-radius: 8px;
  background: #111827;
  padding: 10px;
  color: #dbeafe;
  font-size: 11px;
  line-height: 1.6;
}

.status-pill {
  min-height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border: 1px solid;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
}

@media (max-width: 980px) {
  .detail-grid,
  .json-grid {
    grid-template-columns: 1fr;
  }
}
</style>
