"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./src/services/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function main() {
    try {
        console.log('Testing bcrypt...');
        const hashed = await bcryptjs_1.default.hash('password123', 10);
        console.log('Bcrypt hash successful:', hashed);
        console.log('Testing Prisma connection...');
        const users = await prisma_1.default.user.findMany({ take: 1 });
        console.log('Users found:', users.length);
        const settings = await prisma_1.default.systemSetting.findMany();
        console.log('System settings found:', settings.length);
        console.log('Testing AuditLog creation...');
        const log = await prisma_1.default.auditLog.create({
            data: {
                action: 'TEST',
                module: 'TEST',
                description: 'Test log'
            }
        });
        console.log('AuditLog created:', log.id);
        console.log('Testing Note table...');
        const noteCount = await prisma_1.default.note.count();
        console.log('Notes found:', noteCount);
        console.log('Prisma test successful!');
    }
    catch (error) {
        console.error('Prisma test failed:', error);
        process.exit(1);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
}
main();
//# sourceMappingURL=test-prisma.js.map