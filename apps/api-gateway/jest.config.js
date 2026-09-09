// Configuración de Jest para el API Gateway.
// El setupFiles asegura que las variables de entorno de test existan
// antes de que cualquier módulo (config/env) se importe, evitando que
// la validación fail-fast (zod) termine el proceso durante los tests.

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  verbose: true,
};
