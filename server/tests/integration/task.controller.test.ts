import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock asset-processor to avoid gltf-transform ESM issues
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';

describe('Task Controller Integration', () => {
  const testUser = {
    email: 'test-tasks-integration@example.com',
    password: 'password123',
    name: 'Tasks Integration User',
  };

  let authCookies: string[] = [];
  let testTaskId: string;

  beforeAll(async () => {
    // Clean up any stale test user
    await prisma.user.deleteMany({ where: { email: testUser.email } });

    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const user = await prisma.user.create({
      data: {
        email: testUser.email,
        password: hashedPassword,
        name: testUser.name,
        role: 'USER',
      },
    });

    // Login to obtain auth token cookies
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    
    authCookies = loginRes.get('Set-Cookie') || [];
  });

  afterAll(async () => {
    // Cleanup created task data if exists
    if (testTaskId) {
      await prisma.task.deleteMany({ where: { id: testTaskId } });
    }
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await prisma.$disconnect();
  });

  describe('POST /api/tasks', () => {
    it('should create a task successfully when authenticated', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', authCookies)
        .send({
          title: 'Integration Test Task',
          description: 'This is a test task for controller coverage',
          status: 'TODO',
          priority: 'HIGH',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Integration Test Task');
      expect(res.body.priority).toBe('HIGH');
      testTaskId = res.body.id;
    });

    it('should fail to create task if unauthenticated', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Unauthenticated Task',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/tasks', () => {
    it('should retrieve a list of tasks for the authenticated user', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Cookie', authCookies);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((t: any) => t.id === testTaskId);
      expect(found).toBeDefined();
      expect(found.title).toBe('Integration Test Task');
    });

    it('should support filtering by status and priority', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Cookie', authCookies)
        .query({ status: 'TODO', priority: 'HIGH' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((t: any) => t.status === 'TODO' && t.priority === 'HIGH')).toBe(true);
    });
  });

  describe('GET /api/tasks/stats', () => {
    it('should return task statistics correctly', async () => {
      const res = await request(app)
        .get('/api/tasks/stats')
        .set('Cookie', authCookies);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('todo');
      expect(res.body).toHaveProperty('inProgress');
      expect(res.body).toHaveProperty('done');
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update task details successfully', async () => {
      const res = await request(app)
        .put(`/api/tasks/${testTaskId}`)
        .set('Cookie', authCookies)
        .send({
          title: 'Updated Test Task Title',
          status: 'IN_PROGRESS',
          priority: 'LOW',
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Test Task Title');
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.priority).toBe('LOW');
    });

    it('should return 404 for updating a non-existent task', async () => {
      const res = await request(app)
        .put('/api/tasks/non-existent-task-id')
        .set('Cookie', authCookies)
        .send({
          title: 'Not Found Task',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete the task successfully', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${testTaskId}`)
        .set('Cookie', authCookies);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Task deleted successfully');

      // Verify that the task is deleted from the DB
      const dbTask = await prisma.task.findUnique({ where: { id: testTaskId } });
      expect(dbTask).toBeNull();
      testTaskId = ''; // Prevent cleanup in afterAll
    });
  });
});
