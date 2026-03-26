module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@ticketflow/shared$': '<rootDir>/../../shared/src/index.ts',
  },
};
