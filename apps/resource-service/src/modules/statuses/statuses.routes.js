const express = require('express');

const StatusesController = require('./statuses.controller');
const StatusesRepository = require('./statuses.repository');
const StatusesService = require('./statuses.service');

const router = express.Router();

const statusesRepository = new StatusesRepository();
const statusesService = new StatusesService(statusesRepository);
const statusesController = new StatusesController(statusesService);

router.get('/', (req, res, next) => statusesController.findAll(req, res, next));

module.exports = router;
