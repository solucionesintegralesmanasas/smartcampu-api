const { createTokenBucket } = require('@uajs/shared-utils');
const express = require('express');
const request = require('supertest');

const createRateLimitMiddleware = require('../../src/middleware/rateLimit.middleware');

describe('Rate Limit Middleware', () => {
  it('debe permitir solicitudes dentro del límite y setear headers X-RateLimit', async () => {
    const bucket = createTokenBucket({ capacity: 5, refillPerSecond: 1, sweepIntervalMs: 10000 });
    const app = express();
    app.use(createRateLimitMiddleware({ bucket, capacity: 5 }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-remaining']).toBe('4');
    bucket.stop();
  });

  it('debe retornar 429 y Retry-After cuando se excede el límite', async () => {
    // Bucket de capacidad 1: la primera pasa, la segunda se deniega de forma determinista.
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 1, sweepIntervalMs: 10000 });
    const app = express();
    app.use(createRateLimitMiddleware({ bucket, capacity: 1 }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    const first = await request(app).get('/test');
    expect(first.status).toBe(200);

    const denied = await request(app).get('/test');
    expect(denied.status).toBe(429);
    expect(denied.body.code).toBe('TOO_MANY_REQUESTS');
    expect(denied.headers['retry-after']).toBeDefined();
    expect(Number(denied.headers['retry-after'])).toBeGreaterThan(0);
    expect(denied.body.retryAfterSeconds).toBeGreaterThan(0);
    bucket.stop();
  });
});
