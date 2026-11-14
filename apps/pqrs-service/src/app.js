const express = require('express');

const expressLoader = require('./core/loaders/express.loader');
const setupSwagger = require('./docs/swagger.config');

/**
 * Inicializa la aplicación Express.
 * @returns {import('express').Application}
 */
const initApp = () => {
  const app = express();
  expressLoader(app);
  setupSwagger(app);
  return app;
};

module.exports = initApp;
