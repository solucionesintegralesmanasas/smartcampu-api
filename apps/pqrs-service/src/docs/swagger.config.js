const path = require('path');

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

/**
 * Configuración de Swagger UI.
 * @param {import('express').Application} app - Instancia de Express.
 */
const setupSwagger = (app) => {
  const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};

module.exports = setupSwagger;
