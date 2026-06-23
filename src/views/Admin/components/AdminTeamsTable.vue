<script setup lang="ts">
import {
  Briefcase,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  Globe,
  Lock,
  MoreHorizontal,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import Card from '@/components/ui/Card.vue';
import type { AdminTeam, PaginationState } from './adminTeamsTypes';
import {
  ownerName,
  visibilityLabel,
  riskLabel,
  riskClass,
  scoreToneClass,
  scoreClass,
  relativeTime,
} from './adminTeamsUtils';

const props = defineProps<{
  teams: AdminTeam[];
  isLoading: boolean;
  selectedIds: string[];
  pagination: PaginationState;
  allPageSelected: boolean;
}>();

const emit = defineEmits<{
  (e: 'row-click', team: AdminTeam): void;
  (e: 'toggle-select', id: string): void;
  (e: 'toggle-select-all'): void;
  (e: 'page-change', page: number): void;
  (e: 'size-change'): void;
  (e: 'edit', team: AdminTeam): void;
  (e: 'add-member', team: AdminTeam): void;
  (e: 'delete', team: AdminTeam): void;
}>();
</script>

<template>
  <div class="content-grid">
    <Card padding="none" class="table-shell-card overflow-hidden">
      <div class="table-wrap flex-1 min-h-0 overflow-auto">
        <el-table
          v-loading="props.isLoading"
          :data="props.teams"
          class="user-table w-full mobile-table"
          row-class-name="table-row"
          @row-click="emit('row-click', $event)"
        >
          <el-table-column width="48">
            <template #header>
              <input
                type="checkbox"
                :checked="props.allPageSelected"
                @change="emit('toggle-select-all')"
                @click.stop
              />
            </template>
            <template #default="{ row }">
              <input
                type="checkbox"
                :checked="props.selectedIds.includes(row.id)"
                @change="emit('toggle-select', row.id)"
                @click.stop
              />
            </template>
          </el-table-column>

          <el-table-column label="团队" min-width="220">
            <template #default="{ row }">
              <div class="team-cell flex items-center gap-2.5">
                <div
                  class="team-avatar w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-purple-50 text-[var(--accent)] border border-purple-100 dark:bg-white/5 dark:border-white/10"
                >
                  <img
                    v-if="row.avatarUrl"
                    :src="row.avatarUrl"
                    alt=""
                    class="w-full h-full object-cover"
                  />
                  <Briefcase v-else class="w-4 h-4 text-purple-500" />
                </div>
                <div class="min-w-0">
                  <strong class="text-sm font-bold truncate text-[var(--text-primary)] block">{{
                    row.name
                  }}</strong>
                  <small class="text-[11px] text-[var(--text-secondary)] truncate block mt-0.5">{{
                    row.category || row.description || '未分类'
                  }}</small>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="负责人" width="160">
            <template #default="{ row }">
              <div class="owner-cell flex items-center gap-2">
                <UserAvatar :user="row.owner" size="xs" />
                <span class="text-sm font-semibold text-[var(--text-primary)] truncate">{{
                  ownerName(row.owner)
                }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="健康" width="150">
            <template #default="{ row }">
              <div class="health-cell flex flex-col gap-1.5 w-full pr-2">
                <div class="flex items-center justify-between gap-1 text-xs">
                  <span
                    class="pill text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0"
                    :class="scoreToneClass(row.metrics?.healthScore)"
                  >
                    {{ row.metrics?.healthScore ?? 100 }}分
                  </span>
                  <span
                    class="pill text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0"
                    :class="riskClass(row.metrics?.riskLevel)"
                  >
                    {{ riskLabel(row.metrics?.riskLevel) }}
                  </span>
                </div>
                <div class="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="scoreClass(row.metrics?.healthScore)"
                    :style="{ width: `${row.metrics?.healthScore ?? 100}%` }"
                  ></div>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="协作规模" width="180">
            <template #default="{ row }">
              <div
                class="dense-metrics flex items-center gap-3 text-xs text-[var(--text-secondary)]"
              >
                <span class="inline-flex items-center gap-1" title="成员数量"
                  ><Users class="w-3.5 h-3.5 text-slate-400" />{{ row._count?.members || 0 }}</span
                >
                <span class="inline-flex items-center gap-1" title="管理员数量"
                  ><Shield class="w-3.5 h-3.5 text-slate-400" />{{ row.metrics?.admins || 0 }}</span
                >
                <span class="inline-flex items-center gap-1" title="完成率"
                  ><CheckCircle2 class="w-3.5 h-3.5 text-slate-400" />{{
                    row.metrics?.completionRate || 0
                  }}%</span
                >
              </div>
            </template>
          </el-table-column>

          <el-table-column label="内容资产" width="180">
            <template #default="{ row }">
              <div
                class="dense-metrics flex items-center gap-3 text-xs text-[var(--text-secondary)]"
              >
                <span class="inline-flex items-center gap-1" title="项目数"
                  ><Briefcase class="w-3.5 h-3.5 text-slate-400" />{{
                    row._count?.projects || 0
                  }}</span
                >
                <span class="inline-flex items-center gap-1" title="任务数"
                  ><ClipboardList class="w-3.5 h-3.5 text-slate-400" />{{
                    row._count?.tasks || 0
                  }}</span
                >
                <span class="inline-flex items-center gap-1" title="资源总数"
                  ><Boxes class="w-3.5 h-3.5 text-slate-400" />{{
                    row.metrics?.resourceTotal || 0
                  }}</span
                >
              </div>
            </template>
          </el-table-column>

          <el-table-column label="待处理" width="150">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <span
                  class="pill text-xs px-1.5 py-0.5 font-bold"
                  :class="
                    (row.metrics?.pendingApplications || 0) +
                      (row.metrics?.pendingInvitations || 0) >
                    0
                      ? 'tone-amber'
                      : 'tone-green'
                  "
                >
                  {{
                    (row.metrics?.pendingApplications || 0) + (row.metrics?.pendingInvitations || 0)
                  }}
                  申请
                </span>
                <span class="text-[11px] text-[var(--text-secondary)]">
                  {{ row.metrics?.overdueTasks || 0 }} 逾期
                </span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="最近活动" min-width="150">
            <template #default="{ row }">
              <div class="flex flex-col gap-0.5 text-xs">
                <span class="font-bold text-[var(--text-primary)]">{{
                  relativeTime(row.metrics?.lastActivityAt || row.updatedAt)
                }}</span>
                <span
                  class="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] mt-0.5"
                >
                  <component
                    :is="row.visibility === 'PUBLIC' ? Globe : Lock"
                    class="w-3 h-3 text-slate-400"
                  />
                  {{ visibilityLabel(row.visibility) }}
                </span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="80" align="right">
            <template #default="{ row }">
              <div @click.stop>
                <el-dropdown trigger="click">
                  <button
                    type="button"
                    class="icon-btn p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <MoreHorizontal class="w-4 h-4 text-slate-500" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="emit('row-click', row)">
                        <Eye class="dropdown-icon" /> 查看详情
                      </el-dropdown-item>
                      <el-dropdown-item @click="emit('edit', row)">
                        <Edit3 class="dropdown-icon" /> 编辑团队
                      </el-dropdown-item>
                      <el-dropdown-item @click="emit('add-member', row)">
                        <UserPlus class="dropdown-icon" /> 添加成员
                      </el-dropdown-item>
                      <el-dropdown-item divided @click="emit('delete', row)">
                        <Trash2 class="dropdown-icon danger" /> 解散团队
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div
        class="pagination-wrap mt-4 flex items-center justify-between p-3 border-t border-slate-100 dark:border-white/5 bg-white/40 dark:bg-transparent mobile-row"
      >
        <el-pagination
          :current-page="props.pagination.page"
          :page-size="props.pagination.limit"
          :page-sizes="[20, 30, 50, 100]"
          :total="props.pagination.total"
          layout="total, sizes, prev, pager, next"
          @current-change="emit('page-change', $event)"
          @size-change="emit('size-change')"
        />
      </div>
    </Card>
  </div>
</template>

<style scoped>
.content-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.table-shell-card {
  min-height: 480px;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.team-cell,
.owner-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.team-avatar {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  color: #7c3aed;
  background: #f3e8ff;
}

.team-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.team-cell strong,
.team-cell small,
.owner-cell strong,
.owner-cell small {
  display: block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-cell strong,
.owner-cell strong {
  color: #0f172a;
  font-size: 14px;
  font-weight: 900;
}

.team-cell small,
.owner-cell small {
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.owner-cell > span {
  min-width: 0;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
}

.health-cell {
  width: 104px;
  display: grid;
  gap: 4px;
}

.pill {
  min-height: 24px;
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 1;
  font-weight: 900;
}

.tone-green {
  color: #047857;
  background: #d1fae5;
  border-color: #a7f3d0;
}

.tone-amber {
  color: #b45309;
  background: #fef3c7;
  border-color: #fde68a;
}

.tone-red {
  color: #be123c;
  background: #ffe4e6;
  border-color: #fecdd3;
}

.tone-slate {
  color: #475569;
  background: #f1f5f9;
  border-color: #e2e8f0;
}

.score-green,
.score-green i,
.score-green b {
  color: #047857;
  background: #10b981;
}

.score-amber,
.score-amber i,
.score-amber b {
  color: #b45309;
  background: #f59e0b;
}

.score-red,
.score-red i,
.score-red b {
  color: #be123c;
  background: #e11d48;
}

.dense-metrics {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dense-metrics span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.dense-metrics svg {
  width: 13px;
  height: 13px;
  color: #94a3b8;
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  margin-right: 6px;
}

.dropdown-icon.danger {
  color: #be123c;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #dbe5f2;
}

.icon-btn:hover {
  color: #0f172a;
  background: #eef3f9;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
}
</style>
