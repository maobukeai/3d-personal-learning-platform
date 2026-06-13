import request from 'supertest';
import bcrypt from 'bcryptjs';

jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';

describe('Content access boundaries', () => {
  const suffix = Date.now();
  const ownerEmail = `content-owner-${suffix}@example.com`;
  const viewerEmail = `content-viewer-${suffix}@example.com`;
  const password = 'password123';

  let ownerId = '';
  let ownerTeamId = '';
  let viewerCookies: string[] = [];
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
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });

    const owner = await createUser(ownerEmail, 'Content Owner');
    const viewer = await createUser(viewerEmail, 'Content Viewer');
    ownerId = owner.user.id;
    ownerTeamId = owner.team.id;

    ownerCookies = await login(ownerEmail);
    viewerCookies = await login(viewer.user.email);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await prisma.$disconnect();
  });

  it('does not let another user download or like a pending asset', async () => {
    const pendingAsset = await prisma.asset.create({
      data: {
        title: 'Pending private asset',
        url: '/uploads/assets/pending.glb',
        type: 'GLB',
        status: 'PENDING',
        userId: ownerId,
        teamId: ownerTeamId,
      },
    });

    const downloadRes = await request(app)
      .post(`/api/assets/${pendingAsset.id}/download`)
      .set('Cookie', viewerCookies);
    expect(downloadRes.status).toBe(404);

    const likeRes = await request(app)
      .post(`/api/assets/${pendingAsset.id}/like`)
      .set('Cookie', viewerCookies);
    expect(likeRes.status).toBe(404);

    const [asset, likeCount] = await Promise.all([
      prisma.asset.findUnique({ where: { id: pendingAsset.id }, select: { downloads: true, likes: true } }),
      prisma.assetLike.count({ where: { assetId: pendingAsset.id } }),
    ]);
    expect(asset?.downloads).toBe(0);
    expect(asset?.likes).toBe(0);
    expect(likeCount).toBe(0);
  });

  it('keeps the denormalized asset like counter in sync when toggling', async () => {
    const approvedAsset = await prisma.asset.create({
      data: {
        title: 'Approved public asset',
        url: '/uploads/assets/approved.glb',
        type: 'GLB',
        status: 'APPROVED',
        userId: ownerId,
        teamId: ownerTeamId,
      },
    });

    const likedRes = await request(app)
      .post(`/api/assets/${approvedAsset.id}/like`)
      .set('Cookie', viewerCookies);
    expect(likedRes.status).toBe(200);
    expect(likedRes.body).toMatchObject({ liked: true, likes: 1 });

    const unlikedRes = await request(app)
      .post(`/api/assets/${approvedAsset.id}/like`)
      .set('Cookie', viewerCookies);
    expect(unlikedRes.status).toBe(200);
    expect(unlikedRes.body).toMatchObject({ liked: false, likes: 0 });

    const [asset, likeCount] = await Promise.all([
      prisma.asset.findUnique({ where: { id: approvedAsset.id }, select: { likes: true } }),
      prisma.assetLike.count({ where: { assetId: approvedAsset.id } }),
    ]);
    expect(asset?.likes).toBe(0);
    expect(likeCount).toBe(0);
  });

  it('does not expose or accept comments on another user pending showcase', async () => {
    const pendingShowcase = await prisma.showcase.create({
      data: {
        title: 'Pending showcase',
        type: 'TEXT',
        thumbnailUrl: '',
        status: 'PENDING',
        userId: ownerId,
        teamId: ownerTeamId,
      },
    });

    const listRes = await request(app)
      .get(`/api/showcase/${pendingShowcase.id}/comments`)
      .set('Cookie', viewerCookies);
    expect(listRes.status).toBe(404);

    const commentRes = await request(app)
      .post(`/api/showcase/${pendingShowcase.id}/comment`)
      .set('Cookie', viewerCookies)
      .send({ content: 'This should not be accepted' });
    expect(commentRes.status).toBe(404);

    const commentCount = await prisma.showcaseComment.count({
      where: { showcaseId: pendingShowcase.id },
    });
    expect(commentCount).toBe(0);
  });

  it('still allows the owner to read comments on their pending showcase', async () => {
    const pendingShowcase = await prisma.showcase.create({
      data: {
        title: 'Owner visible pending showcase',
        type: 'TEXT',
        thumbnailUrl: '',
        status: 'PENDING',
        userId: ownerId,
        teamId: ownerTeamId,
      },
    });

    const res = await request(app)
      .get(`/api/showcase/${pendingShowcase.id}/comments`)
      .set('Cookie', ownerCookies);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
