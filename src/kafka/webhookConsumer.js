//بيستلم الـ Events من Kafka:
const config = require('../config/config');
const kafka = require('../config/kafka');
const logger = require('../config/logger');
const sleep = require('../utils/sleep');
const webhookService = require('../services/webhookService');

let consumer;
//ده بيخزن حالة الـ Consumer:

const consumerStatus = {
  running: false,
  connected: false,
  lastError: null
};
//ده بيحول الـ Raw Message لشكل object مفهوم:
//عشان الخدمة ما تفشلش لو Topic لسه متعملش.
function parseKafkaMessage(message) {
  const rawValue = message.value ? message.value.toString('utf8') : '';

  if (!rawValue) {
    throw new Error('Received empty Kafka message.');
  }

  const parsedValue = JSON.parse(rawValue);

  return {
    id: parsedValue.id,
    eventId: parsedValue.eventId,
    type: parsedValue.type || parsedValue.eventType || parsedValue.event,
    payload: parsedValue.payload ?? parsedValue.data ?? {},
    metadata: parsedValue.metadata ?? {},
    createdAt: parsedValue.createdAt,
    source: 'kafka'
  };
}

async function ensureTopic() {
  const admin = kafka.admin();

  await admin.connect();

  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic: config.kafka.topic,
          numPartitions: 1,
          replicationFactor: 1
        }
      ]
    });
  } finally {
    await admin.disconnect();
  }
}
//ده بيبدأ الـ Consumer:الي بيعالج البيانات ويقراها 
//بياخد الـ messages واحد ورا التاني ويعالجها.
//لو فشلت، بيسجل الخطأ وينتظر قبل المحاولة مرة أخرى (Retry Logic).


//Kafka → WebhookConsumer → WebhookService

async function start() {
  if (consumerStatus.running) {
    return;
  }

  consumerStatus.running = true;

  while (consumerStatus.running) {
    try {
      await ensureTopic();

      consumer = kafka.consumer({
        groupId: config.kafka.groupId
      });

      await consumer.connect();
      await consumer.subscribe({
        topic: config.kafka.topic,
        fromBeginning: false
      });

      consumerStatus.connected = true;
      consumerStatus.lastError = null;

      logger.info('Kafka consumer connected and subscribed.', {
        topic: config.kafka.topic,
        brokers: config.kafka.brokers
      });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const event = parseKafkaMessage(message);

            logger.info('Kafka event received.', {
              topic,
              partition,
              offset: message.offset,
              eventType: event.type
            });

            await webhookService.processEvent(event, {
              source: 'kafka'
            });
          } catch (error) {
            logger.error('Kafka event processing failed.', {
              topic,
              partition,
              offset: message.offset,
              error: error.message
            });
          }
        }
      });

      return;
    } catch (error) {
      consumerStatus.connected = false;
      consumerStatus.lastError = error.message;

      logger.error('Kafka consumer failed to start. Retrying.', {
        error: error.message,
        retryInMs: config.kafka.retryConnectionDelayMs
      });

      if (consumer) {
        try {
          await consumer.disconnect();
        } catch (disconnectError) {
          logger.warn('Kafka consumer disconnect raised an error during retry.', {
            error: disconnectError.message
          });
        }

        consumer = null;
      }

      if (!consumerStatus.running) {
        break;
      }

      await sleep(config.kafka.retryConnectionDelayMs);
    }
  }
}
//يقفل Kafka consumer.
async function stop() {
  consumerStatus.running = false;
  consumerStatus.connected = false;

  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    logger.info('Kafka consumer disconnected.');
  }
}
//يرجع حالة Kafka:
//وده مستخدم في HealthController.
function getStatus() {
  return {
    ...consumerStatus,
    topic: config.kafka.topic,
    brokers: config.kafka.brokers
  };
}

module.exports = {
  start,
  stop,
  getStatus,
  ensureTopic,
  parseKafkaMessage
};
