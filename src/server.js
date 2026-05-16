import { createApp } from './api/app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { connectKafka, disconnectKafka } from './events/kafka.js';
import { logger } from './lib/logger.js';

const app = createApp();

let server;

async function start() {
  try {
    await pool.query('SELECT 1');
    await connectKafka();

    server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, 'Notification service is listening');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start notification service');
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down notification service');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await Promise.allSettled([disconnectKafka(), pool.end()]);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
