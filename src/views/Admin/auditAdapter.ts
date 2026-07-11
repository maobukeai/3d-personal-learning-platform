import type { AdminTableAdapter } from '@/components/admin/types';
import { CheckCircle2, FolderCog, RefreshCw, XCircle } from 'lucide-vue-next';
import { ref } from 'vue';
import api from '@/utils/api';
import { formatDateTime as formatDate } from '@/utils/format';
import { logError } from '@/utils/error';
import { fetchManagementInsights } from './adminManagementInsights'; /* ------------------------------------------------------------------ * * Types — exported so the host view can consume them. * No sibling components import from AdminAuditsView, so defining the * canonical types here avoids a circular type-only import. * ------------------------------------------------------------------ */
export type AuditTab = 'assets' | 'materials' | 'showcases' | 'plugins' | 'softwares';
export type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface AuditUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}
export interface AuditItem {
  id: string;
  title: string;
  description?: string | null;
  status: AuditStatus;
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
  user?: AuditUser;
}
interface AuditListResponse {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  stats?: { total: number; pending: number; approved: number; rejected: number };
} /* ------------------------------------------------------------------ * * Shared state — the host view reads these to render the stats strip, * detail drawer, and deep-linked items. * ------------------------------------------------------------------ */
export const activeAuditTab = ref<AuditTab>('assets');
export const auditStats = ref<AuditListResponse['stats'] | null>(null);
export const allAuditItems = ref<AuditItem[]>([]);
export const auditItems = ref<AuditItem[]>([]);
const AUDIT_PATHS: Record<AuditTab, string> = {
  assets: '/api/admin/assets',
  materials: '/api/admin/materials',
  showcases: '/api/admin/showcases',
  plugins: '/api/admin/plugins',
  softwares: '/api/admin/softwares',
};
export const auditApiPath = () => AUDIT_PATHS[activeAuditTab.value];
const asAuditItem = (row: AuditItem) =>
  row; /* ------------------------------------------------------------------ * * Formatters — shared with the host view's detail drawer so there is a * single source of truth for kind/metric rendering. * ------------------------------------------------------------------ */
const STATUS_LABELS: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已打回',
};
export const statusLabel = (status: string) => STATUS_LABELS[status] || status;
export const itemKind = (item: AuditItem) => {
  const tab = activeAuditTab.value;
  if (tab === 'assets') return item.type || 'MODEL';
  if (tab === 'materials') return item.category || '材质';
  if (tab === 'plugins') return item.category || '插件';
  if (tab === 'softwares') return item.category || '软件';
  return item.type || '作品';
};
export const metricLine = (item: AuditItem) => {
  const tab = activeAuditTab.value;
  if (tab === 'assets') return `${item.size || item.fileSize || 0} MB`;
  if (tab === 'materials') return item.resolution || `${item.fileSize || 0} MB`;
  if (tab === 'showcases') return `${item.views || 0} 浏览 · ${item.likes || 0} 喜欢`;
  if (tab === 'plugins' || tab === 'softwares')
    return `${item.version || 'v1.0.0'} · ${item.compatibility || '未填兼容性'}`;
  return '待审核';
}; /** Fetch all items (unpaginated) for the stats fallback when the API * response omits the `stats` block (array response). */
export const refreshAuditStats = async () => {
  try {
    const { data } = await api.get<AuditItem[]>(auditApiPath());
    allAuditItems.value = data;
  } catch (error) {
    logError(error, { operation: 'audit.fetchStats', component: 'auditAdapter' });
  }
}; /* ------------------------------------------------------------------ * * Adapter — read-only data layer (columns / filters / fetch). * * `crud` is omitted: the edit modal is tab-specific custom UI kept as * wrapper code in the host view (same pattern as UsersView's drawer). * * `bulkActions` are declared so DataTablePage renders its BulkActionBar * and forwards selection to the host view via the `action` emit. The * handlers are intentional no-ops — all mutation logic lives in the host * view's `@action` listener so it can show the custom reject-reason * dialog and confirm with dynamic counts. * ------------------------------------------------------------------ */
export const auditAdapter: AdminTableAdapter<AuditItem> = {
  title: '内容审核',
  rowKey: 'id',
  pageSize: 36,
  defaultSort: 'createdAt',
  columns: [
    {
      key: 'title',
      label: '资源名称',
      formatter: (_v, row) => {
        const item = asAuditItem(row);
        return `${item.title} · ${item.description || '暂无描述'}`;
      },
    },
    {
      key: 'user',
      label: '作者',
      formatter: (_v, row) => {
        const u = asAuditItem(row).user;
        return u?.name || u?.email || '匿名创作者';
      },
    },
    {
      key: 'spec',
      label: '规格参数',
      formatter: (_v, row) => {
        const item = asAuditItem(row);
        return `${itemKind(item)} · ${metricLine(item)}`;
      },
    },
    { key: 'status', label: '状态', formatter: (v) => statusLabel(String(v ?? '')) },
    { key: 'createdAt', label: '提交时间', formatter: (v) => formatDate(v as string) },
  ],
  filters: [
    {
      key: 'status',
      label: '状态',
      type: 'select',
      defaultValue: 'PENDING',
      options: [
        { label: '待审核', value: 'PENDING' },
        { label: '已通过', value: 'APPROVED' },
        { label: '已打回', value: 'REJECTED' },
        { label: '全部', value: 'ALL' },
      ],
    },
  ],
  actions: [
    {
      id: 'categories',
      label: '分类管理',
      icon: FolderCog,
      variant: 'secondary',
      handler: () => {},
    },
    { id: 'refresh', label: '刷新', icon: RefreshCw, variant: 'secondary', handler: () => {} },
  ],
  bulkActions: [
    {
      id: 'batch-approve',
      label: '批量通过',
      icon: CheckCircle2,
      variant: 'primary',
      requireSelection: true,
      handler: () => {},
    },
    {
      id: 'batch-reject',
      label: '批量打回',
      icon: XCircle,
      variant: 'danger',
      requireSelection: true,
      handler: () => {},
    },
  ],
  fetch: async (params) => {
    const filters = params.filters ?? {};
    const status =
      filters.status && filters.status !== 'ALL' ? (filters.status as string) : undefined;
    const response = await api.get<AuditItem[] | AuditListResponse>(auditApiPath(), {
      params: {
        response: 'paginated',
        page: params.page,
        limit: params.pageSize,
        search: params.search || undefined,
        status,
      },
    });
    const payload = response.data;
    let items: AuditItem[];
    let total: number;
    if (Array.isArray(payload)) {
      items = payload;
      total = payload.length;
      auditStats.value = null;
    } else {
      items = payload.items || [];
      total = payload.total || 0;
      auditStats.value = payload.stats || null;
    }
    auditItems.value = items;
    void fetchManagementInsights(true);
    return { items, total };
  },
};
