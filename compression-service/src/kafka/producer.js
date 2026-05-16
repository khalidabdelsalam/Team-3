const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'compression-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
  retry: { retries: 5 },
});

const producer = kafka.producer();
let connected  = false;

async function connect() {
  if (!connected) {
    await producer.connect();
    connected = true;
    console.log('[Kafka Producer] Connected');
  }
}

async function publishCompressionCompleted(jobId, fileId, ratio, compressedPath, algorithm) {
  await connect();
  await producer.send({
    topic: 'compression.completed',
    messages: [{
      key: fileId,
      value: JSON.stringify({
        event_type: 'compression.completed',
        job_id: jobId, file_id: fileId,
        ratio, compressed_path: compressedPath, algorithm,
        timestamp: new Date().toISOString(),
      }),
    }],
  });
  console.log(`[Kafka Producer] Published compression.completed for ${fileId}`);
}

async function publishCompressionFailed(jobId, fileId, reason) {
  await connect();
  await producer.send({
    topic: 'compression.failed',
    messages: [{
      key: fileId,
      value: JSON.stringify({
        event_type: 'compression.failed',
        job_id: jobId, file_id: fileId, reason,
        timestamp: new Date().toISOString(),
      }),
    }],
  });
  console.warn(`[Kafka Producer] Published compression.failed for ${fileId}`);
}

// Per project spec: Large files publish compression.requested
async function publishCompressionRequested(fileId, algorithm) {
  await connect();
  await producer.send({
    topic: 'compression.requested',
    messages: [{
      key: fileId,
      value: JSON.stringify({
        event_type: 'compression.requested',
        file_id: fileId, algorithm,
        timestamp: new Date().toISOString(),
      }),
    }],
  });
  console.log(`[Kafka Producer] Published compression.requested for large file ${fileId}`);
}

async function disconnect() {
  if (connected) { await producer.disconnect(); connected = false; }
}

module.exports = {
  publishCompressionCompleted,
  publishCompressionFailed,
  publishCompressionRequested,
  disconnect,
};
