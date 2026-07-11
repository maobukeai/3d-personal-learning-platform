import type { AdminTableAdapter } from '@/components/admin/types';
import { Eye, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-vue-next';
import { ref } from 'vue';
import api from '@/utils/api';
import { formatDateTime as formatDate } from '@/utils/format';
import { logError } from '@/utils/error';
import { messageBox, toast } from '@/utils/feedbackAdapter';
import { fetchManagementInsights } from './adminManagementInsights';
import type { Course } from '@/types';

export type CourseStatus = 'PUBLISHED' | 'DRAFT';

export interface CourseStats {
  total: number;
  published: number;
  draft: number;
  totalEnrollments: number;
  totalLessons: number;
}

export const courseStats = ref<CourseStats | null>(null);
export const courseRefreshTick = ref(0);
export const bumpCourseRefresh = () => {
  courseRefreshTick.value += 1;
};

const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: '入门',
  INTERMEDIATE: '进阶',
  ADVANCED: '高级',
};

const difficultyLabel = (diff: string) => DIFFICULTY_LABELS[diff] || diff;

const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: '已发布',
  DRAFT: '草稿',
};

const statusLabel = (status: string) => STATUS_LABELS[status] || status;

export const refreshCourseStats = async () => {
  try {
    const { data } = await api.get<Course[]>('/api/admin/courses');
    courseStats.value = {
      total: data.length,
      published: data.filter((c) => c.status === 'PUBLISHED').length,
      draft: data.filter((c) => c.status === 'DRAFT').length,
      totalEnrollments: data.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0),
      totalLessons: data.reduce((sum, c) => sum + (c.lessons?.length || 0), 0),
    };
  } catch (error) {
    logError(error, { operation: 'course.fetchStats', component: 'courseAdapter' });
  }
};

export const courseAdapter: AdminTableAdapter<Course> = {
  title: '学院课程',
  rowKey: 'id',
  pageSize: 12,
  defaultSort: 'createdAt',
  columns: [
    {
      key: 'title',
      label: '课程名称',
      sortable: true,
      formatter: (v, row) => `${row.title} · ${row.description || '暂无描述'}`,
    },
    {
      key: 'category',
      label: '分类',
      formatter: (v, row) => row.category?.name || '未分类',
    },
    {
      key: 'difficulty',
      label: '难度',
      formatter: (v) => difficultyLabel(String(v ?? '')),
    },
    {
      key: 'status',
      label: '状态',
      formatter: (v) => statusLabel(String(v ?? '')),
    },
    {
      key: 'lessons',
      label: '课时',
      formatter: (v, row) => String(row.lessons?.length || 0),
    },
    {
      key: 'enrollments',
      label: '报名',
      sortable: true,
      formatter: (v, row) => String(row._count?.enrollments || 0),
    },
    {
      key: 'avgRating',
      label: '评分',
      sortable: true,
      formatter: (v, row) => {
        const r = row.avgRating;
        return r !== undefined && r !== null ? Number(r).toFixed(1) : '-';
      },
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
      key: 'status',
      label: '状态',
      type: 'select',
      defaultValue: 'ALL',
      options: [
        { label: '全部', value: 'ALL' },
        { label: '已发布', value: 'PUBLISHED' },
        { label: '草稿', value: 'DRAFT' },
      ],
    },
  ],
  actions: [
    {
      id: 'create',
      label: '新建课程',
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
        bumpCourseRefresh();
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
            `确定删除选中的 ${ids.length} 个课程吗？此操作不可恢复。`,
            '批量删除确认',
            { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' },
          );
          await api.delete('/api/admin/courses/batch', { data: { ids } });
          toast.success('已批量删除课程');
          bumpCourseRefresh();
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
      confirm: '确定要删除此课程吗？关联课时也会一并删除，此操作不可恢复。',
    },
  },
  fetch: async (params) => {
    const { data } = await api.get<Course[]>('/api/admin/courses');
    let list = data;

    const status = params.filters?.status;
    if (status && status !== 'ALL') {
      list = list.filter((c) => c.status === status);
    }

    const q = params.search?.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false),
      );
    }

    const total = list.length;
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    const items = list.slice(start, end);

    // Keep stats fresh alongside table fetches.
    courseStats.value = {
      total: data.length,
      published: data.filter((c) => c.status === 'PUBLISHED').length,
      draft: data.filter((c) => c.status === 'DRAFT').length,
      totalEnrollments: data.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0),
      totalLessons: data.reduce((sum, c) => sum + (c.lessons?.length || 0), 0),
    };
    void fetchManagementInsights(true);

    return { items, total };
  },
  delete: async (ids) => {
    await Promise.all(ids.map((id) => api.delete(`/api/admin/courses/${id}`)));
  },
};
