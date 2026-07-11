export type FilterType = 'text' | 'select' | 'multiselect' | 'date-range' | 'toggle';

export interface ResourceFilterOption {
  label: string;
  value: any;
}

export interface ResourceFilterConfig {
  key: string;
  label: string;
  type: FilterType;
  defaultValue?: any;
  options?: ResourceFilterOption[];
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

export interface ResourceAction {
  id: string;
  label: string;
  icon?: any;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | string;
  permission?: string;
  requireSelection?: boolean;
  handler: (items: any[]) => void | Promise<void>;
}

export interface ResourceCardField {
  key: string;
  label: string;
  type: 'badge' | 'text' | string;
  class?: string;
}

export interface ResourceCardConfig {
  titleKey?: string;
  subtitleKey?: string;
  imageKey?: string;
  statusKey?: string;
  metricKey?: string;
  metricLabel?: string;
  tagsKey?: string;
  fields?: ResourceCardField[];
}

export interface ResourceItem {
  id: string | number;
  [key: string]: any;
}

export type ResourceStatus = 'idle' | 'loading' | 'empty' | 'success' | 'error';

export interface ResourceFetchParams {
  page: number;
  pageSize: number;
  search?: string;
  sort?: string;
  filters?: Record<string, any>;
  signal?: AbortSignal;
}

export interface ResourceAdapter<T extends ResourceItem = ResourceItem> {
  type?: string;
  title: string;
  singularTitle: string;
  card: ResourceCardConfig;
  filters?: ResourceFilterConfig[];
  sortOptions?: { label: string; value: string }[];
  defaultSort?: string;
  actions?: ResourceAction[];
  bulkActions?: ResourceAction[];
  can?: (permission: string) => boolean;
  fetch: (params: ResourceFetchParams) => Promise<{ items: T[]; total: number }>;
  delete?: (ids: (string | number)[]) => Promise<void>;
}
