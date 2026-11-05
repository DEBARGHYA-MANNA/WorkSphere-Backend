module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { statements: 80, branches: 65, functions: 75, lines: 85 },
    './src/modules/activities/**/*.js': { statements: 90, branches: 50, functions: 90, lines: 90 },
    './src/modules/analytics/**/*.js': { statements: 90, branches: 80, functions: 85, lines: 90 }
  }
};
