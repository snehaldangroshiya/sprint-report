module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__/e2e'],
  testMatch: ['**/*.e2e.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.e2e.ts'],
  testTimeout: 120000, // 2 minutes for E2E tests
  verbose: true,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // E2E tests run sequentially to avoid conflicts
  maxWorkers: 1,
  // Don't collect coverage for E2E tests
  collectCoverage: false,
  // Allow longer timeout for E2E tests
  slowTestThreshold: 30,
};