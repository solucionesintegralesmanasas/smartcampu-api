const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const EmailProducer = require('../../jobs/producers/email.producer');

const AuthController = require('./auth.controller');
const { requireAuth } = require('./auth.middleware');
const AuthRepository = require('./auth.repository');
const AuthService = require('./auth.service');
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  requestResetSchema,
  confirmResetSchema,
} = require('./auth.validation');

const router = express.Router();

const authRepository = new AuthRepository();
const emailProducer = new EmailProducer();
const authService = new AuthService(authRepository, emailProducer);
const authController = new AuthController(authService);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Error de validación', result.error.errors));
  }
  req.body = result.data;
  next();
};

router.post('/register', validate(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post('/login', validate(loginSchema), (req, res, next) => authController.login(req, res, next));
router.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));
router.post('/refresh', validate(refreshTokenSchema), (req, res, next) => authController.refreshToken(req, res, next));
router.post('/logout', validate(logoutSchema), (req, res, next) => authController.logout(req, res, next));
router.post('/password-reset', validate(requestResetSchema), (req, res, next) => authController.requestPasswordReset(req, res, next));
router.post('/password-reset/confirm', validate(confirmResetSchema), (req, res, next) => authController.confirmPasswordReset(req, res, next));

module.exports = router;
