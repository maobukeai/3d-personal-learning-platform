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

export interface MirrorCategory {
  id: string;
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
}

export interface PlatformListResponse<T> {
  items?: T[];
  assets?: T[];
  plugins?: T[];
}

export const usePlatformApi = () => {
  const { public: publicConfig } = useRuntimeConfig();
  const api = <T>(path: string) => $fetch<T>(`${publicConfig.apiBase}${path}`);

  return {
    getHome: () => api<Record<string, unknown>>('/website/home'),
    getWebsiteOverview: () => api<WebsiteOverview>('/website/overview'),
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
    getCourses: () => api<PlatformPreviewItem[]>('/courses'),
    getAssets: () => api<PlatformListResponse<PlatformPreviewItem>>('/assets/public?limit=8'),
    getMaterials: () => api<PlatformListResponse<PlatformPreviewItem>>('/materials?limit=8'),
    getPlugins: () => api<PlatformListResponse<PlatformPreviewItem>>('/plugins?limit=8'),
  };
};
