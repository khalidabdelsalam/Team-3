// Tracing must be initialized FIRST before any other imports
require('./tracing');
require('dotenv').config();

const express   = require('express');
const sequelize = require('./db/connection');
const Preview   = require('./db/models/Preview');
const consumer  = require('./kafka/consumer');
const producer  = require('./kafka/producer');
const previewRoutes = require('./api/routes');
const { success, error } = require('./middleware/response');
const { requestLogger, logger } = require('./middleware/logger');
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics');
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Observability Endpoints ───────────────────────────────────────────────
app.get('/metrics', metricsEndpoint);

// ── Health & Ready ────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  success(res, { status: 'ok', service: 'preview-service' })
);

app.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    return success(res, { status: 'ready', db: 'connected' });
  } catch (e) {
    return error(res, 'NOT_READY', 'DB not connected', {}, 503);
  }
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/preview', previewRoutes);

// ── Startup ───────────────────────────────────────────────────────────────
async function start() {
  try {
    await sequelize.sync({ alter: true });
    logger.info('DB synced', { service: 'preview-service' });
    await consumer.start();
    app.listen(PORT, () =>
      logger.info(`Preview Service running on port ${PORT}`)
    );
  } catch (e) {
    logger.error('Startup failed', { error: e.message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await consumer.stop();
  await producer.disconnect();
  process.exit(0);
});

start();
