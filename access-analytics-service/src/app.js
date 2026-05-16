require('dotenv').config();
const express = require('express');
const controller = require('./controllers/AnalyticsRestController');
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
      title: 'Access Analytics API',
      version: '1.0.0',
      description: 'API for tracking and analyzing file access events',
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 3010}` }],
  },
  apis: ['./src/app.js'], // Documentation is in this file or controllers
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
 * /access/log:
 *   post:
 *     summary: Log a file access event
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               file_id: { type: string }
 *               user_id: { type: string }
 *               action: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
app.post('/access/log', (req, res) => controller.logAccess(req, res));

/**
 * @openapi
 * /analytics/file/{id}:
 *   get:
 *     summary: Get access logs for a specific file
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
app.get('/analytics/file/:id', (req, res) => controller.getFileAnalytics(req, res));
app.get('/health', (req, res) => controller.health(req, res));
app.get('/ready', (req, res) => controller.ready(req, res));

module.exports = app;
