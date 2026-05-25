import request from 'supertest';

// Mock asset-processor to avoid gltf-transform ESM issues
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';

describe('CSRF Protection Integration', () => {
  let originalEnv: string;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV || 'test';
    // Temporarily switch to development to activate CSRF middleware
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should bypass CSRF for GET requests', async () => {
    const res = await request(app).get('/api/auth/settings');
    expect(res.status).toBe(200);
  });

  it('should bypass CSRF for whitelisted POST requests (like login)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });
    // Should get a 400 validation error, not a 403 CSRF error
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should bypass CSRF for whitelisted public verification code POST request', async () => {
    const res = await request(app)
      .post('/api/auth/email/send-code-public')
      .send({ email: 'not-an-email' });
    // Should get a 400 validation error, not a 403 CSRF error
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject non-whitelisted POST requests when CSRF token is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'New Task' });
    
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('should accept non-whitelisted POST requests when CSRF cookie and X-CSRF-Token header match', async () => {
    const token = 'test-csrf-token-12345';
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', [`csrfToken=${token}`])
      .set('X-CSRF-Token', token)
      .send({ title: 'New Task' });

    // Since we don't provide a JWT auth token, it should proceed to auth middleware and return 401
    // instead of 403 CSRF_VALIDATION_FAILED
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REQUIRED');
  });
});
