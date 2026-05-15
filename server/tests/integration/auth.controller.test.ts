import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock asset-processor to avoid gltf-transform ESM issues
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';

describe('Auth Controller Integration', () => {
  const testUser = {
    email: 'test-integration@example.com',
    password: 'password123',
    name: 'Integration Test User',
  };

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    await prisma.user.upsert({
      where: { email: testUser.email },
      update: {},
      create: {
        email: testUser.email,
        password: hashedPassword,
        name: testUser.name,
        role: 'USER',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await prisma.$disconnect();
  });

  describe('GET /api/auth/settings', () => {
    it('should return public settings', async () => {
      const res = await request(app).get('/api/auth/settings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('PLATFORM_NAME');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should fail with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should login successfully and set cookies', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser.email);

      // Check cookies
      const cookies = res.get('Set-Cookie') || [];
      expect(cookies.some((c) => c.includes('token='))).toBe(true);
      expect(cookies.some((c) => c.includes('refreshToken='))).toBe(true);
      expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    });
  });
});
