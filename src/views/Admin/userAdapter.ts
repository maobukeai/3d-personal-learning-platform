import type { AdminTableAdapter } from '@/components/admin/types';
import { Ban, Plus, RefreshCw, ShieldCheck } from 'lucide-vue-next';
import { ref } from 'vue';
import api from '@/utils/api';
import { formatDateTime as formatDate } from '@/utils/format';
import { logError } from '@/utils/error';
import { messageBox, toast } from '@/utils/feedbackAdapter';

export interface UserStats {
  total: number;
  active: number;
  banned: number;
  admin: number;
}

export const userStats = ref<UserStats | null>(null);
export const userRefreshTick = ref(0);
export const bumpUserRefresh = () => {
  userRefreshTick.value += 1;
};

export const refreshUserStats = async () => {
  try {
    const { data } = await api.get<any[]>('/api/admin/users');
    userStats.value = {
      total: data.length,
      active: data.filter((u) => u.status === 'ACTIVE').length,
      banned: data.filter((u) => u.status === 'BANNED').length,
      admin: data.filter((u) => u.role === 'ADMIN').length,
    };
  } catch (error) {
    logError(error, { operation: 'user.fetchStats', component: 'userAdapter' });
  }
};

export const userAdapter: AdminTableAdapter<any> = {
  title: '用户管理',
  rowKey: 'id',
  pageSize: 20,
  defaultSort: 'createdAt',
  columns: [
    {
      key: 'email',
      label: '用户邮箱',
      sortable: true,
    },
    {
      key: 'name',
      label: '用户名',
      formatter: (v, row) => row.name || '未命名',
    },
    {
      key: 'role',
      label: '角色',
      formatter: (v) => {
        if (v === 'ADMIN') return '管理员';
        if (v === 'INSTRUCTOR') return '教师';
        return '学生';
      },
    },
    {
      key: 'status',
      label: '状态',
      formatter: (v) => (v === 'ACTIVE' ? '活动' : '禁用'),
    },
    {
      key: 'createdAt',
      label: '注册时间',
      sortable: true,
      formatter: (v) => formatDate(v as string).substring(0, 10),
    },
  ],
  filters: [
    {
      key: 'role',
      label: '角色',
      type: 'select',
      defaultValue: 'ALL',
      options: [
        { label: '全部', value: 'ALL' },
        { label: '管理员', value: 'ADMIN' },
        { label: '教师', value: 'INSTRUCTOR' },
        { label: '学生', value: 'USER' },
      ],
    },
  ],
  actions: [
    {
      id: 'create',
      label: '添加用户',
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
        bumpUserRefresh();
      },
    },
  ],
  bulkActions: [
    {
      id: 'batch-ban',
      label: '批量禁用',
      icon: Ban,
      variant: 'danger',
      requireSelection: true,
      handler: async (rows) => {
        const ids = rows.map((r) => String(r.id));
        if (ids.length === 0) return;
        try {
          await api.put('/api/admin/users/batch-status', { ids, status: 'BANNED' });
          toast.success('已批量禁用用户');
          bumpUserRefresh();
        } catch (error) {
          toast.error('操作失败');
        }
      },
    },
  ],
  crud: {
    delete: {
      label: '禁用',
      confirm: '确定要禁用此用户吗？',
    },
  },
  fetch: async (params) => {
    const { data } = await api.get<any[]>('/api/admin/users');
    let list = data;

    const role = params.filters?.role;
    if (role && role !== 'ALL') {
      list = list.filter((u) => u.role === role);
    }

    const q = params.search?.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) => u.email.toLowerCase().includes(q) || (u.name?.toLowerCase().includes(q) ?? false),
      );
    }

    const total = list.length;
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    const items = list.slice(start, end);

    return { items, total };
  },
  delete: async (ids) => {
    await api.put('/api/admin/users/batch-status', { ids, status: 'BANNED' });
  },
};
