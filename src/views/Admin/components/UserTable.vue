<script setup lang="ts">
import {
  Ban,
  Clock,
  Copy,
  CreditCard,
  Eye,
  Fingerprint,
  KeyRound,
  MonitorSmartphone,
  MoreHorizontal,
  ShieldCheck,
  TimerReset,
  Trash2,
  UserCog,
  Users,
} from 'lucide-vue-next';
import { computed } from 'vue';
import Card from '@/components/ui/Card.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import type { AdminUser } from '../UsersView.vue';
import {
  formatDateShort,
  roleLabel,
  statusLabel,
  lastLoginText,
  loginClass,
  activityText,
  shortUserAgent,
  planLabel,
  roleClass,
  statusClass,
  riskLabel,
  riskClass,
} from './userUtils';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const props = defineProps<{
  users: AdminUser[];
  isLoading: boolean;
  selectedIds: string[];
  pagination: PaginationState;
}>();

const emit = defineEmits<{
  (e: 'update:selectedIds', ids: string[]): void;
  (e: 'rowDetail', user: AdminUser): void;
  (e: 'rowCopyEmail', user: AdminUser): void;
  (e: 'rowEdit', user: AdminUser): void;
  (e: 'rowSubscription', user: AdminUser): void;
  (e: 'rowResetPassword', user: AdminUser): void;
  (e: 'rowRevokeSessions', user: AdminUser): void;
  (e: 'rowRevokeDevices', user: AdminUser): void;
  (e: 'rowToggleStatus', user: AdminUser): void;
  (e: 'rowDelete', user: AdminUser): void;
  (e: 'pageChange', page: number): void;
  (e: 'sizeChange', size: number): void;
}>();

const allPageSelected = computed(
  () => props.users.length > 0 && props.users.every((user) => props.selectedIds.includes(user.id)),
);

const updateSelectedIds = (ids: string[]) => {
  emit('update:selectedIds', ids);
};

const toggleSelectAll = () => {
  const visibleIds = props.users.map((user) => user.id);
  if (allPageSelected.value) {
    updateSelectedIds(props.selectedIds.filter((id) => !visibleIds.includes(id)));
  } else {
    updateSelectedIds(Array.from(new Set([...props.selectedIds, ...visibleIds])));
  }
};

const toggleSelect = (id: string) => {
  updateSelectedIds(
    props.selectedIds.includes(id)
      ? props.selectedIds.filter((selectedId) => selectedId !== id)
      : [...props.selectedIds, id],
  );
};

const handleRowCommand = (command: string, user: AdminUser) => {
  if (command === 'detail') emit('rowDetail', user);
  if (command === 'copy-email') emit('rowCopyEmail', user);
  if (command === 'edit') emit('rowEdit', user);
  if (command === 'subscription') emit('rowSubscription', user);
  if (command === 'reset') emit('rowResetPassword', user);
  if (command === 'revoke') emit('rowRevokeSessions', user);
  if (command === 'revoke-device') emit('rowRevokeDevices', user);
  if (command === 'status') emit('rowToggleStatus', user);
  if (command === 'delete') emit('rowDelete', user);
};
</script>

<template>
  <Card padding="none" class="table-shell-card overflow-hidden">
    <Table
      v-loading="isLoading"
      :data="users"
      class="user-table mobile-table"
      row-key="id"
      @row-dblclick="(row: AdminUser) => emit('rowDetail', row)"
    >
      <TableColumn width="48">
        <template #header>
          <input
            :checked="allPageSelected"
            class="select-checkbox"
            type="checkbox"
            @change="toggleSelectAll"
          />
        </template>
        <template #default="{ row }">
          <input
            :checked="selectedIds.includes(row.id)"
            class="select-checkbox"
            type="checkbox"
            @change.stop="toggleSelect(row.id)"
          />
        </template>
      </TableColumn>

      <TableColumn label="用户" min-width="260">
        <template #default="{ row }">
          <div class="user-cell">
            <UserAvatar :user="row" size="md" />
            <div class="user-main">
              <button
                class="link-button user-name"
                type="button"
                @click.stop="emit('rowDetail', row)"
              >
                {{ row.name || '未命名用户' }}
              </button>
              <span class="email-line">
                {{ row.email }}
                <button title="复制邮箱" type="button" @click.stop="emit('rowCopyEmail', row)">
                  <Copy :size="12" />
                </button>
              </span>
            </div>
          </div>
        </template>
      </TableColumn>

      <TableColumn label="角色" width="118">
        <template #default="{ row }">
          <span class="pill" :class="roleClass(row.role)">
            {{ roleLabel(row.role) }}
          </span>
        </template>
      </TableColumn>

      <TableColumn label="状态" width="104">
        <template #default="{ row }">
          <span class="pill" :class="statusClass(row.status)">
            {{ statusLabel(row.status) }}
          </span>
        </template>
      </TableColumn>

      <TableColumn label="最后登录" min-width="220">
        <template #default="{ row }">
          <div class="stack-cell">
            <span class="pill icon-pill" :class="loginClass(row)">
              <Clock :size="13" />
              {{ lastLoginText(row) }}
            </span>
            <span class="muted-line">
              {{ row.lastLoginIp || '无 IP' }} / {{ shortUserAgent(row.lastLoginUserAgent) }}
            </span>
          </div>
        </template>
      </TableColumn>

      <TableColumn label="活跃 / 会话" min-width="220">
        <template #default="{ row }">
          <div class="activity-cell">
            <span>{{ activityText(row) }}</span>
            <div class="inline-metrics">
              <span>
                <MonitorSmartphone :size="13" />
                {{ row.activeSessions || 0 }} 会话
              </span>
              <span>
                <Fingerprint :size="13" />
                {{ row.trustedDevices || 0 }} 设备
              </span>
            </div>
          </div>
        </template>
      </TableColumn>

      <TableColumn label="内容贡献" min-width="190">
        <template #default="{ row }">
          <div class="contrib-grid">
            <span>{{ row._count?.assets || 0 }} 资产</span>
            <span>{{ row._count?.showcases || 0 }} 作品</span>
            <span>{{ row._count?.feedbacks || 0 }} 反馈</span>
            <span>{{ row._count?.projects || 0 }} 项目</span>
          </div>
        </template>
      </TableColumn>

      <TableColumn label="订阅" width="132">
        <template #default="{ row }">
          <button class="pill sub-button" type="button" @click.stop="emit('rowSubscription', row)">
            {{ planLabel(row) }}
          </button>
        </template>
      </TableColumn>

      <TableColumn label="安全" min-width="170">
        <template #default="{ row }">
          <div class="stack-cell">
            <span class="pill icon-pill" :class="riskClass(row)">
              <ShieldCheck :size="13" />
              {{ riskLabel(row) }}
            </span>
            <span class="muted-line">
              邮箱{{ row.emailVerified ? '已验' : '未验' }} / 2FA{{
                row.twoFactorEnabled ? '开' : '关'
              }}
            </span>
          </div>
        </template>
      </TableColumn>

      <TableColumn label="注册时间" width="132">
        <template #default="{ row }">
          {{ formatDateShort(row.createdAt) }}
        </template>
      </TableColumn>

      <TableColumn label="操作" width="94">
        <template #default="{ row }">
          <Dropdown
            trigger="click"
            @command="(command: unknown) => handleRowCommand(String(command), row)"
          >
            <Button class="icon-button" text>
              <MoreHorizontal :size="18" />
            </Button>
            <template #dropdown>
              <DropdownMenu>
                <DropdownItem command="detail">
                  <Eye :size="14" />
                  查看画像
                </DropdownItem>
                <DropdownItem command="copy-email">
                  <Copy :size="14" />
                  复制邮箱
                </DropdownItem>
                <DropdownItem command="edit">
                  <UserCog :size="14" />
                  编辑资料
                </DropdownItem>
                <DropdownItem command="subscription">
                  <CreditCard :size="14" />
                  订阅管理
                </DropdownItem>
                <DropdownItem command="reset">
                  <KeyRound :size="14" />
                  重置密码
                </DropdownItem>
                <DropdownItem command="revoke">
                  <TimerReset :size="14" />
                  清退登录态
                </DropdownItem>
                <DropdownItem command="revoke-device">
                  <Fingerprint :size="14" />
                  移除可信设备
                </DropdownItem>
                <DropdownItem command="status">
                  <Ban :size="14" />
                  {{ row.status === 'BANNED' ? '恢复账号' : '封禁账号' }}
                </DropdownItem>
                <DropdownItem command="delete" divided>
                  <Trash2 :size="14" />
                  永久删除
                </DropdownItem>
              </DropdownMenu>
            </template>
          </Dropdown>
        </template>
      </TableColumn>

      <template #empty>
        <div class="empty-state">
          <Users :size="30" />
          <span>暂无匹配用户</span>
        </div>
      </template>
    </Table>

    <div class="pagination-wrap mobile-row">
      <span>当前筛选显示 {{ users.length }} 条</span>
      <Pagination
        background
        :current-page="pagination.page"
        :page-size="pagination.limit"
        :page-sizes="[20, 50, 100, 200]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="emit('pageChange', $event)"
        @size-change="emit('sizeChange', $event)"
      />
    </div>
  </Card>
</template>

<style scoped>
.table-shell-card {
  min-height: 480px;
}

.user-table {
  width: 100%;
}

.select-checkbox {
  width: 15px;
  height: 15px;
  accent-color: #7c3aed;
  cursor: pointer;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.user-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.user-main span,
.muted-line {
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
}

.email-line {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 230px;
}

.email-line button {
  width: 19px;
  height: 19px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 5px;
  color: #94a3b8;
  background: transparent;
  cursor: pointer;
  flex: 0 0 auto;
}

.email-line button:hover {
  color: #0369a1;
  background: #e0f2fe;
}

.link-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.user-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
}

.stack-cell,
.activity-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.activity-cell > span {
  color: #1e293b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-metrics {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.inline-metrics span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.contrib-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.sub-button {
  border: 0;
  color: #7c3aed;
  background: #f3e8ff;
  cursor: pointer;
}

.sub-button:hover {
  background: #ede9fe;
}

.icon-pill {
  width: fit-content;
}

.icon-button {
  width: 32px;
  height: 32px;
  padding: 0;
}

.empty-state {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #94a3b8;
  font-weight: 700;
}

.pagination-wrap {
  min-height: 48px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #64748b;
  font-size: 13px;
  border-top: 1px solid #edf2f7;
}
@media (max-width: 720px) {
  .pagination-wrap {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
