const express = require('express');

const { ValidationError } = require('../../core/exceptions');

const ArchivoController = require('./archivo.controller');
const ArchivoRepository = require('./archivo.repository');
const { ArchivoService, upload } = require('./archivo.service');
const {
  createFileMetadataSchema,
  updateFileSchema,
  listFilesQuerySchema,
  searchFilesQuerySchema,
} = require('./archivo.validation');

const router = express.Router();

const archivoRepository = new ArchivoRepository();
const archivoService = new ArchivoService(archivoRepository);
const archivoController = new ArchivoController(archivoService);

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Error de validación', result.error.errors));
  }
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return next(new ValidationError('Error de validación', result.error.errors));
  }
  req.query = result.data;
  next();
};

// Rutas de subida de archivos
router.post(
  '/upload',
  upload.single('file'),
  validateBody(createFileMetadataSchema),
  (req, res, next) => archivoController.uploadFile(req, res, next),
);

// Rutas de consulta
router.get(
  '/search',
  validateQuery(searchFilesQuerySchema),
  (req, res, next) => archivoController.searchFiles(req, res, next),
);

router.get(
  '/',
  validateQuery(listFilesQuerySchema),
  (req, res, next) => archivoController.listFiles(req, res, next),
);

router.get('/:id', (req, res, next) => archivoController.getFileById(req, res, next));
router.get('/uuid/:uuid', (req, res, next) => archivoController.getFileByUuid(req, res, next));

// Rutas de actualización y eliminación
router.patch('/:id', validateBody(updateFileSchema), (req, res, next) => archivoController.updateFile(req, res, next));
router.delete('/:id', (req, res, next) => archivoController.deleteFile(req, res, next));

module.exports = router;
