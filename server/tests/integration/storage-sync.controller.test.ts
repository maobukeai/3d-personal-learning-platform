import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock asset-processor to avoid ESM issues
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';
import { storageService } from '../../src/services/storage.service';

describe('Storage Sync Controller Integration', () => {
  const adminUser = {
    email: 'admin-storage-test@example.com',
    password: 'password123',
    name: 'Admin Storage Test User',
  };

  let adminCookies: string[] = [];
  let testConfigId: string = '';

  beforeAll(async () => {
    // Create admin user
    const hashedPassword = await bcrypt.hash(adminUser.password, 10);
    await prisma.user.upsert({
      where: { email: adminUser.email },
      update: { role: 'ADMIN' },
      create: {
        email: adminUser.email,
        password: hashedPassword,
        name: adminUser.name,
        role: 'ADMIN',
      },
    });

    // Login to get cookies
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: adminUser.password });

    expect(loginRes.status).toBe(200);
    adminCookies = loginRes.get('Set-Cookie') || [];

    // Create a mock StorageConfig
    const config = await prisma.storageConfig.create({
      data: {
        name: 'Integration Test Sync Bucket',
        provider: 'cloudflare',
        endpoint: 'https://test-account.r2.cloudflarestorage.com',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        bucketName: 'test-sync-bucket',
        publicUrl: 'https://cdn.example.com',
        limitGb: 10.0,
        usedBytes: 0,
        assetType: 'model',
      },
    });
    testConfigId = config.id;
  });

  afterAll(async () => {
    // Cleanup storage config
    if (testConfigId) {
      await prisma.storageConfig.delete({ where: { id: testConfigId } });
    }
    // Cleanup admin user
    await prisma.user.deleteMany({ where: { email: adminUser.email } });
    await prisma.$disconnect();
  });

  describe('POST /api/admin/storage-configs/:id/sync-size', () => {
    it('should synchronously sync scanned storage size and update usedBytes', async () => {
      // Mock getBucketUsage to simulate S3 scan
      const mockUsageSpy = jest.spyOn(storageService, 'getBucketUsage').mockResolvedValueOnce({
        totalBytes: 5000,
        dashboardBytes: 4000,
        payloadBytes: 4000,
        metadataBytes: 1000,
        objectCount: 10,
        uploadCount: 0,
        source: 'list-objects',
        resolvedBucketName: 'test-sync-bucket',
        scannedBytes: 3500,
        scannedObjectCount: 6,
      });

      const res = await request(app)
        .post(`/api/admin/storage-configs/${testConfigId}/sync-size`)
        .set('Cookie', adminCookies)
        .send({ type: 'scanned' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        usedBytes: 3500,
      });

      // Verify db updated
      const updatedConfig = await prisma.storageConfig.findUnique({
        where: { id: testConfigId },
      });
      expect(updatedConfig?.usedBytes).toBe(3500);
      expect(mockUsageSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ scan: true }),
      );
    });

    it('should synchronously sync official storage size and update usedBytes', async () => {
      // Mock getBucketUsage to simulate official dashboard
      const mockUsageSpy = jest.spyOn(storageService, 'getBucketUsage').mockResolvedValueOnce({
        totalBytes: 5000,
        dashboardBytes: 4500,
        payloadBytes: 4500,
        metadataBytes: 500,
        objectCount: 12,
        uploadCount: 0,
        source: 'list-objects',
        resolvedBucketName: 'test-sync-bucket',
        scannedBytes: null,
        scannedObjectCount: null,
      });

      const res = await request(app)
        .post(`/api/admin/storage-configs/${testConfigId}/sync-size`)
        .set('Cookie', adminCookies)
        .send({ type: 'official' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        usedBytes: 4500,
      });

      // Verify db updated
      const updatedConfig = await prisma.storageConfig.findUnique({
        where: { id: testConfigId },
      });
      expect(updatedConfig?.usedBytes).toBe(4500);
      expect(mockUsageSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ scan: false }),
      );
    });
  });

  describe('POST /api/admin/storage-configs/sync-all-sizes', () => {
    it('should synchronously sync all storage sizes and return stats', async () => {
      // Mock getBucketUsage to simulate official dashboard for bulk sync
      const mockUsageSpy = jest.spyOn(storageService, 'getBucketUsage').mockResolvedValue({
        totalBytes: 6000,
        dashboardBytes: 5000,
        payloadBytes: 5000,
        metadataBytes: 1000,
        objectCount: 15,
        uploadCount: 0,
        source: 'list-objects',
        resolvedBucketName: 'test-sync-bucket',
        scannedBytes: null,
        scannedObjectCount: null,
      });

      // Update test storage config cloudflareApiToken so it is not skipped (requires token present)
      await prisma.storageConfig.update({
        where: { id: testConfigId },
        data: { cloudflareApiToken: 'mock-token' },
      });

      const res = await request(app)
        .post('/api/admin/storage-configs/sync-all-sizes')
        .set('Cookie', adminCookies)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        synced: expect.any(Number),
        skipped: expect.any(Number),
        failed: expect.any(Number),
      });

      // Verify db updated
      const updatedConfig = await prisma.storageConfig.findUnique({
        where: { id: testConfigId },
      });
      expect(updatedConfig?.usedBytes).toBe(5000);

      mockUsageSpy.mockRestore();
    });
  });
});
