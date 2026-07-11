import request from 'supertest';
import bcrypt from 'bcryptjs';

jest.mock('../../src/utils/asset-processor', () => ({
  process3DAsset: jest.fn().mockResolvedValue({}),
  processFull3DOptimization: jest.fn().mockResolvedValue({
    buffer: Buffer.from(''),
    analysis: null,
    originalSizeBytes: 0,
    compressedSizeBytes: 0,
    compressionRatio: 0,
  }),
  optimize3DAsset: jest.fn().mockResolvedValue(undefined),
  executeAssetAnalysis: jest.fn().mockResolvedValue(null),
  executeAssetProcessing: jest.fn().mockResolvedValue(null),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';
import { storageService } from '../../src/services/storage.service';

describe('Asset Governance & Guest Sandbox Integration Tests', () => {
  const suffix = Date.now();
  const ownerEmail = `gov-owner-${suffix}@example.com`;
  const viewerEmail = `gov-viewer-${suffix}@example.com`;
  const password = 'password123';

  let ownerId = '';
  let ownerTeamId = '';
  let viewerCookies: string[] = [];
  let ownerCookies: string[] = [];

  let publicAssetId = '';
  let privateAssetId = '';
  let localAssetId = '';

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
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
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
    // Clean up
    await prisma.asset.deleteMany({
      where: {
        title: { startsWith: 'GovTest' },
      },
    });

    // Create mock StorageConfig record
    await prisma.storageConfig.create({
      data: {
        name: 'Test Cloud Storage',
        bucketName: 'test-bucket',
        endpoint: 'https://s3.us-east-1.amazonaws.com',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        publicUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com',
        assetType: 'ASSET',
        status: 'ACTIVE',
      },
    });

    const body = 'dummy glb binary content for testing range request';
    const glbBuffer = Buffer.from(body);

    // Mock getObjectStream
    jest.spyOn(storageService, 'getObjectStream').mockImplementation(async (config, key, range) => {
      let stream: any;
      let contentLength = glbBuffer.length;
      let contentRange: string | undefined = undefined;
      let status = 200;

      if (range) {
        const match = range.match(/bytes=(\d+)-(\d+)/);
        if (match) {
          const start = parseInt(match[1]!, 10);
          const end = parseInt(match[2]!, 10);
          const slice = glbBuffer.slice(start, end + 1);
          const Readable = require('stream').Readable;
          const s = new Readable();
          s.push(slice);
          s.push(null);
          stream = s;
          contentLength = slice.length;
          contentRange = `bytes ${start}-${end}/${glbBuffer.length}`;
          status = 206;
        }
      }

      if (!stream) {
        const Readable = require('stream').Readable;
        const s = new Readable();
        s.push(glbBuffer);
        s.push(null);
        stream = s;
      }

      return {
        stream,
        contentLength,
        contentType: 'model/gltf-binary',
        contentRange,
        eTag: '"dummy-etag-12345"',
        status,
      };
    });

    const owner = await createUser(ownerEmail, 'Gov Owner');
    ownerId = owner.user.id;
    ownerTeamId = owner.team.id;

    await createUser(viewerEmail, 'Gov Viewer');

    ownerCookies = await login(ownerEmail);
    viewerCookies = await login(viewerEmail);

    // Create public asset
    const pubAsset = await prisma.asset.create({
      data: {
        title: 'GovTest Public Asset',
        type: 'GLB',
        url: 'https://cdn.example.com/uploads/assets/public-test.glb',
        thumbnail: 'https://cdn.example.com/uploads/assets/public-thumb.png',
        status: 'APPROVED',
        userId: ownerId,
        size: 1.5,
      },
    });
    publicAssetId = pubAsset.id;

    // Create private asset (attached to owner's private team)
    const privAsset = await prisma.asset.create({
      data: {
        title: 'GovTest Private Asset',
        type: 'GLB',
        url: 'https://cdn.example.com/uploads/assets/private-test.glb',
        thumbnail: 'https://cdn.example.com/uploads/assets/private-thumb.png',
        status: 'APPROVED',
        userId: ownerId,
        teamId: ownerTeamId,
        size: 2.3,
      },
    });
    privateAssetId = privAsset.id;

    const locAsset = await prisma.asset.create({
      data: {
        title: 'GovTest Local Asset',
        type: 'GLB',
        url: `https://test-bucket.s3.us-east-1.amazonaws.com/assets/local-test.glb`,
        status: 'APPROVED',
        userId: ownerId,
        teamId: ownerTeamId,
        size: 0.1,
      },
    });
    localAssetId = locAsset.id;
  });

  afterAll(async () => {
    await prisma.storageConfig.deleteMany({
      where: { name: 'Test Cloud Storage' },
    });
    jest.restoreAllMocks();

    await prisma.asset.deleteMany({
      where: {
        title: { startsWith: 'GovTest' },
      },
    });

    await prisma.team.deleteMany({
      where: {
        name: { in: [`${ownerEmail}-personal`, `${viewerEmail}-personal`] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: { in: [ownerEmail, viewerEmail] },
      },
    });
  });

  describe('Guest access checks', () => {
    it('Guest can access public approved asset and get raw URLs', async () => {
      const res = await request(app).get(`/api/assets/${publicAssetId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(publicAssetId);
      expect(res.body.url).toBe('https://cdn.example.com/uploads/assets/public-test.glb');
      expect(res.body.thumbnail).toBe('https://cdn.example.com/uploads/assets/public-thumb.png');
    });

    it('Guest is blocked from private approved asset', async () => {
      const res = await request(app).get(`/api/assets/${privateAssetId}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Authenticated user access checks', () => {
    it('Unauthorized logged-in user is blocked from private asset', async () => {
      const res = await request(app)
        .get(`/api/assets/${privateAssetId}`)
        .set('Cookie', viewerCookies);
      expect(res.status).toBe(403);
    });

    it('Authorized user (owner) can access private asset and URLs are signed/replaced', async () => {
      const res = await request(app)
        .get(`/api/assets/${privateAssetId}`)
        .set('Cookie', ownerCookies);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(privateAssetId);
      // Since it is private, the URL is processed by signAssetUrls.
      // In this test config (no active R2 storage config matched), it will fallback to the proxy URL path
      expect(res.body.url).toContain(`/api/assets/${privateAssetId}/view-file`);
      expect(res.body.url).toContain(`type=model`);
      expect(res.body.url).toContain(`signature=`);
      expect(res.body.thumbnail).toContain(`/api/assets/${privateAssetId}/view-file`);
      expect(res.body.thumbnail).toContain(`type=thumbnail`);
      expect(res.body.thumbnail).toContain(`signature=`);
    });
  });

  describe('Backend proxy view-file checks', () => {
    it('Should block unauthorized view-file request', async () => {
      const res = await request(app)
        .get(`/api/assets/${privateAssetId}/view-file?type=model`)
        .set('Cookie', viewerCookies);
      expect(res.status).toBe(403);
    });

    it('Should proxy local file with correct headers, ETag, and Cache-Control', async () => {
      const res = await request(app)
        .get(`/api/assets/${localAssetId}/view-file?type=model`)
        .set('Cookie', ownerCookies);
      expect(res.status).toBe(200);
      expect(res.header['cache-control']).toContain('private');
      expect(res.header['cache-control']).toContain('no-cache');
      expect(res.header['cache-control']).toContain('must-revalidate');
      expect(res.header['content-type']).toBe('model/gltf-binary');
      expect(res.header['etag']).toBeDefined();
      expect(res.text).toBe('dummy glb binary content for testing range request');
    });

    it('Should support Range request for local file proxying', async () => {
      const res = await request(app)
        .get(`/api/assets/${localAssetId}/view-file?type=model`)
        .set('Cookie', ownerCookies)
        .set('Range', 'bytes=0-10');
      expect(res.status).toBe(206);
      expect(res.header['content-range']).toBeDefined();
      expect(res.header['content-range']).toContain('bytes 0-10/');
      expect(res.text).toBe('dummy glb b');
    });
  });
});
