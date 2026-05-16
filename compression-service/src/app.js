require('./tracing');
require('dotenv').config();

const express        = require('express');
const sequelize      = require('./db/connection');
const CompressionJob = require('./db/models/CompressionJob');
const consumer       = require('./kafka/consumer');
const producer       = require('./kafka/producer');
const routes         = require('./api/routes');
const { success, error } = require('./middleware/response');
const { requestLogger, logger } = require('./middleware/logger');
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics');
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/metrics', metricsEndpoint);

app.get('/health', (req, res) =>
  success(res, { status: 'ok', service: 'compression-service' })
);

app.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    return success(res, { status: 'ready', db: 'connected' });
  } catch (e) {
    return error(res, 'NOT_READY', 'DB not connected', {}, 503);
  }
});

app.use('/', routes);

async function start() {
  try {
    await sequelize.sync({ alter: true });
    logger.info('DB synced', { service: 'compression-service' });
    await consumer.start();
    app.listen(PORT, () =>
      logger.info(`Compression Service running on port ${PORT}`)
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
