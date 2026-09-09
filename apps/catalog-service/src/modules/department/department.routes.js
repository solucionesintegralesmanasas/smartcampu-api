const express = require('express');

const { ValidationError } = require('../../core/exceptions');

const DepartmentController = require('./department.controller');
const DepartmentRepository = require('./department.repository');
const DepartmentService = require('./department.service');
const { createSchema, updateSchema } = require('./department.validation');

const router = express.Router();

const departmentRepository = new DepartmentRepository();

let departmentService = null;
let departmentController = null;

const getService = (req) => {
  if (!departmentService) {
    departmentService = new DepartmentService(departmentRepository, req.app.locals.redisClient);
    departmentController = new DepartmentController(departmentService);
  }
  return departmentController;
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
