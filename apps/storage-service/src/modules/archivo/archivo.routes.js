const express = require('express');

const { requireAuth, optionalAuth } = require('../../core/middlewares/auth.middleware');
const { ValidationError } = require('../../core/exceptions');
const StorageProducer = require('../../jobs/producers/storage.producer');

const ArchivoController = require('./archivo.controller');
const ArchivoRepository = require('./archivo.repository');
const ArchivoService = require('./archivo.service');
const { uploadArchivo } = require('./archivo.upload');
const {
  createArchivoSchema,
  updateArchivoSchema,
  listArchivosQuerySchema,
  buscarArchivosQuerySchema,
  uuidParamSchema,
} = require('./archivo.validation');

const router = express.Router();

const archivoRepository = new ArchivoRepository();
const storageProducer = new StorageProducer();
const archivoService = new ArchivoService(archivoRepository, storageProducer);
const archivoController = new ArchivoController(archivoService);

const validate = (schema, origen) => (req, res, next) => {
  const result = schema.safeParse(req[origen]);
  if (!result.success) {
    return next(new ValidationError('Error de validación', result.error.errors));
  }
  req[origen] = result.data;
  return next();
};

router.post(
  '/archivos',
  requireAuth,
  uploadArchivo,
  validate(createArchivoSchema, 'body'),
  (req, res, next) => archivoController.uploadFile(req, res, next),
);

router.get(
  '/archivos',
  requireAuth,
  validate(listArchivosQuerySchema, 'query'),
  (req, res, next) => archivoController.listFiles(req, res, next),
);

// Debe declararse antes de /archivos/:uuid para no capturar "buscar" como UUID.
router.get(
  '/archivos/buscar',
  requireAuth,
  validate(buscarArchivosQuerySchema, 'query'),
  (req, res, next) => archivoController.searchFiles(req, res, next),
);

router.get(
  '/archivos/:uuid',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  (req, res, next) => archivoController.getFileByUuid(req, res, next),
);

router.patch(
  '/archivos/:uuid',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  validate(updateArchivoSchema, 'body'),
  (req, res, next) => archivoController.updateFile(req, res, next),
);

router.delete(
  '/archivos/:uuid',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  (req, res, next) => archivoController.deleteFile(req, res, next),
);

// Descarga pública sin token; los archivos privados exigen autenticación.
router.get(
  '/archivos/:uuid/descarga',
  optionalAuth,
  validate(uuidParamSchema, 'params'),
  (req, res, next) => archivoController.downloadFile(req, res, next),
);

module.exports = router;
