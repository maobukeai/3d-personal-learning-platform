import type { AdminTableAdapter } from '@/components/admin/types';
import { Eye, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-vue-next';
import { ref } from 'vue';
import api from '@/utils/api';
import { formatDateTime as formatDate } from '@/utils/format';
import { logError } from '@/utils/error';
import { messageBox, toast } from '@/utils/feedbackAdapter';

export interface TeamStats {
  total: number;
  public: number;
  private: number;
  totalMembers: number;
}

export const teamStats = ref<TeamStats | null>(null);
export const teamRefreshTick = ref(0);
export const bumpTeamRefresh = () => {
  teamRefreshTick.value += 1;
};

export const refreshTeamStats = async () => {
  try {
    const { data } = await api.get<any[]>('/api/admin/teams');
    teamStats.value = {
      total: data.length,
      public: data.filter((t) => t.visibility === 'PUBLIC').length,
      private: data.filter((t) => t.visibility === 'PRIVATE').length,
      totalMembers: data.reduce((sum, t) => sum + (t._count?.members || 0), 0),
    };
  } catch (error) {
    logError(error, { operation: 'team.fetchStats', component: 'teamAdapter' });
  }
};

export const teamAdapter: AdminTableAdapter<any> = {
  title: '团队管理',
  rowKey: 'id',
  pageSize: 12,
  defaultSort: 'createdAt',
  columns: [
    {
      key: 'name',
      label: '团队名称',
      sortable: true,
      formatter: (v, row) => `${row.name} · ${row.description || '暂无描述'}`,
    },
    {
      key: 'visibility',
      label: '可见性',
      formatter: (v) => (v === 'PUBLIC' ? '公开' : '私有'),
    },
    {
      key: 'category',
      label: '分类',
    },
    {
      key: 'createdAt',
      label: '创建时间',
      sortable: true,
      formatter: (v) => formatDate(v as string).substring(0, 10),
    },
  ],
  filters: [
    {
      key: 'visibility',
      label: '可见性',
      type: 'select',
      defaultValue: 'ALL',
      options: [
        { label: '全部', value: 'ALL' },
        { label: '公开', value: 'PUBLIC' },
        { label: '私有', value: 'PRIVATE' },
      ],
    },
  ],
  actions: [
    {
      id: 'create',
      label: '新建团队',
      icon: Plus,
      variant: 'primary',
      handler: () => {},
    },
    {
      id: 'refresh',
      label: '刷新',
      icon: RefreshCw,
      variant: 'secondary',
      handler: () => {
        bumpTeamRefresh();
      },
    },
  ],
  bulkActions: [
    {
      id: 'batch-delete',
      label: '批量删除',
      icon: Trash2,
      variant: 'danger',
      requireSelection: true,
      handler: async (rows) => {
        const ids = rows.map((r) => String(r.id));
        if (ids.length === 0) return;
        try {
          await messageBox.confirm(
            `确定删除选中的 ${ids.length} 个团队吗？此操作不可恢复。`,
            '批量删除确认',
            { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' },
          );
          await api.delete('/api/admin/teams/batch', { data: { ids } });
          toast.success('已批量删除团队');
          bumpTeamRefresh();
        } catch (error) {
          if (error !== 'cancel' && error !== 'close') {
            toast.error('批量删除失败');
          }
        }
      },
    },
  ],
  crud: {
    delete: {
      label: '删除',
      confirm: '确定要删除此团队吗？此操作不可恢复。',
    },
  },
  fetch: async (params) => {
    const { data } = await api.get<any[]>('/api/admin/teams');
    let list = data;

    const vis = params.filters?.visibility;
    if (vis && vis !== 'ALL') {
      list = list.filter((t) => t.visibility === vis);
    }

    const q = params.search?.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false),
      );
    }

    const total = list.length;
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    const items = list.slice(start, end);

    return { items, total };
  },
  delete: async (ids) => {
    await Promise.all(ids.map((id) => api.delete(`/api/admin/teams/${id}`)));
  },
};
