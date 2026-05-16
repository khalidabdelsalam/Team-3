require('dotenv').config();

module.exports = {
  serviceName: process.env.SERVICE_NAME || 'scheduler-service',
  port: process.env.PORT || 3002,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/scheduler-db',
  cronInterval: process.env.CRON_INTERVAL || '*/10 * * * * *',
  retryLimits: process.env.RETRY_LIMITS ? parseInt(process.env.RETRY_LIMITS) : 3,
  kafkaTopic: process.env.KAFKA_TOPIC || 'events',
  jobTimeout: process.env.JOB_TIMEOUT_MS ? parseInt(process.env.JOB_TIMEOUT_MS) : 60000,
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'scheduler-service',
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  }
};
