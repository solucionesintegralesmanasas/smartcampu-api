module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageThreshold: {
    './src/modules/solicitudes/solicitudes.state-machine.js': {
      lines: 80,
      statements: 80,
    },
    './src/modules/solicitudes/solicitudes.service.js': {
      lines: 80,
      statements: 80,
    },
    './src/modules/catalogos/catalogos.service.js': {
      lines: 80,
      statements: 80,
    },
  },
  verbose: true,
};
