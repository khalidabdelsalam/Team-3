//ده بيعمل Health Check: عشان نعرف حالة الـ Webhook Service.

const config = require('../config/config');
const { getMongoStatus } = require('../config/db');
const webhookConsumer = require('../kafka/webhookConsumer');

function getHealth(req, res) {
  const mongoStatus = getMongoStatus();
  const kafkaStatus = webhookConsumer.getStatus();
  const dependenciesReady = mongoStatus === 'connected' && kafkaStatus.connected;

  res.status(dependenciesReady ? 200 : 503).json({
    service: config.serviceName,
    status: dependenciesReady ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    mongo: {
      status: mongoStatus
    },
    kafka: kafkaStatus,
    config: {
      topic: config.kafka.topic,
      timeoutMs: config.webhook.timeoutMs,
      retryCount: config.webhook.retryCount
    }
  });
}

module.exports = {
  getHealth
};
