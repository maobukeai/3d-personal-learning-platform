"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Mock asset-processor to avoid gltf-transform ESM issues
jest.mock('../../src/utils/asset-processor', () => ({
    processGltf: jest.fn(),
    getGltfMetadata: jest.fn()
}));
const app_1 = __importDefault(require("../../src/app"));
const prisma_1 = __importDefault(require("../../src/services/prisma"));
describe('Auth Controller Integration', () => {
    const testUser = {
        email: 'test-integration@example.com',
        password: 'password123',
        name: 'Integration Test User'
    };
    beforeAll(async () => {
        const hashedPassword = await bcryptjs_1.default.hash(testUser.password, 10);
        await prisma_1.default.user.upsert({
            where: { email: testUser.email },
            update: {},
            create: {
                email: testUser.email,
                password: hashedPassword,
                name: testUser.name,
                role: 'USER'
            }
        });
    });
    afterAll(async () => {
        await prisma_1.default.user.deleteMany({ where: { email: testUser.email } });
        await prisma_1.default.$disconnect();
    });
    describe('GET /api/auth/settings', () => {
        it('should return public settings', async () => {
            const res = await (0, supertest_1.default)(app_1.default).get('/api/auth/settings');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('PLATFORM_NAME');
        });
    });
    describe('POST /api/auth/login', () => {
        it('should fail with invalid credentials', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({ email: 'nonexistent@example.com', password: 'password' });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Invalid credentials');
        });
        it('should login successfully and set cookies', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({ email: testUser.email, password: testUser.password });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.email).toBe(testUser.email);
            // Check cookies
            const cookies = res.get('Set-Cookie') || [];
            expect(cookies.some(c => c.includes('token='))).toBe(true);
            expect(cookies.some(c => c.includes('refreshToken='))).toBe(true);
            expect(cookies.some(c => c.includes('HttpOnly'))).toBe(true);
        });
    });
});
//# sourceMappingURL=auth.controller.test.js.map