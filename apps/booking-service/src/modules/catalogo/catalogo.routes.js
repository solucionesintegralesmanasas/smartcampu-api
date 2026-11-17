const express = require('express');

const CatalogoController = require('./catalogo.controller');
const CatalogoRepository = require('./catalogo.repository');
const CatalogoService = require('./catalogo.service');

const router = express.Router();

const catalogoRepository = new CatalogoRepository();
const catalogoService = new CatalogoService(catalogoRepository);
const catalogoController = new CatalogoController(catalogoService);

router.get('/tipos', (req, res, next) => catalogoController.listarTipos(req, res, next));
router.get('/estados', (req, res, next) => catalogoController.listarEstados(req, res, next));

module.exports = router;
