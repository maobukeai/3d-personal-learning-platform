import request from 'supertest';

// Mock asset-processor to avoid gltf-transform ESM issues (matches existing
// integration test setup).
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';

/**
 * Contract tests for the Materials API.
 *
 * Verifies the route↔schema contract at the Fastify validation boundary:
 * invalid bodies → 400 VALIDATION_ERROR; valid bodies pass validation and are
 * rejected by auth (401), never as a validation error.
 */
describe('Materials API contract', () => {
  describe('POST /api/materials/:id/comments', () => {
    const path = '/api/materials/contract-material-id/comments';

    it('rejects an empty comment with VALIDATION_ERROR', async () => {
      const res = await request(app).post(path).send({ content: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a valid-shaped body (not a validation error)', async () => {
      const res = await request(app).post(path).send({ content: 'A valid comment' });

      expect(res.body.code).not.toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/materials/requests', () => {
    const path = '/api/materials/requests';

    it('rejects a missing description with VALIDATION_ERROR', async () => {
      const res = await request(app).post(path).send({ title: 'Title only' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a valid-shaped body (not a validation error)', async () => {
      const res = await request(app)
        .post(path)
        .send({ title: 'Material request', description: 'Material request description' });

      expect(res.body.code).not.toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/materials/:id/status', () => {
    const path = '/api/materials/contract-material-id/status';

    it('rejects an invalid status with VALIDATION_ERROR', async () => {
      const res = await request(app).patch(path).send({ status: 'NOT_A_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a valid-shaped body (not a validation error)', async () => {
      const res = await request(app).patch(path).send({ status: 'APPROVED' });

      expect(res.body.code).not.toBe('VALIDATION_ERROR');
    });
  });
});
