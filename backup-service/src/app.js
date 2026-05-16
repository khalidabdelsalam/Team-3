require('dotenv').config();
const express = require('express');
const controller = require('./controllers/BackupRestController');
const logger = require('./utils/logger');
const { register, httpRequestDurationMicroseconds } = require('./utils/metrics');
const crypto = require('crypto');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
app.use(express.json());

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Backup Service API',
      version: '1.0.0',
      description: 'API for managing metadata backups',
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 3001}` }],
  },
  apis: ['./src/app.js'],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Metrics & Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const path = req.route ? req.route.path : req.path;

    httpRequestDurationMicroseconds
      .labels(req.method, path, res.statusCode)
      .observe(duration);
    
    httpRequestsTotal
      .labels(req.method, path, res.statusCode)
      .inc();

    if (res.statusCode >= 400) {
      httpErrorsTotal
        .labels(req.method, path, res.statusCode)
        .inc();
    }
    
    logger.info(`Request processed`, {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: duration,
      request_id: requestId
    });
  });
  next();
});

// Metrics Endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
/**
 * @openapi
 * /backup/run:
 *   post:
 *     summary: Trigger a manual backup
 *     responses:
 *       200:
 *         description: Success
 */
app.post('/backup/run', (req, res) => controller.runBackup(req, res));

/**
 * @openapi
 * /backup/history:
 *   get:
 *     summary: Get backup history
 *     responses:
 *       200:
 *         description: Success
 */
app.get('/backup/history', (req, res) => controller.getHistory(req, res));
app.get('/health', (req, res) => controller.health(req, res));
app.get('/ready', (req, res) => controller.ready(req, res));

module.exports = app;
