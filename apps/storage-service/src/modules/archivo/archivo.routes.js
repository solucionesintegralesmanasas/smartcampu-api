const express = require('express');
const multer = require('multer');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth } = require('../../core/middleware/authz.middleware');

const ArchivoController = require('./archivo.controller');
const ArchivoRepository = require('./archivo.repository');
const ArchivoService = require('./archivo.service');
const { upload } = require('./archivo.upload');
const { uploadMetaSchema, listQuerySchema } = require('./archivo.validation');

const router = express.Router();

const archivoRepository = new ArchivoRepository();
const archivoService = new ArchivoService(archivoRepository);
const archivoController = new ArchivoController(archivoService);

// multer reporta sus propios errores (tamaño excedido, etc.) como
// MulterError sin `statusCode`; sin este envoltorio caerían al branch
// genérico de error 500 en vez de responder 400 con un mensaje claro.
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new ValidationError(err.message));
    }
    if (err) return next(err);
    return next();
  });
};

// multipart/form-data llega siempre como strings: "metadata" se recibe como
// JSON serializado por el cliente y hay que parsearlo antes de validarlo.
const parseMetadata = (req, res, next) => {
  if (typeof req.body.metadata === 'string' && req.body.metadata.length > 0) {
    try {
      req.body.metadata = JSON.parse(req.body.metadata);
    } catch (error) {
      return next(new ValidationError('metadata must be valid JSON'));
    }
  }
  return next();
};

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.query = result.data;
  next();
};

router.post(
  '/',
  requireAuth,
  handleUpload,
  parseMetadata,
  validateBody(uploadMetaSchema),
  (req, res, next) => archivoController.upload(req, res, next),
);
router.get('/', requireAuth, validateQuery(listQuerySchema), (req, res, next) => archivoController.findAll(req, res, next));
router.get('/:id/download', requireAuth, (req, res, next) => archivoController.download(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => archivoController.findById(req, res, next));
router.delete('/:id', requireAuth, (req, res, next) => archivoController.delete(req, res, next));

module.exports = router;
