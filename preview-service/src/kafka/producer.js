const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'preview-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
  retry: { retries: 5 },
});

const producer = kafka.producer();
let connected = false;

async function connect() {
  if (!connected) {
    await producer.connect();
    connected = true;
    console.log('[Kafka Producer] Connected');
  }
}

/**
 * Publish preview.generated event
 * Per project spec: Hybrid REST + Kafka — publishes preview.requested
 */
async function publishPreviewGenerated(fileId, previewPath) {
  await connect();
  const event = {
    event_type: 'preview.generated',
    file_id: fileId,
    preview_path: previewPath,
    timestamp: new Date().toISOString(),
  };
  await producer.send({
    topic: 'preview.generated',
    messages: [{ key: fileId, value: JSON.stringify(event) }],
  });
  console.log(`[Kafka Producer] Published preview.generated for ${fileId}`);
}

async function publishPreviewFailed(fileId, reason) {
  await connect();
  const event = {
    event_type: 'preview.failed',
    file_id: fileId,
    reason,
    timestamp: new Date().toISOString(),
  };
  await producer.send({
    topic: 'preview.failed',
    messages: [{ key: fileId, value: JSON.stringify(event) }],
  });
  console.warn(`[Kafka Producer] Published preview.failed for ${fileId}`);
}

async function disconnect() {
  if (connected) {
    await producer.disconnect();
    connected = false;
  }
}

module.exports = { publishPreviewGenerated, publishPreviewFailed, disconnect };
