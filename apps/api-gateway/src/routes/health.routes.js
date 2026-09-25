const express = require('express');

const {
  livenessHandler,
  readinessHandler,
  prometheusMetricsHandler,
  ensurePolling,
} = require('../middleware/health.middleware');

const router = express.Router();

ensurePolling();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'up',
    service: 'api-gateway',
    uptimeSeconds: Math.floor(process.uptime()),
    services: {},
  });
});

router.get('/health/liveness', livenessHandler);
router.get('/health/readiness', readinessHandler);
router.get('/health/metrics', prometheusMetricsHandler);

module.exports = router;
