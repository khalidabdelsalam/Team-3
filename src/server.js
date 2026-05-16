const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { startTracing, shutdownTracing } = require('./tracing');
const connectDB = require('./config/db');
const schedulerProducer = require('./kafka/schedulerProducer');
const { initCronRunner } = require('./scheduler/cronRunner');

startTracing();

const startServer = async () => {
  try {
    logger.info('Booting Scheduler Service.');
    
    // Connect to database
    await connectDB();
    
    // Connect to Kafka Producer
    await schedulerProducer.connect();
    
    // Start Cron background runner
    initCronRunner();

    app.listen(config.port, () => {
      logger.info('Scheduler Service is listening.', { port: config.port });
    });

  } catch (error) {
    logger.error('Critical failure during startup.', { error: error.message });
    await shutdownTracing();
    process.exit(1);
  }
};

startServer();
