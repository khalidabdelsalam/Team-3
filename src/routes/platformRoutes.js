const express = require('express');
const client = require('prom-client');
const swaggerUi = require('swagger-ui-express');

const config = require('../config/config');
const swaggerDocument = require('../swagger');

const router = express.Router();
const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'webhook_service_'
});

const httpRequestsTotal = new client.Counter({
  name: 'webhook_service_http_requests_total',
  help: 'Total HTTP requests handled by webhook-service.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

function metricsMiddleware(req, res, next) {
  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: String(res.statusCode)
    });
  });

  next();
}

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: config.serviceName });
});

router.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready', service: config.serviceName });
});

router.get('/metrics', async (req, res, next) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    next(error);
  }
});

router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(swaggerDocument));
router.get('/api-docs', (req, res) => res.redirect('/docs'));

module.exports = {
  router,
  metricsMiddleware,
  register
};
