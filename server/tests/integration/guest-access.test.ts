import request from 'supertest';
import bcrypt from 'bcryptjs';

jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
  processFull3DOptimization: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';
import { storageService } from '../../src/services/storage.service';

/**
 * Guest read-only sandbox + material view-file integration tests.
 *
 * Covers 6 resource types: asset, material, plugin, software, note, showcase.
 * Verifies that guests can access PUBLIC/APPROVED resources but are blocked
 * from private/pending ones, and that the material view-file endpoint
 * supports ETag/304/Range via res.sendFile for local files.
 */
describe('Guest read-only sandbox (6 resource types)', () => {
  const suffix = Date.now();
  const ownerEmail = `guest-owner-${suffix}@example.com`;
  const password = 'password123';

  let ownerId = '';
  let ownerTeamId = '';
  let ownerCookies: string[] = [];

  const createUser = async (email: string, name: string) => {
    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        name,
        role: 'USER',
      },
    });

    const team = await prisma.team.create({
      data: {
        name: `${email}-personal`,
        type: 'PERSONAL',
        visibility: 'PRIVATE',
        ownerId: user.id,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });

    return { user, team };
  };

  const login = async (email: string) => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.get('Set-Cookie') || [];
  };

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: ownerEmail } });
    const owner = await createUser(ownerEmail, 'Guest Test Owner');
    ownerId = owner.user.id;
    ownerTeamId = owner.team.id;
    ownerCookies = await login(ownerEmail);
  });

  afterAll(async () => {
    // Clean up all test resources created with ownerId
    await prisma.asset.deleteMany({ where: { userId: ownerId } }).catch(() => {});
    await prisma.material.deleteMany({ where: { userId: ownerId } }).catch(() => {});
    await prisma.plugin.deleteMany({ where: { userId: ownerId } }).catch(() => {});
    await prisma.software.deleteMany({ where: { userId: ownerId } }).catch(() => {});
    await prisma.note.deleteMany({ where: { userId: ownerId } }).catch(() => {});
    await prisma.showcase.deleteMany({ where: { userId: ownerId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { ownerId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: ownerEmail } }).catch(() => {});
    await prisma.$disconnect();
  });

  // ── Material view-file (the new endpoint) ──────────────────────────────

  describe('GET /api/materials/:id/view-file', () => {
    let approvedMaterialId = '';
    let pendingMaterialId = '';

    beforeAll(async () => {
      // Create mock StorageConfig record
      await prisma.storageConfig.create({
        data: {
          name: 'Test Cloud Storage',
          bucketName: 'test-bucket',
          endpoint: 'https://s3.us-east-1.amazonaws.com',
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          publicUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com',
          assetType: 'MATERIAL',
          status: 'ACTIVE',
        },
      });

      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      );

      // Mock getObjectStream
      jest
        .spyOn(storageService, 'getObjectStream')
        .mockImplementation(async (config, key, range) => {
          if (key.includes('pending-test')) {
            const err = new Error('NoSuchKey');
            (err as any).$metadata = { httpStatusCode: 404 };
            (err as any).name = 'NoSuchKey';
            throw err;
          }

          let stream: any;
          let contentLength = pngBuffer.length;
          let contentRange: string | undefined = undefined;
          let status = 200;

          if (range) {
            const match = range.match(/bytes=(\d+)-(\d+)/);
            if (match) {
              const start = parseInt(match[1]!, 10);
              const end = parseInt(match[2]!, 10);
              const slice = pngBuffer.slice(start, end + 1);
              const Readable = require('stream').Readable;
              const s = new Readable();
              s.push(slice);
              s.push(null);
              stream = s;
              contentLength = slice.length;
              contentRange = `bytes ${start}-${end}/${pngBuffer.length}`;
              status = 206;
            }
          }

          if (!stream) {
            const Readable = require('stream').Readable;
            const s = new Readable();
            s.push(pngBuffer);
            s.push(null);
            stream = s;
          }

          return {
            stream,
            contentLength,
            contentType: 'image/png',
            contentRange,
            eTag: '"dummy-etag-12345"',
            status,
          };
        });

      const approved = await prisma.material.create({
        data: {
          title: 'Guest Test Approved Material',
          category: 'test',
          fileUrl: `https://test-bucket.s3.us-east-1.amazonaws.com/materials/guest-test-${suffix}.png`,
          status: 'APPROVED',
          userId: ownerId,
        },
      });
      approvedMaterialId = approved.id;

      const pending = await prisma.material.create({
        data: {
          title: 'Guest Test Pending Material',
          category: 'test',
          fileUrl: `https://test-bucket.s3.us-east-1.amazonaws.com/materials/pending-test-${suffix}.png`,
          status: 'PENDING',
          userId: ownerId,
        },
      });
      pendingMaterialId = pending.id;
    });

    afterAll(async () => {
      await prisma.storageConfig.deleteMany({
        where: { name: 'Test Cloud Storage' },
      });
      jest.restoreAllMocks();
    });

    it('returns 400 for invalid type param', async () => {
      const res = await request(app).get(
        `/api/materials/${approvedMaterialId}/view-file?type=invalid`,
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent material ID', async () => {
      const res = await request(app).get('/api/materials/nonexistent-id-12345/view-file?type=file');
      expect(res.status).toBe(404);
    });

    it('blocks guest from viewing a PENDING material (401)', async () => {
      const res = await request(app).get(`/api/materials/${pendingMaterialId}/view-file?type=file`);
      expect(res.status).toBe(401);
    });

    it('allows guest to view an APPROVED material file (200)', async () => {
      const res = await request(app).get(
        `/api/materials/${approvedMaterialId}/view-file?type=file`,
      );
      expect(res.status).toBe(200);
      // res.sendFile sets Accept-Ranges and ETag headers automatically
      expect(res.headers['accept-ranges']).toBeDefined();
      expect(res.headers['etag']).toBeDefined();
      expect(res.headers['cache-control']).toContain('no-cache');
    });

    it('returns 304 on matching If-None-Match ETag', async () => {
      // First request to get the ETag
      const firstRes = await request(app).get(
        `/api/materials/${approvedMaterialId}/view-file?type=file`,
      );
      expect(firstRes.status).toBe(200);
      const etag = firstRes.headers['etag'];
      expect(etag).toBeDefined();

      // Second request with If-None-Match should return 304
      const secondRes = await request(app)
        .get(`/api/materials/${approvedMaterialId}/view-file?type=file`)
        .set('If-None-Match', etag as string);
      expect(secondRes.status).toBe(304);
    });

    it('supports Range requests (206)', async () => {
      const res = await request(app)
        .get(`/api/materials/${approvedMaterialId}/view-file?type=file`)
        .set('Range', 'bytes=0-10');
      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBeDefined();
      expect(res.headers['content-range']).toMatch(/^bytes 0-10\//);
    });

    it('allows owner to view their own PENDING material', async () => {
      const res = await request(app)
        .get(`/api/materials/${pendingMaterialId}/view-file?type=file`)
        .set('Cookie', ownerCookies);
      // Owner can access but the file doesn't exist on disk → 404
      expect(res.status).toBe(404);
    });
  });

  // ── Guest metadata access across 6 resource types ─────────────────────

  describe('Guest metadata access — 6 resource types', () => {
    let approvedAssetId = '';
    let pendingAssetId = '';
    let approvedMaterialId = '';
    let pendingMaterialId = '';
    let approvedPluginId = '';
    let pendingPluginId = '';
    let softwareId = '';
    let publicNoteId = '';
    let privateNoteId = '';
    let approvedShowcaseId = '';
    let pendingShowcaseId = '';

    beforeAll(async () => {
      // Asset — public requires APPROVED + teamId=null
      const approvedAsset = await prisma.asset.create({
        data: {
          title: 'Guest Public Asset',
          url: '/uploads/assets/test.glb',
          type: 'GLB',
          status: 'APPROVED',
          userId: ownerId,
          teamId: null,
        },
      });
      approvedAssetId = approvedAsset.id;

      const pendingAsset = await prisma.asset.create({
        data: {
          title: 'Guest Pending Asset',
          url: '/uploads/assets/pending.glb',
          type: 'GLB',
          status: 'PENDING',
          userId: ownerId,
          teamId: ownerTeamId,
        },
      });
      pendingAssetId = pendingAsset.id;

      // Material
      const approvedMat = await prisma.material.create({
        data: {
          title: 'Guest Public Material',
          category: 'test',
          fileUrl: '/uploads/materials/test.png',
          status: 'APPROVED',
          userId: ownerId,
        },
      });
      approvedMaterialId = approvedMat.id;

      const pendingMat = await prisma.material.create({
        data: {
          title: 'Guest Pending Material',
          category: 'test',
          fileUrl: '/uploads/materials/pending.png',
          status: 'PENDING',
          userId: ownerId,
        },
      });
      pendingMaterialId = pendingMat.id;

      // Plugin
      const approvedPlugin = await prisma.plugin.create({
        data: {
          title: 'Guest Public Plugin',
          fileUrl: '/uploads/plugins/test.zip',
          status: 'APPROVED',
          userId: ownerId,
        },
      });
      approvedPluginId = approvedPlugin.id;

      const pendingPlugin = await prisma.plugin.create({
        data: {
          title: 'Guest Pending Plugin',
          fileUrl: '/uploads/plugins/pending.zip',
          status: 'PENDING',
          userId: ownerId,
        },
      });
      pendingPluginId = pendingPlugin.id;

      // Software (no public routes — all require auth)
      const sw = await prisma.software.create({
        data: {
          title: 'Guest Test Software',
          fileUrl: '/uploads/software/test.exe',
          status: 'APPROVED',
          userId: ownerId,
        },
      });
      softwareId = sw.id;

      // Note — public requires visibility=PUBLIC
      const pubNote = await prisma.note.create({
        data: {
          title: 'Guest Public Note',
          content: 'public content',
          visibility: 'PUBLIC',
          userId: ownerId,
        },
      });
      publicNoteId = pubNote.id;

      const privNote = await prisma.note.create({
        data: {
          title: 'Guest Private Note',
          content: 'private content',
          visibility: 'PRIVATE',
          userId: ownerId,
        },
      });
      privateNoteId = privNote.id;

      // Showcase
      const approvedShowcase = await prisma.showcase.create({
        data: {
          title: 'Guest Public Showcase',
          thumbnailUrl: '/uploads/showcase/thumb.jpg',
          type: 'IMAGE',
          status: 'APPROVED',
          userId: ownerId,
        },
      });
      approvedShowcaseId = approvedShowcase.id;

      const pendingShowcase = await prisma.showcase.create({
        data: {
          title: 'Guest Pending Showcase',
          thumbnailUrl: '/uploads/showcase/pending.jpg',
          type: 'IMAGE',
          status: 'PENDING',
          userId: ownerId,
        },
      });
      pendingShowcaseId = pendingShowcase.id;
    });

    // 1. Asset
    it('asset: guest can view APPROVED public, blocked from PENDING', async () => {
      const pubRes = await request(app).get(`/api/assets/${approvedAssetId}`);
      expect(pubRes.status).toBe(200);

      const privRes = await request(app).get(`/api/assets/${pendingAssetId}`);
      expect([401, 403, 404]).toContain(privRes.status);
    });

    // 2. Material
    it('material: guest can view APPROVED, blocked from PENDING', async () => {
      const pubRes = await request(app).get(`/api/materials/${approvedMaterialId}`);
      expect(pubRes.status).toBe(200);

      const privRes = await request(app).get(`/api/materials/${pendingMaterialId}`);
      expect([401, 403, 404]).toContain(privRes.status);
    });

    // 3. Plugin
    it('plugin: guest can view APPROVED, blocked from PENDING', async () => {
      const pubRes = await request(app).get(`/api/plugins/${approvedPluginId}`);
      expect(pubRes.status).toBe(200);

      const privRes = await request(app).get(`/api/plugins/${pendingPluginId}`);
      expect([401, 403, 404]).toContain(privRes.status);
    });

    // 4. Software (no public routes — requires auth)
    it('software: guest is blocked (requires authentication)', async () => {
      const res = await request(app).get(`/api/softwares/${softwareId}`);
      expect([401, 403]).toContain(res.status);
    });

    // 5. Note
    it('note: guest can view PUBLIC, blocked from PRIVATE', async () => {
      const pubRes = await request(app).get(`/api/notes/${publicNoteId}`);
      expect(pubRes.status).toBe(200);

      const privRes = await request(app).get(`/api/notes/${privateNoteId}`);
      expect([401, 403, 404]).toContain(privRes.status);
    });

    // 6. Showcase
    it('showcase: guest can view APPROVED, blocked from PENDING', async () => {
      const pubRes = await request(app).get(`/api/showcase/${approvedShowcaseId}`);
      expect(pubRes.status).toBe(200);

      const privRes = await request(app).get(`/api/showcase/${pendingShowcaseId}`);
      expect([401, 403, 404]).toContain(privRes.status);
    });
  });
});
