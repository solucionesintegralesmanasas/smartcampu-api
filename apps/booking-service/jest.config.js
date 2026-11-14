module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  moduleNameMapper: {
    '^@uajs/shared-types$': '<rootDir>/../../packages/shared-types/index.js',
  },
  coverageThreshold: {
    'src/modules/reservas/reserva.service.js': { lines: 80, statements: 80, functions: 80 },
    'src/modules/reservas/reserva.state-machine.js': { lines: 80, statements: 80, functions: 80 },
  },
  verbose: true,
};
