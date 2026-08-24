import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { useMirrorStore } from '@/stores/mirror';

describe('MirrorPortal Integration Suite', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should initialize auth store and verify guest login modal trigger', () => {
    const authStore = useAuthStore();
    expect(authStore.showLoginModal).toBe(false);

    authStore.setShowLoginModal(true);
    expect(authStore.showLoginModal).toBe(true);
  });

  it('should manage mirror stations in store for portal switching', () => {
    const mirrorStore = useMirrorStore();
    expect(mirrorStore.stations).toEqual([]);
    expect(mirrorStore.currentStation).toBeNull();

    mirrorStore.stations = [
      {
        id: 'station-1',
        name: '资源酷',
        displayName: '资源酷 · 官方镜像',
        baseUrl: 'https://zycku.com',
        adapterType: 'ZYCKU',
        status: 'ACTIVE',
        syncStatus: 'IDLE',
        lastSyncAt: null,
        lastSyncDuration: null,
        totalResources: 100,
        iconUrl: null,
        description: null,
        hasAccess: true,
        minPlanPriority: 1,
        createdAt: '2026-01-01',
      },
    ];

    expect(mirrorStore.stations.length).toBe(1);
    expect(mirrorStore.stations[0].displayName).toBe('资源酷 · 官方镜像');
  });
});
