import request from 'supertest';

// Mock asset-processor to avoid gltf-transform ESM issues (matches existing
// integration test setup).
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';

/**
 * Contract tests for the Assets API.
 *
 * Verifies the route↔schema contract at the Fastify validation boundary.
 * Because schema validation runs before the auth preHandler, an unauthenticated
 * request with a *valid* body passes validation and is rejected with 401
 * (proving the schema accepted the shape), while an *invalid* body is rejected
 * with 400 VALIDATION_ERROR (proving the schema is enforced).
 */
describe('Assets API contract', () => {
  describe('POST /api/assets/:id/comments', () => {
    const path = '/api/assets/contract-asset-id/comments';

    it('rejects an empty comment with VALIDATION_ERROR', async () => {
      const res = await request(app).post(path).send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a missing content field with VALIDATION_ERROR', async () => {
      const res = await request(app).post(path).send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a valid-shaped body (passes validation → rejected by auth, not VALIDATION_ERROR)', async () => {
      const res = await request(app).post(path).send({ content: 'A valid comment' });

      // Schema validation passed; auth preHandler then rejects the request.
      expect(res.body.code).not.toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/assets/requests', () => {
    const path = '/api/assets/requests';

    it('rejects a missing title with VALIDATION_ERROR', async () => {
      const res = await request(app).post(path).send({ description: 'missing title' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a valid-shaped body (not a validation error)', async () => {
      const res = await request(app)
        .post(path)
        .send({ title: 'Request title', description: 'Request description' });

      expect(res.body.code).not.toBe('VALIDATION_ERROR');
    });
  });
});
