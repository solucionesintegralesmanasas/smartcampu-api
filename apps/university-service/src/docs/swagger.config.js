const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const swaggerDocument = YAML.load(`${__dirname}/swagger.yaml`);

const setupSwagger = (app) => {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      explorer: true,
      customSiteTitle: 'University Service API — Smart Campus',
    }),
  );
};

module.exports = setupSwagger;
