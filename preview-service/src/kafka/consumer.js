const { Kafka } = require('kafkajs');
const { generatePreview } = require('../core/previewService');
const cache    = require('../adapters/redisCache');
const Preview  = require('../db/models/Preview');
const producer = require('./producer');

const kafka = new Kafka({
  clientId: 'preview-service-consumer',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
  retry: { retries: 10, initialRetryTime: 3000 },
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'preview-service-group',
});

async function start() {
  await consumer.connect();
  console.log('[Kafka Consumer] Connected');

  // Subscribe to file.uploaded → auto-generate preview
  // Subscribe to file.deleted  → cascade hard-delete
  await consumer.subscribe({
    topics: ['file.uploaded', 'file.deleted'],
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

      const fileId = event.file_id;
      console.log(`[Kafka Consumer] Event: ${event.event_type} | file: ${fileId}`);

      if (topic === 'file.uploaded') {
        try {
          await generatePreview(fileId);
          console.log(`[Kafka Consumer] Preview generated for ${fileId}`);
        } catch (e) {
          console.error(`[Kafka Consumer] Preview failed for ${fileId}:`, e.message);
          await Preview.upsert({ file_id: fileId, preview_path: '', status: 'failed', updated_at: new Date() });
          await producer.publishPreviewFailed(fileId, e.message);
        }
      }

      if (topic === 'file.deleted') {
        // Cascade hard-delete per PM1 spec
        await Preview.destroy({ where: { file_id: fileId } });
        await cache.del(fileId);
        console.log(`[Kafka Consumer] Preview cascade-deleted for ${fileId}`);
      }
    },
  });
}

async function stop() {
  await consumer.disconnect();
}

module.exports = { start, stop };
