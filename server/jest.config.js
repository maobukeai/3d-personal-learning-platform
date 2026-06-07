const { createDefaultPreset } = require('ts-jest');

process.env.NODE_ENV = 'test';

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    ...tsJestTransformCfg,
  },
};
