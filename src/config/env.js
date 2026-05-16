require('dotenv').config();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ['true', '1', 'yes', 'y', 'on'].includes(String(value).toLowerCase());
}

function toList(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

module.exports = {
  serviceName: 'webhook-service',
  port: toNumber(process.env.PORT, 3001),
  apiKey: process.env.API_KEY || '',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/webhook-db',
  database: {
    retryConnectionDelayMs: toNumber(process.env.MONGO_RETRY_CONNECTION_DELAY_MS, 5000)
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'webhook-service',
    groupId: process.env.KAFKA_GROUP_ID || 'webhook-service-group',
    brokers: toList(process.env.KAFKA_BROKERS, ['127.0.0.1:9092']),
    topic: process.env.KAFKA_TOPIC || 'events',
    statusTopic: process.env.KAFKA_STATUS_TOPIC || 'webhook-status',
    deadLetterTopic: process.env.KAFKA_DEAD_LETTER_TOPIC || 'webhook-dead-letter',
    retryConnectionDelayMs: toNumber(process.env.KAFKA_RETRY_CONNECTION_DELAY_MS, 5000)
  },
  webhook: {
    timeoutMs: toNumber(process.env.HTTP_TIMEOUT_MS, 5000),
    retryCount: toNumber(process.env.WEBHOOK_RETRY_COUNT, 3),
    retryDelayMs: toNumber(process.env.WEBHOOK_RETRY_DELAY_MS, 2000)
  },
  seed: {
    enabled: toBoolean(process.env.ENABLE_SAMPLE_WEBHOOK_SEED, false),
    url: process.env.SAMPLE_WEBHOOK_URL || '',
    name: process.env.SAMPLE_WEBHOOK_NAME || 'sample-webhook-receiver'
  }
};
