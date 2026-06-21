import request from 'supertest';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Mock asset-processor to avoid gltf-transform ESM issues
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

// Mock the AI service
jest.mock('../../src/services/ai.service', () => ({
  callLLM: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';
import { callLLM } from '../../src/services/ai.service';

const mockCallLLM = callLLM as jest.Mock;

describe('Daily Quote API Integration Tests', () => {
  const email = 'quote-test-user@example.com';
  const password = 'password123';
  let authCookies: string[] = [];
  const cacheFilePath = path.join(__dirname, '../../uploads/daily-quote.json');

  beforeAll(async () => {
    // Clean up test user just in case
    await prisma.user.deleteMany({ where: { email } });

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Quote Tester',
        role: 'USER',
      },
    });

    // Log in to get auth cookies
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    authCookies = loginRes.get('Set-Cookie') || [];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockCallLLM.mockReset();
    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }
  });

  it('requires authentication for GET', async () => {
    const res = await request(app).get('/api/notes/daily-quote');
    expect(res.status).toBe(401);
  });

  it('requires authentication for POST /generate', async () => {
    const res = await request(app).post('/api/notes/daily-quote/generate');
    expect(res.status).toBe(401);
  });

  it('returns ungenerated state if no cache file exists', async () => {
    const res = await request(app)
      .get('/api/notes/daily-quote')
      .set('Cookie', authCookies);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ quote: null, generated: false });
    expect(fs.existsSync(cacheFilePath)).toBe(false);
  });

  it('returns the LLM-generated quote and saves it to cache when POST /generate is called successfully', async () => {
    const testQuote = '保持好奇，勇于探索未知的3D领域！';
    mockCallLLM.mockResolvedValue(testQuote);

    const res = await request(app)
      .post('/api/notes/daily-quote/generate')
      .set('Cookie', authCookies);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ quote: testQuote, generated: true });

    // Verify cache file exists
    expect(fs.existsSync(cacheFilePath)).toBe(true);
    const cached = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    expect(cached.quote).toBe(testQuote);
    expect(cached).toHaveProperty('date');
  });

  it('returns fallback quote if POST /generate is called but callLLM fails', async () => {
    mockCallLLM.mockRejectedValue(new Error('API Down'));

    const res = await request(app)
      .post('/api/notes/daily-quote/generate')
      .set('Cookie', authCookies);

    expect(res.status).toBe(200);
    expect(res.body.generated).toBe(true);
    expect(typeof res.body.quote).toBe('string');
    expect(res.body.quote.length).toBeGreaterThan(0);

    // Verify cache file exists
    expect(fs.existsSync(cacheFilePath)).toBe(true);
  });

  it('serves the cached quote on GET visits once generated', async () => {
    const testQuote = '这是生成出来的AI寄语。';
    mockCallLLM.mockResolvedValue(testQuote);

    // 1. Initial state: ungenerated
    const initialGet = await request(app)
      .get('/api/notes/daily-quote')
      .set('Cookie', authCookies);
    expect(initialGet.body).toEqual({ quote: null, generated: false });

    // 2. Generate
    const generateRes = await request(app)
      .post('/api/notes/daily-quote/generate')
      .set('Cookie', authCookies);
    expect(generateRes.body).toEqual({ quote: testQuote, generated: true });

    // 3. Subsequent GET hits cache, does not call LLM again
    mockCallLLM.mockReset(); // Clear calls count
    const secondGet = await request(app)
      .get('/api/notes/daily-quote')
      .set('Cookie', authCookies);
    expect(secondGet.body).toEqual({ quote: testQuote, generated: true });
    expect(mockCallLLM).not.toHaveBeenCalled();
  });
});
