const { createDefaultPreset } = require('ts-jest');

process.env.NODE_ENV = 'test';

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Closes Prisma/Redis/BullMQ/Socket.io/Fastify after the whole suite so the
  // process can exit naturally — this replaces the previous `--forceExit` flag
  // that masked dangling async handles.
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    '^marked$': '<rootDir>/node_modules/marked/lib/marked.umd.js',
  },
  // P-1.2：覆盖率收集范围与阈值（保守值，避免因阈值过高导致 CI 失败）
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 65,
      lines: 70,
      statements: 70,
    },
  },
};
