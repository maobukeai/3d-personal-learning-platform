import request from 'supertest';
import bcrypt from 'bcryptjs';

jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';

describe('Team logic boundaries', () => {
  const suffix = Date.now();
  const password = 'password123';
  const ownerEmail = `team-owner-${suffix}@example.com`;
  const adminEmail = `team-admin-${suffix}@example.com`;
  const inviteeEmail = `team-invitee-${suffix}@example.com`;
  const applicantEmail = `team-applicant-${suffix}@example.com`;
  const targetEmail = `team-target-${suffix}@example.com`;
  const ownerTargetEmail = `team-owner-target-${suffix}@example.com`;
  const emails = [
    ownerEmail,
    adminEmail,
    inviteeEmail,
    applicantEmail,
    targetEmail,
    ownerTargetEmail,
  ];

  let ownerId = '';
  let adminId = '';
  let inviteeId = '';
  let applicantId = '';
  let targetId = '';
  let ownerTargetId = '';
  let teamId = '';
  let ownerCookies: string[] = [];
  let adminCookies: string[] = [];
  let inviteeCookies: string[] = [];

  const createUser = async (email: string, name: string) => {
    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        name,
        role: 'USER',
      },
    });

    await prisma.team.create({
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

    return user;
  };

  const login = async (email: string) => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.get('Set-Cookie') || [];
  };

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    const [owner, admin, invitee, applicant, target, ownerTarget] = await Promise.all([
      createUser(ownerEmail, 'Team Owner'),
      createUser(adminEmail, 'Team Admin'),
      createUser(inviteeEmail, 'Team Invitee'),
      createUser(applicantEmail, 'Team Applicant'),
      createUser(targetEmail, 'Team Target'),
      createUser(ownerTargetEmail, 'Team Owner Target'),
    ]);

    ownerId = owner.id;
    adminId = admin.id;
    inviteeId = invitee.id;
    applicantId = applicant.id;
    targetId = target.id;
    ownerTargetId = ownerTarget.id;

    const team = await prisma.team.create({
      data: {
        name: `Team Logic ${suffix}`,
        type: 'TEAM',
        visibility: 'PUBLIC',
        ownerId,
        members: {
          create: [
            { userId: ownerId, role: 'OWNER' },
            { userId: adminId, role: 'ADMIN' },
          ],
        },
      },
    });
    teamId = team.id;

    [ownerCookies, adminCookies, inviteeCookies] = await Promise.all([
      login(ownerEmail),
      login(adminEmail),
      login(inviteeEmail),
    ]);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it('treats string false as rejecting an invitation', async () => {
    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId,
        inviterId: ownerId,
        inviteeEmail,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/teams/invitations/respond')
      .set('Cookie', inviteeCookies)
      .send({ invitationId: invitation.id, accept: 'false' });

    expect(res.status).toBe(200);

    const [updatedInvitation, membership] = await Promise.all([
      prisma.teamInvitation.findUnique({ where: { id: invitation.id } }),
      prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: inviteeId } } }),
    ]);
    expect(updatedInvitation?.status).toBe('REJECTED');
    expect(membership).toBeNull();
  });

  it('treats string false as rejecting a team application', async () => {
    const application = await prisma.teamApplication.create({
      data: {
        teamId,
        userId: applicantId,
        message: 'Please let me in',
      },
    });

    const res = await request(app)
      .post('/api/teams/applications/respond')
      .set('Cookie', ownerCookies)
      .send({ applicationId: application.id, accept: 'false' });

    expect(res.status).toBe(200);

    const [updatedApplication, membership] = await Promise.all([
      prisma.teamApplication.findUnique({ where: { id: application.id } }),
      prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: applicantId } } }),
    ]);
    expect(updatedApplication?.status).toBe('REJECTED');
    expect(membership).toBeNull();
  });

  it('does not let an admin add another admin directly', async () => {
    const res = await request(app)
      .post('/api/teams/members')
      .set('Cookie', adminCookies)
      .send({ teamId, userId: targetId, role: 'ADMIN' });

    expect(res.status).toBe(403);

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetId } },
    });
    expect(membership).toBeNull();
  });

  it('still lets the owner add an admin directly', async () => {
    const res = await request(app)
      .post('/api/teams/members')
      .set('Cookie', ownerCookies)
      .send({ teamId, userId: ownerTargetId, role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('ADMIN');

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: ownerTargetId } },
    });
    expect(membership?.role).toBe('ADMIN');
  });
});
