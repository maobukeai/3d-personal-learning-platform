import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock asset-processor to avoid gltf-transform ESM issues
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';

describe('Phase 1 Security & Validation', () => {
  const testUser = {
    email: 'test-phase1@example.com',
    password: 'password123',
    name: 'Phase1 Test User',
  };

  let authCookies: string[] = [];

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

    // Login once to get cookies for upload test
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    authCookies = loginRes.get('Set-Cookie') || [];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await prisma.$disconnect();
  });

  describe('SVG Upload & XSS Sanitization', () => {
    it('should reject SVG containing script tags', async () => {
      const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg">
        <script>alert("XSS")</script>
        <circle cx="50" cy="50" r="40" />
      </svg>`;

      const res = await request(app)
        .post('/api/auth/upload-avatar')
        .set('Cookie', authCookies)
        .attach('avatar', Buffer.from(maliciousSvg), 'avatar.svg');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('安全验证失败');
    });

    it('should reject SVG containing inline onload event handlers', async () => {
      const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
        <circle cx="50" cy="50" r="40" />
      </svg>`;

      const res = await request(app)
        .post('/api/auth/upload-avatar')
        .set('Cookie', authCookies)
        .attach('avatar', Buffer.from(maliciousSvg), 'avatar.svg');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('安全验证失败');
    });

    it('should reject SVG containing javascript: scheme hrefs', async () => {
      const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg">
        <a href="javascript:alert(1)">
          <circle cx="50" cy="50" r="40" />
        </a>
      </svg>`;

      const res = await request(app)
        .post('/api/auth/upload-avatar')
        .set('Cookie', authCookies)
        .attach('avatar', Buffer.from(maliciousSvg), 'avatar.svg');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('安全验证失败');
    });

    it('should allow a clean, safe SVG', async () => {
      const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="red" />
      </svg>`;

      const res = await request(app)
        .post('/api/auth/upload-avatar')
        .set('Cookie', authCookies)
        .attach('avatar', Buffer.from(safeSvg), 'avatar.svg');

      // Safe SVG should bypass XSS rejection (status won't be 400).
      expect(res.status).not.toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login requests after 20 attempts', async () => {
      let lastRes: any = null;
      for (let i = 0; i < 25; i++) {
        lastRes = await request(app)
          .post('/api/auth/login')
          .send({ email: 'rate-limit-test@example.com', password: 'wrongpassword' });
        
        if (lastRes.status === 429) {
          break;
        }
      }
      expect(lastRes.status).toBe(429);
      expect(lastRes.body.error).toBe('请求过于频繁，请稍后再试');
    });
  });
});
