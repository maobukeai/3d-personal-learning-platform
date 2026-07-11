import type { AdminTableAdapter } from '@/components/admin/types';
import { AlertTriangle, CheckCircle2, Plus, RefreshCw, Trash2 } from 'lucide-vue-next';
import { ref } from 'vue';
import api from '@/utils/api';
import { formatDateTime as formatDate } from '@/utils/format';
import { logError } from '@/utils/error';
import {
  messageBox,
  toast,
} from '@/utils/feedbackAdapter'; /* ------------------------------------------------------------------ * * Types — exported so the host view can consume them (same convention * as auditAdapter: canonical types live in the adapter module). * ------------------------------------------------------------------ */
export type ContentTab = 'assets' | 'materials' | 'showcases' | 'plugins';
export type ContentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface ContentUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}
export interface ContentItem {
  id: string;
  title: string;
  description?: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt?: string;
  type?: string;
  category?: string;
  categoryId?: string;
  tags?: string | null;
  thumbnail?: string | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  fileUrl?: string | null;
  videoUrl?: string | null;
  url?: string | null;
  fileSize?: number | null;
  size?: number | null;
  resolution?: string | null;
  downloads?: number;
  likes?: number;
  views?: number;
  comments?: number;
  version?: string;
  compatibility?: string;
  rejectReason?: string | null;
  user?: ContentUser;
}
interface PaginatedContentResponse {
  items?: ContentItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  pages?: number;
  stats?: Record<string, unknown>;
}
interface ContentStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
} /* ------------------------------------------------------------------ * * Shared state — the host view reads these to render the stats strip, * drive the active tab endpoint, and refresh the table after batch ops. * ------------------------------------------------------------------ */
export const activeContentTab = ref<ContentTab>('assets');
export const contentStats = ref<ContentStats | null>(null);
/** Bumped by batch handlers so the host can remount DataTablePage (refetch). */
export const contentRefreshTick = ref(0);
export const bumpContentRefresh = () => {
  contentRefreshTick.value += 1;
}; /** Fetch all items (unpaginated) to compute accurate queue stats even when * the paginated list response omits the `stats` block. */
export const refreshContentStats = async () => {
  try {
    const { data } = await api.get<ContentItem[]>(contentApiPath());
    contentStats.value = {
      total: data.length,
      pending: data.filter((i) => i.status === 'PENDING').length,
      approved: data.filter((i) => i.status === 'APPROVED').length,
      rejected: data.filter((i) => i.status === 'REJECTED').length,
    };
  } catch (error) {
    logError(error, { operation: 'content.fetchStats', component: 'contentAdapter' });
  }
};
const CONTENT_PATHS: Record<ContentTab, string> = {
  assets: '/api/admin/assets',
  materials: '/api/admin/materials',
  showcases: '/api/admin/showcases',
  plugins: '/api/admin/plugins',
};
export const contentApiPath = () => CONTENT_PATHS[activeContentTab.value];
const asItem = (row: ContentItem) =>
  row; /* ------------------------------------------------------------------ * * Formatters — shared with the host view's detail modal so there is a * single source of truth for kind / spec rendering. * ------------------------------------------------------------------ */
const STATUS_LABELS: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已打回',
};
export const statusLabel = (status: string) => STATUS_LABELS[status] || status;
export const itemKind = (item: ContentItem) => {
  const tab = activeContentTab.value;
  if (tab === 'assets') return item.type || 'GLB';
  if (tab === 'materials') return item.resolution || '程序化';
  if (tab === 'showcases') return item.type === 'VIDEO' ? '视频作品' : '图文作品';
  return '应用扩展';
};
export const formatSize = (bytes?: number | null) => {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '-';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
export const specLine = (item: ContentItem) => {
  if (item.fileSize || item.size) return formatSize(item.fileSize || item.size);
  if (item.compatibility || item.version) return item.compatibility || item.version || '';
  return '';
};
export const mediaUrl = (item: ContentItem) =>
  item.thumbnail ||
  item.thumbnailUrl ||
  item.previewUrl ||
  ''; /* ------------------------------------------------------------------ * * Adapter — read + mutate data layer (columns / filters / fetch). * * `crud.create` / `crud.edit` are omitted: the create/edit modals are * tab-specific custom UI (multipart uploads) kept as wrapper code in * the host view. `crud.delete` is declared so DataTablePage renders a * per-row delete action wired to `adapter.delete`. * * `bulkActions` carry real handlers (userAdapter pattern) that hit the * batch-status / delete endpoints and bump `contentRefreshTick` so the * host remounts DataTablePage and refetches. * ------------------------------------------------------------------ */
export const contentAdapter: AdminTableAdapter<ContentItem> = {
  title: '内容管理',
  rowKey: 'id',
  pageSize: 12,
  defaultSort: 'createdAt',
  columns: [
    {
      key: 'title',
      label: '资源名称',
      formatter: (_v, row) => {
        const item = asItem(row);
        return `${item.title} · ${item.description || '暂无描述信息'}`;
      },
    },
    {
      key: 'user',
      label: '创作者',
      formatter: (_v, row) => {
        const u = asItem(row).user;
        return u?.name || u?.email || '匿名';
      },
    },
    {
      key: 'spec',
      label: '规格属性',
      formatter: (_v, row) => {
        const item = asItem(row);
        return `${itemKind(item)} · ${specLine(item) || '—'}`;
      },
    },
    { key: 'status', label: '状态', formatter: (v) => statusLabel(String(v ?? '')) },
    {
      key: 'createdAt',
      label: '提交时间',
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
        { label: '待审核', value: 'PENDING' },
        { label: '已通过', value: 'APPROVED' },
        { label: '已打回', value: 'REJECTED' },
      ],
    },
  ],
  actions: [
    { id: 'create', label: '发布资源', icon: Plus, variant: 'primary', handler: () => {} },
    {
      id: 'refresh',
      label: '刷新',
      icon: RefreshCw,
      variant: 'secondary',
      handler: () => {
        bumpContentRefresh();
      },
    },
  ],
  bulkActions: [
    {
      id: 'batch-approve',
      label: '批量通过',
      icon: CheckCircle2,
      variant: 'primary',
      requireSelection: true,
      handler: async (rows) => {
        const ids = rows.map((r) => String(r.id));
        if (ids.length === 0) return;
        try {
          await messageBox.confirm(`确认批量通过已选择的 ${ids.length} 个资源？`, '批量审核通过', {
            confirmButtonText: '确认通过',
            cancelButtonText: '取消',
            type: 'success',
          });
        } catch {
          return;
        }
        try {
          await api.put(`${contentApiPath()}/batch-status`, { ids, status: 'APPROVED' });
          toast.success('批量审核已通过');
          bumpContentRefresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '批量审核通过失败');
          throw error;
        }
      },
    },
    {
      id: 'batch-reject',
      label: '批量退回',
      icon: AlertTriangle,
      variant: 'danger',
      requireSelection: true,
      handler: async (rows) => {
        const ids = rows.map((r) => String(r.id));
        if (ids.length === 0) return;
        let reason: string;
        try {
          const res = await messageBox.prompt('请输入批量退回理由：', '批量退回审核', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputPattern: /\S+/,
            inputErrorMessage: '请输入理由',
          });
          reason = res.value || '';
        } catch {
          return;
        }
        try {
          await api.put(`${contentApiPath()}/batch-status`, {
            ids,
            status: 'REJECTED',
            rejectReason: reason.trim(),
          });
          toast.success(`已批量打回 ${ids.length} 个资源`);
          bumpContentRefresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '批量退回失败');
          throw error;
        }
      },
    },
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
            `确定要彻底删除已选择的 ${ids.length} 个资源吗？此操作不可逆。`,
            '警告',
            { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' },
          );
        } catch {
          return;
        }
        let successCount = 0;
        let failCount = 0;
        await Promise.all(
          ids.map(async (id) => {
            try {
              await api.delete(`${contentApiPath()}/${id}`);
              successCount++;
            } catch (err) {
              failCount++;
              logError(err, { operation: 'contentBatchDelete', id });
            }
          }),
        );
        if (failCount === 0) {
          toast.success(`成功删除所有已选择的 ${successCount} 个资源`);
        } else if (successCount > 0) {
          toast.warning(`成功删除 ${successCount} 个资源，其中 ${failCount} 个删除失败`);
        } else {
          toast.error('所有选中的资源删除失败，请稍后重试');
        }
        bumpContentRefresh();
      },
    },
  ],
  crud: { delete: { label: '删除', confirm: '确定要彻底删除此资源吗？此操作不可逆。' } },
  fetch: async (params) => {
    const filters = params.filters ?? {};
    const status =
      filters.status && filters.status !== 'ALL' ? (filters.status as string) : undefined;
    const response = await api.get<PaginatedContentResponse | ContentItem[]>(contentApiPath(), {
      params: {
        response: 'paginated',
        page: params.page,
        limit: params.pageSize,
        search: params.search || undefined,
        status,
      },
    });
    const payload = response.data;
    let items: ContentItem[];
    let total: number;
    if (Array.isArray(payload)) {
      items = payload;
      total = payload.length;
    } else {
      items = payload.items || [];
      total = payload.total || 0;
    }
    return { items, total };
  },
  delete: async (ids) => {
    await Promise.all(ids.map((id) => api.delete(`${contentApiPath()}/${id}`)));
  },
};
