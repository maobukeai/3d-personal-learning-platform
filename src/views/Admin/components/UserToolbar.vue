<script setup lang="ts">
import { Ban, CheckCircle2, Download, TimerReset, UserCog } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Tabs from '@/components/ui/Tabs.vue';
import type { Component } from 'vue';
import type {
  RoleFilter,
  StatusFilter,
  ActivityFilter,
  UserRole,
  UserStatus,
} from '../UsersView.vue';

interface PresetOption {
  label: string;
  value: string;
  icon?: Component;
}

interface FilterOption<T> {
  value: T;
  label: string;
}

const props = defineProps<{
  roleOptions: FilterOption<RoleFilter>[];
  statusOptions: FilterOption<StatusFilter>[];
  activityOptions: FilterOption<ActivityFilter>[];
  presetTabOptions: PresetOption[];
  selectedCount: number;
}>();

const roleFilter = defineModel<RoleFilter>('roleFilter', { required: true });
const statusFilter = defineModel<StatusFilter>('statusFilter', { required: true });
const activityFilter = defineModel<ActivityFilter>('activityFilter', { required: true });
const activePresetKey = defineModel<string>('activePresetKey', { required: true });

const emit = defineEmits<{
  (e: 'export'): void;
  (e: 'batchUpdate', payload: { role?: UserRole; status?: UserStatus }): void;
  (e: 'batchRevokeSessions'): void;
  (e: 'clearSelection'): void;
}>();
</script>

<template>
  <Card padding="sm" class="workbench-toolbar-card">
    <div class="toolbar-top mobile-row">
      <div class="overflow-x-auto scrollbar-hide shrink-0 max-w-full mobile-row">
        <Tabs v-model="activePresetKey" :options="presetTabOptions" size="sm" />
      </div>

      <div class="toolbar-actions mobile-row">
        <el-select v-model="statusFilter" size="small" style="width: 100px">
          <el-option
            v-for="option in props.statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-select v-model="roleFilter" size="small" style="width: 110px">
          <el-option
            v-for="option in props.roleOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-select v-model="activityFilter" size="small" style="width: 110px">
          <el-option
            v-for="option in props.activityOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <Button variant="secondary" size="sm" :icon="Download" @click="emit('export')">
          导出
        </Button>
      </div>
    </div>

    <div v-if="selectedCount > 0" class="batch-bar mobile-row">
      <div>
        已选 <strong>{{ selectedCount }}</strong> 个用户
      </div>
      <div class="batch-actions mobile-row">
        <el-button size="small" @click="emit('batchUpdate', { status: 'ACTIVE' })">
          <CheckCircle2 :size="14" />
          恢复
        </el-button>
        <el-button size="small" @click="emit('batchUpdate', { status: 'BANNED' })">
          <Ban :size="14" />
          封禁
        </el-button>
        <el-dropdown
          trigger="click"
          @command="
            (command: unknown) => emit('batchUpdate', { role: String(command) as UserRole })
          "
        >
          <el-button size="small">
            <UserCog :size="14" />
            改角色
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="USER">普通用户</el-dropdown-item>
              <el-dropdown-item command="INSTRUCTOR">导师</el-dropdown-item>
              <el-dropdown-item command="ADMIN">管理员</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" @click="emit('batchRevokeSessions')">
          <TimerReset :size="14" />
          清退会话
        </el-button>
        <el-button size="small" text @click="emit('clearSelection')">取消选择</el-button>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.toolbar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex: 0 0 auto;
}

.toolbar-actions :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.batch-bar {
  margin: 10px 0 0;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #334155;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
}

.batch-actions,
.drawer-actions,
.drawer-danger {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.batch-actions :deep(.el-button),
.drawer-actions :deep(.el-button),
.drawer-danger :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 1100px) {
  .toolbar-top {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 720px) {
  .toolbar-top,
  .batch-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-actions {
    width: 100%;
  }

  .toolbar-actions :deep(.el-button),
  .toolbar-actions :deep(.el-select) {
    flex: 1 1 calc(50% - 4px);
    min-width: 100px;
  }
}
</style>
