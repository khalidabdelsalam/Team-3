const http = require('http');

const { startTracing, shutdownTracing } = require('./tracing');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { connectMongoWithRetry, disconnectMongo } = require('./config/db');
const webhookConsumer = require('./kafka/webhookConsumer');
const webhookProducer = require('./kafka/webhookProducer');
const { seedSampleWebhook } = require('./services/seedService');

startTracing();

const server = http.createServer(app);

let isShuttingDown = false;
//بتشغل الحاجات الأساسية قبل الخدمة تشتغل فعليًا:
async function bootstrapDependencies() {
  await connectMongoWithRetry();
  await seedSampleWebhook();
  await webhookConsumer.start();
}
//دي مسؤولة عن الإغلاق النضيف:
//عشان لما توقف Docker أو تعمل Ctrl+C الخدمة ما تقفلش فجأة وتسيب Connections مفتوحة.
async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down service.`);

  await Promise.allSettled([
    webhookConsumer.stop(),
    webhookProducer.disconnect(),
    disconnectMongo(),
    shutdownTracing(),
    new Promise((resolve) => server.close(resolve))
  ]);

  process.exit(0);
}

server.listen(config.port, () => {
  logger.info(`webhook-service listening on port ${config.port}.`);

  bootstrapDependencies().catch((error) => {
    logger.error('Service bootstrap failed.', {
      error: error.message
    });
  });
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection.', {
    error: reason instanceof Error ? reason.message : String(reason)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception.', {
    error: error.message
  });

  shutdown('uncaughtException');
});
