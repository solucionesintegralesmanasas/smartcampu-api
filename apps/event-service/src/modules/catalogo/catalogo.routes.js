const express = require('express');

const CatalogoController = require('./catalogo.controller');
const { crearCatalogoService } = require('./catalogo.service');

const router = express.Router();

const catalogoController = new CatalogoController(crearCatalogoService());

// Catálogos públicos.
router.get('/categorias', (req, res, next) => catalogoController.listarCategorias(req, res, next));
router.get('/estados', (req, res, next) => catalogoController.listarEstados(req, res, next));

module.exports = router;
