import request from 'supertest';

// Mock asset-processor to avoid gltf-transform ESM issues (matches existing
// integration test setup).
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';

/**
 * Contract tests for the Auth API.
 *
 * These verify the route↔schema contract at the Fastify validation boundary:
 *  - invalid request bodies are rejected with 400 VALIDATION_ERROR (proving the
 *    Zod schema is wired into the route), and
 *  - valid-shaped request bodies pass schema validation and reach controller
 *    logic (i.e. the response is NOT a VALIDATION_ERROR).
 *
 * Fastify runs schema validation (preValidation) before the auth preHandler,
 * so these assertions hold without an authenticated session or database setup.
 */
describe('Auth API contract', () => {
  describe('POST /api/auth/login', () => {
    const validPayload = { email: 'contract-user@example.com', password: 'password123' };

    it('rejects an invalid body with VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: '' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ status: 'error', code: 'VALIDATION_ERROR' });
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('accepts a valid-shaped body (reaches controller, not a validation error)', async () => {
      const res = await request(app).post('/api/auth/login').send(validPayload);

      // Valid shape passes schema validation. Controller then rejects the
      // credentials with a business error — never VALIDATION_ERROR.
      expect(res.body.code).not.toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/register', () => {
    const validPayload = {
      email: 'contract-register@example.com',
      password: 'password123',
      verificationCode: '123456',
    };

    it('rejects an invalid body (missing required fields) with VALIDATION_ERROR', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'bad-email' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a valid-shaped body (not a validation error)', async () => {
      const res = await request(app).post('/api/auth/register').send(validPayload);

      expect(res.body.code).not.toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/forgot-password/check', () => {
    const validPayload = { email: 'contract-forgot@example.com' };

    it('rejects an invalid email with VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password/check')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a valid-shaped body (not a validation error)', async () => {
      const res = await request(app).post('/api/auth/forgot-password/check').send(validPayload);

      expect(res.body.code).not.toBe('VALIDATION_ERROR');
    });
  });
});
