"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../src/utils/auth");
describe('Auth Utils', () => {
    describe('sanitizeUser', () => {
        it('should remove sensitive fields from user object', () => {
            const user = {
                id: '1',
                email: 'test@example.com',
                password: 'hashedpassword',
                twoFactorSecret: 'secret',
                twoFactorRecoveryCodes: '["code1"]',
                name: 'Test User'
            };
            const sanitized = (0, auth_1.sanitizeUser)(user);
            expect(sanitized).toEqual({
                id: '1',
                email: 'test@example.com',
                name: 'Test User'
            });
            expect(sanitized).not.toHaveProperty('password');
            expect(sanitized).not.toHaveProperty('twoFactorSecret');
            expect(sanitized).not.toHaveProperty('twoFactorRecoveryCodes');
        });
        it('should return null if user is null', () => {
            expect((0, auth_1.sanitizeUser)(null)).toBeNull();
        });
    });
    describe('generateRecoveryCodes', () => {
        it('should generate 8 recovery codes', () => {
            const codes = (0, auth_1.generateRecoveryCodes)();
            expect(codes).toHaveLength(8);
            codes.forEach(code => {
                expect(code).toMatch(/^[0-9A-F]{8}$/);
            });
        });
    });
});
//# sourceMappingURL=auth.test.js.map