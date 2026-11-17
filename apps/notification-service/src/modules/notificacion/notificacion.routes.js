const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');

const NotificacionController = require('./notificacion.controller');
const NotificacionRepository = require('./notificacion.repository');
const NotificacionService = require('./notificacion.service');
const { createSchema } = require('./notificacion.validation');

const router = express.Router();

const notificacionRepository = new NotificacionRepository();
const notificacionService = new NotificacionService(notificacionRepository);
const notificacionController = new NotificacionController(notificacionService);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

// Envío ad-hoc (admin/staff): útil para avisos manuales que no vienen de
// una cola de eventos de dominio.
router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => notificacionController.create(req, res, next));

router.get('/', requireAuth, (req, res, next) => notificacionController.findMine(req, res, next));
router.get('/no-leidas/conteo', requireAuth, (req, res, next) => notificacionController.countUnread(req, res, next));
router.post('/leer-todas', requireAuth, (req, res, next) => notificacionController.markAllRead(req, res, next));
router.post('/:id/leer', requireAuth, (req, res, next) => notificacionController.markRead(req, res, next));

module.exports = router;
