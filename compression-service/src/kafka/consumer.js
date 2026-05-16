const { Kafka } = require('kafkajs');
const { runCompression } = require('../core/compressionService');

const kafka = new Kafka({
  clientId: 'compression-service-consumer',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
  retry: { retries: 10, initialRetryTime: 3000 },
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'compression-service-group',
});

async function start() {
  await consumer.connect();
  console.log('[Kafka Consumer] Connected');

  // Listen for file.uploaded → auto-compress
  // Listen for compression.requested → large file async processing
  await consumer.subscribe({
    topics: ['file.uploaded', 'compression.requested'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      let event;
      try {
        event = JSON.parse(message.value.toString());
      } catch {
        console.error('[Kafka Consumer] Bad JSON, skipping');
        return;
      }

      const fileId    = event.file_id;
      const algorithm = event.algorithm || null;
      console.log(`[Kafka Consumer] ${event.event_type} | file: ${fileId}`);

      try {
        await runCompression(fileId, algorithm);
        console.log(`[Kafka Consumer] Compression done for ${fileId}`);
      } catch (e) {
        console.error(`[Kafka Consumer] Compression failed for ${fileId}:`, e.message);
      }
    },
  });
}

async function stop() {
  await consumer.disconnect();
}

module.exports = { start, stop };
