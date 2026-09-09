const express = require('express');

const {
  livenessHandler,
  readinessHandler,
  prometheusMetricsHandler,
  ensurePolling,
} = require('../middleware/health.middleware');

const router = express.Router();

ensurePolling();

router.get('/health/liveness', livenessHandler);
router.get('/health/readiness', readinessHandler);
router.get('/health/metrics', prometheusMetricsHandler);

module.exports = router;
