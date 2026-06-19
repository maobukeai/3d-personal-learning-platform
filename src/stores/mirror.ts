import { createResourceStationStore } from './createResourceStationStore';

export interface MirrorSource {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  adapterType: string;
  status: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSyncDuration: number | null;
  totalResources: number;
  iconUrl: string | null;
  description: string | null;
  hasAccess: boolean;
  minPlanPriority: number;
  createdAt: string;
}

export interface MirrorCategory {
  id: string;
  sourceId: string;
  externalId: string;
  name: string;
  slug: string | null;
  parentExternalId?: string | null;
  order: number;
  resourceCount: number;
}

export interface MirrorResource {
  id: string;
  sourceId: string;
  externalId: string;
  categoryId: string | null;
  category: { name: string } | null;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  tags: string | null;
  resourceType: string;
  viewCount: number;
  publishedAt: string | null;
  syncedAt: string;
}

// The factory returns an untyped store; we keep the typed entity interfaces
// above so consumers can still `import type { MirrorSource } from '@/stores/mirror'`.
export const useMirrorStore = createResourceStationStore<
  MirrorSource,
  MirrorCategory,
  MirrorResource
>({
  storeId: 'mirror',
  apiBaseUrl: '/api/mirror',
  entitiesPath: 'sources',
  label: 'mirror sources',
});
