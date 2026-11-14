const express = require('express');

const { getRedisClient } = require('../../config/database/redis');

const CatalogosController = require('./catalogos.controller');
const CatalogosRepository = require('./catalogos.repository');
const CatalogosService = require('./catalogos.service');

const router = express.Router();

let cache = null;
try {
  cache = getRedisClient();
} catch (error) {
  // Sin Redis: los catálogos se consultan directamente en MySQL.
}

const catalogosRepository = new CatalogosRepository();
const catalogosService = new CatalogosService(catalogosRepository, cache, 3600);
const catalogosController = new CatalogosController(catalogosService);

// Catálogos públicos: no requieren autenticación.
router.get('/tipos', (req, res, next) => catalogosController.listarTipos(req, res, next));
router.get('/estados', (req, res, next) => catalogosController.listarEstados(req, res, next));

module.exports = router;
