const express = require('express');

const { ValidationError } = require('../../core/exceptions');

const DocumentTypeController = require('./document-type.controller');
const DocumentTypeRepository = require('./document-type.repository');
const DocumentTypeService = require('./document-type.service');
const { createSchema, updateSchema } = require('./document-type.validation');

const router = express.Router();

const documentTypeRepository = new DocumentTypeRepository();

let documentTypeService = null;
let documentTypeController = null;

const getService = (req) => {
  if (!documentTypeService) {
    documentTypeService = new DocumentTypeService(
      documentTypeRepository,
      req.app.locals.redisClient,
    );
    documentTypeController = new DocumentTypeController(documentTypeService);
  }
  return documentTypeController;
};

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

router.post('/', validate(createSchema), (req, res, next) => getService(req).create(req, res, next));
router.get('/', (req, res, next) => getService(req).findAll(req, res, next));
router.get('/search', (req, res, next) => getService(req).search(req, res, next));
router.get('/:id', (req, res, next) => getService(req).findById(req, res, next));
router.put('/:id', validate(updateSchema), (req, res, next) => getService(req).update(req, res, next));
router.delete('/:id', (req, res, next) => getService(req).delete(req, res, next));

module.exports = router;
