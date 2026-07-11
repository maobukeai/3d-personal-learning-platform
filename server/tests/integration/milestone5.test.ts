import request from 'supertest';
import bcrypt from 'bcryptjs';

jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
  optimize3DAsset: jest.fn(),
  executeAssetAnalysis: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';

describe('Milestone 5 Validation & Transactions Integration Tests', () => {
  const suffix = Date.now();
  const testUserEmail = `m5-test-${suffix}@example.com`;
  const password = 'password123';
  let userId = '';
  let cookies: string[] = [];
  let courseId = '';
  let lessonId = '';

  beforeAll(async () => {
    // Cleanup any potential leftover test users
    await prisma.user.deleteMany({ where: { email: testUserEmail } });

    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        password: await bcrypt.hash(password, 10),
        name: 'M5 Test User',
        role: 'USER',
        points: 0,
      },
    });
    userId = user.id;

    // Login to get cookies
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserEmail, password });
    cookies = loginRes.get('Set-Cookie') || [];

    // Create a mock course
    const course = await prisma.course.create({
      data: {
        title: `M5 Test Course ${suffix}`,
        description: 'Test course description',
        status: 'PUBLISHED',
      },
    });
    courseId = course.id;

    // Create a mock lesson for the course
    const lesson = await prisma.lesson.create({
      data: {
        courseId: course.id,
        title: 'M5 Test Lesson 1',
        content: 'Lesson content',
        order: 1,
      },
    });
    lessonId = lesson.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.courseNote.deleteMany({ where: { userId } });
    await prisma.courseReview.deleteMany({ where: { userId } });
    await prisma.lessonProgress.deleteMany({ where: { userId } });
    await prisma.enrollment.deleteMany({ where: { userId } });
    await prisma.discussion.deleteMany({ where: { userId } });
    await prisma.lesson.deleteMany({ where: { courseId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  describe('Course Enrollment Validation', () => {
    it('should reject enrollment without courseId', async () => {
      const res = await request(app).post('/api/courses/enroll').set('Cookie', cookies).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('courseId');
    });

    it('should enroll user in course successfully and return 201', async () => {
      const res = await request(app)
        .post('/api/courses/enroll')
        .set('Cookie', cookies)
        .send({ courseId });
      expect(res.status).toBe(201);
      expect(res.body.courseId).toBe(courseId);
      expect(res.body.userId).toBe(userId);
    });
  });

  describe('Course Progress Validation', () => {
    it('should reject progress update without courseId', async () => {
      const res = await request(app)
        .patch('/api/courses/progress')
        .set('Cookie', cookies)
        .send({ progress: 50 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('courseId');
    });

    it('should reject progress update with invalid progress bounds', async () => {
      const res = await request(app)
        .patch('/api/courses/progress')
        .set('Cookie', cookies)
        .send({ courseId, progress: 150 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('progress');
    });

    it('should update course progress successfully', async () => {
      const res = await request(app)
        .patch('/api/courses/progress')
        .set('Cookie', cookies)
        .send({ courseId, progress: 80 });
      expect(res.status).toBe(200);
      expect(res.body.progress).toBe(80);
    });
  });

  describe('Lesson Completion Validation', () => {
    it('should reject toggleLessonComplete with missing completed field', async () => {
      const res = await request(app)
        .patch(`/api/courses/lessons/${lessonId}/complete`)
        .set('Cookie', cookies)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('completed');
    });

    it('should mark lesson as complete successfully', async () => {
      const res = await request(app)
        .patch(`/api/courses/lessons/${lessonId}/complete`)
        .set('Cookie', cookies)
        .send({ completed: true });
      expect(res.status).toBe(200);
      expect(res.body.lessonProgress.completed).toBe(true);
    });
  });

  describe('Reviews Validation', () => {
    it('should reject review creation with missing fields', async () => {
      const res = await request(app)
        .post('/api/courses/reviews')
        .set('Cookie', cookies)
        .send({ rating: 6 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('courseId');
      expect(res.body.error).toContain('rating');
    });

    it('should create review successfully', async () => {
      const res = await request(app)
        .post('/api/courses/reviews')
        .set('Cookie', cookies)
        .send({ courseId, rating: 5, comment: 'Great course!' });
      expect(res.status).toBe(201);
      expect(res.body.rating).toBe(5);
      expect(res.body.comment).toBe('Great course!');
    });
  });

  describe('Notes Validation', () => {
    it('should reject note creation with missing fields', async () => {
      const res = await request(app).post('/api/courses/notes').set('Cookie', cookies).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('lessonId');
      expect(res.body.error).toContain('content');
    });

    it('should create note successfully', async () => {
      const res = await request(app)
        .post('/api/courses/notes')
        .set('Cookie', cookies)
        .send({ lessonId, content: 'This is a test note', timestamp: 120 });
      expect(res.status).toBe(201);
      expect(res.body.content).toBe('This is a test note');
      expect(res.body.timestamp).toBe(120);
    });
  });
});
