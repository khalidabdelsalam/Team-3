import { Kafka } from 'kafkajs';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { setKafkaConnected } from './runtime-state.js';
import { processEventNotification } from '../modules/notifications/notification.service.js';

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.kafkaBrokers
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: env.KAFKA_CONSUMER_GROUP });

const subscribedTopics = [
  env.KAFKA_UPLOAD_COMPLETED_TOPIC,
  env.KAFKA_REPLICATION_COMPLETED_TOPIC,
  env.KAFKA_QUOTA_EXCEEDED_TOPIC,
  env.KAFKA_BACKUP_COMPLETED_TOPIC,
  env.KAFKA_METRICS_THRESHOLD_TOPIC
];

export async function connectKafka() {
  await producer.connect();
  await consumer.connect();

  for (const topic of subscribedTopics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const payload = JSON.parse(message.value?.toString() ?? '{}');
        const saved = await processEventNotification(topic, payload);

        if (saved) {
          logger.info({ topic, notificationId: saved.id }, 'Processed event notification');
        }
      } catch (error) {
        logger.error({ err: error, topic }, 'Failed to process notification event');
      }
    }
  });

  setKafkaConnected(true);
  logger.info({ brokers: env.kafkaBrokers, topics: subscribedTopics }, 'Kafka producer and consumer connected');
}

export async function disconnectKafka() {
  setKafkaConnected(false);
  await Promise.allSettled([producer.disconnect(), consumer.disconnect()]);
}

export async function publishNotificationSent(payload) {
  await producer.send({
    topic: env.KAFKA_NOTIFICATION_SENT_TOPIC,
    messages: [
      {
        key: String(payload.notification_id),
        value: JSON.stringify(payload)
      }
    ]
  });
}
