//بيرسل البيانات للـ Kafka:
const config = require('../config/config');
const kafka = require('../config/kafka');
const logger = require('../config/logger');

let producer;
let connected = false;

async function ensureProducerTopics() {
  const admin = kafka.admin();

  await admin.connect();

  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic: config.kafka.statusTopic,
          numPartitions: 1,
          replicationFactor: 1
        },
        {
          topic: config.kafka.deadLetterTopic,
          numPartitions: 1,
          replicationFactor: 1
        }
      ]
    });
  } finally {
    await admin.disconnect();
  }
}

async function getProducer() {
  if (!producer) {
    producer = kafka.producer();
  }

  if (!connected) {
    await ensureProducerTopics();
    await producer.connect();
    connected = true;
  }

  return producer;
}
//لو Webhook فشل بعد كل retries، الرسالة تتحط في Dead Letter Topic.
async function publishWebhookStatus(type, payload) {
  try {
    const kafkaProducer = await getProducer();

    await kafkaProducer.send({
      topic: config.kafka.statusTopic,
      messages: [
        {
          key: payload.eventId,
          value: JSON.stringify({
            type,
            ...payload,
            emittedAt: new Date().toISOString()
          })
        }
      ]
    });
  } catch (error) {
    logger.warn('Kafka webhook status publish failed.', {
      type,
      error: error.message
    });
  }
}

async function publishDeadLetter(payload) {
  try {
    const kafkaProducer = await getProducer();

    await kafkaProducer.send({
      topic: config.kafka.deadLetterTopic,
      messages: [
        {
          key: payload.eventId,
          value: JSON.stringify({
            type: 'WEBHOOK_DELIVERY_DEAD_LETTER',
            ...payload,
            emittedAt: new Date().toISOString()
          })
        }
      ]
    });
  } catch (error) {
    logger.warn('Kafka dead-letter publish failed.', {
      error: error.message
    });
  }
}
//يقفل Kafka producer.
async function disconnect() {
  if (producer && connected) {
    await producer.disconnect();
    connected = false;
  }
}

module.exports = {
  publishWebhookStatus,
  publishDeadLetter,
  disconnect
};
