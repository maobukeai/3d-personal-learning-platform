export interface ResourceItem {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  resourceType?: string;
  viewCount?: number;
  source?: { displayName: string };
  category?: { id: string; name: string } | null;
  tags?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
}

export interface MirrorItem {
  id: string;
  displayName: string;
  description?: string | null;
  iconUrl?: string | null;
  totalResources: number;
  status: string;
}

export interface PublicPlatformSettings {
  PLATFORM_NAME?: string;
  PLATFORM_LOGO_URL?: string;
  PLATFORM_FAVICON_URL?: string;
}

export interface WebsiteOverview {
  courses: number;
  assets: number;
  materials: number;
  plugins: number;
  softwares: number;
  activeMirrors: number;
  mirroredResources: number;
}

export interface WebsitePreviewItem extends PlatformPreviewItem {
  type: string;
  tags?: string | null;
  updatedAt?: string;
  createdAt?: string;
  popularity?: number;
  sourceId?: string;
  sourceName?: string;
}

export interface WebsiteDiscovery {
  latest: WebsitePreviewItem[];
  trending: WebsitePreviewItem[];
  courses: WebsitePreviewItem[];
  assets: WebsitePreviewItem[];
  materials: WebsitePreviewItem[];
  plugins: WebsitePreviewItem[];
  softwares: WebsitePreviewItem[];
  mirrors: WebsitePreviewItem[];
  featured?: Record<string, WebsitePreviewItem[]>;
}

export interface WebsiteSearchResponse {
  items: WebsitePreviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MirrorCategory {
  id: string;
  externalId: string;
  name: string;
  parentExternalId?: string | null;
  order: number;
  resourceCount: number;
}

export interface MirrorDetail extends MirrorItem {
  name: string;
  lastSyncAt?: string | null;
}

export interface MirrorResourcesResponse {
  resources: ResourceItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ResourceDetail extends ResourceItem {
  contentHtml?: string | null;
  source: { id: string; displayName: string };
}

export interface PlatformPreviewItem {
  id: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  previewUrl?: string | null;
  category?: string | null;
  difficulty?: string | null;
  resolution?: string | null;
  officialPreviewUrl?: string;
}

export interface PlatformListResponse<T> {
  items?: T[];
  assets?: T[];
  plugins?: T[];
}

export const usePlatformApi = () => {
  const { public: publicConfig } = useRuntimeConfig();
  const api = <T>(path: string) => $fetch<T>(`${publicConfig.apiBase}${path}`);
  const withOfficialPreview = <T extends PlatformPreviewItem>(kind: string, item: T): T => ({
    ...item,
    officialPreviewUrl: `${publicConfig.apiBase}/website/media/${kind}/${item.id}`,
  });

  return {
    getHome: () => api<Record<string, unknown>>('/website/home'),
    getWebsiteOverview: () => api<WebsiteOverview>('/website/overview'),
    getWebsiteDiscovery: () => api<WebsiteDiscovery>('/website/discovery'),
    getWebsiteBanners: () =>
      api<
        Array<{
          id: string;
          imageUrl: string;
          title: string;
          subtitle: string;
          buttonLabel: string;
          href: string;
        }>
      >('/website/banners'),
    getWebsiteTrends: (range: '7d' | '30d' = '7d') =>
      api<{
        range: string;
        daily: Array<{ date: string; count: number }>;
        popular: Array<{ key: string; count: number }>;
        searches: Array<{ queryHash: string; count: number }>;
      }>(`/website/trends?range=${range}`),
    trackWebsiteEvent: (event: Record<string, string | undefined>) =>
      $fetch(`${publicConfig.apiBase}/website/events`, { method: 'POST', body: event }).catch(
        () => undefined,
      ),
    searchWebsite: (query: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return api<WebsiteSearchResponse>(`/website/search?${params.toString()}`);
    },
    getPublicCatalogItem: (kind: string, id: string) =>
      api<WebsitePreviewItem & { detail?: boolean; related?: WebsitePreviewItem[] }>(
        `/website/catalog/${kind}/${id}`,
      ),
    getSettings: () => api<PublicPlatformSettings>('/auth/settings'),
    getMirrors: () => api<MirrorItem[]>('/mirror/sources'),
    getMirror: (sourceId: string) => api<MirrorDetail>(`/website/mirrors/${sourceId}`),
    getMirrorCategories: (sourceId: string) =>
      api<MirrorCategory[]>(`/website/mirrors/${sourceId}/categories`),
    getMirrorResources: (
      sourceId: string,
      query: Record<string, string | number | undefined> = {},
    ) => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return api<MirrorResourcesResponse>(
        `/website/mirrors/${sourceId}/resources?${params.toString()}`,
      );
    },
    getMirrorResource: (sourceId: string, resourceId: string) =>
      api<ResourceDetail>(`/website/mirrors/${sourceId}/resources/${resourceId}`),
    getCourses: async () =>
      (await api<PlatformPreviewItem[]>('/courses')).map((item) =>
        withOfficialPreview('course', item),
      ),
    getAssets: async () => {
      const result = await api<PlatformListResponse<PlatformPreviewItem>>('/assets/public?limit=8');
      return {
        ...result,
        assets: (result.assets || []).map((item) => withOfficialPreview('asset', item)),
      };
    },
    getMaterials: async () => {
      const result = await api<PlatformListResponse<PlatformPreviewItem>>('/materials?limit=8');
      return {
        ...result,
        items: (result.items || []).map((item) => withOfficialPreview('material', item)),
      };
    },
    getPlugins: async () => {
      const result = await api<PlatformListResponse<PlatformPreviewItem>>('/plugins?limit=8');
      return {
        ...result,
        plugins: (result.plugins || []).map((item) => withOfficialPreview('plugin', item)),
      };
    },
  };
};
