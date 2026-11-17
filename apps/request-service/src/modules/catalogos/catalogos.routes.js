const express = require('express');
const { z } = require('zod');

const { env } = require('../../config/env');
const { getRedisClient } = require('../../config/database/redis');
const { ValidationError } = require('../../core/exceptions');
const { requireAuth } = require('../../core/middleware/auth.middleware');

const CatalogosController = require('./catalogos.controller');
const CatalogosRepository = require('./catalogos.repository');
const CatalogosService = require('./catalogos.service');

const router = express.Router();

const listarTiposSchema = z.object({
  categoriaUuid: z.string().uuid('La categoría no es válida').optional(),
});

let cache = null;
try {
  cache = getRedisClient();
} catch (error) {
  // Sin Redis: los catálogos se consultan directamente en MySQL.
}

const catalogosRepository = new CatalogosRepository();
const catalogosService = new CatalogosService(catalogosRepository, cache, env.CATALOG_CACHE_TTL);
const catalogosController = new CatalogosController(catalogosService);

const validarQuery = (req, res, next) => {
  const result = listarTiposSchema.safeParse(req.query);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return next(new ValidationError('Error de validación en los datos suministrados', details));
  }
  req.query = result.data;
  return next();
};

router.use(requireAuth);

router.get('/categorias', (req, res, next) => catalogosController.listarCategorias(req, res, next));
router.get('/tipos', validarQuery, (req, res, next) =>
  catalogosController.listarTipos(req, res, next),
);
router.get('/estados', (req, res, next) => catalogosController.listarEstados(req, res, next));

module.exports = router;
