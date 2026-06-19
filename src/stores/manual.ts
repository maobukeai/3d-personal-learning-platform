import { createResourceStationStore } from './createResourceStationStore';

export interface ManualStation {
  id: string;
  name: string;
  displayName: string;
  status: string;
  totalResources: number;
  minPlanPriority: number;
  iconUrl: string | null;
  description: string | null;
  hasAccess: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManualCategory {
  id: string;
  stationId: string;
  name: string;
  slug: string | null;
  parentId?: string | null;
  order: number;
  resourceCount: number;
}

export interface ManualResource {
  id: string;
  stationId: string;
  categoryId: string | null;
  category: { name: string } | null;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  tags: string | null;
  contentHtml: string | null;
  resourceType: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

// The factory returns an untyped store; we keep the typed entity interfaces
// above so consumers can still `import type { ManualStation } from '@/stores/manual'`.
export const useManualStore = createResourceStationStore<
  ManualStation,
  ManualCategory,
  ManualResource
>({
  storeId: 'manual',
  apiBaseUrl: '/api/manual',
  entitiesPath: 'stations',
  label: 'manual stations',
});
