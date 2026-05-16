const { Kafka } = require('kafkajs');

const SERVICE_URL = process.env.SMOKE_SERVICE_URL || 'http://127.0.0.1:3001';
const RECEIVER_URL = process.env.SMOKE_RECEIVER_URL || 'http://webhook-receiver:8080/webhooks/ingest';
const API_KEY = process.env.SMOKE_API_KEY || process.env.API_KEY || '';
const KAFKA_BROKERS = (process.env.SMOKE_KAFKA_BROKERS || '127.0.0.1:29092')
  .split(',')
  .map((broker) => broker.trim())
  .filter(Boolean);
const KAFKA_TOPIC = process.env.SMOKE_KAFKA_TOPIC || 'events';

function fail(message) {
  throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${SERVICE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    fail(`Request ${path} failed with ${response.status}: ${text}`);
  }

  return body;
}

async function waitFor(predicate, label, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await predicate();

    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  fail(`Timed out waiting for ${label}.`);
}

async function waitForLog(eventId, expectedEventType) {
  return waitFor(async () => {
    const response = await request('/api/webhook-logs?limit=200');
    const logs = response.data || [];

    return logs.find((log) => (
      log.eventId === eventId &&
      log.eventType === expectedEventType &&
      (log.status === 'SUCCESS' || log.status === 'SUCCESS_AFTER_RETRY')
    ));
  }, `successful webhook log for ${eventId}`);
}

async function publishKafkaEvent(event) {
  const kafka = new Kafka({
    clientId: 'webhook-service-smoke-test',
    brokers: KAFKA_BROKERS
  });
  const producer = kafka.producer();

  await producer.connect();

  try {
    await producer.send({
      topic: KAFKA_TOPIC,
      messages: [
        {
          key: event.eventId,
          value: JSON.stringify(event)
        }
      ]
    });
  } finally {
    await producer.disconnect();
  }
}

async function main() {
  const runId = Date.now();
  const manualEventId = `smoke-manual-${runId}`;
  const kafkaEventId = `smoke-kafka-${runId}`;

  await waitFor(async () => {
    try {
      return await request('/health');
    } catch (error) {
      return null;
    }
  }, 'healthy webhook service', 60000);

  await request('/api/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      name: `smoke-receiver-${runId}`,
      url: RECEIVER_URL,
      events: ['FILE_UPLOADED', 'BACKUP_COMPLETED'],
      headers: {
        'x-smoke-test': String(runId)
      },
      active: true
    })
  });

  const manualResult = await request('/test-webhook', {
    method: 'POST',
    body: JSON.stringify({
      eventId: manualEventId,
      type: 'FILE_UPLOADED',
      payload: {
        fileId: 'file-smoke-manual'
      },
      metadata: {
        smoke: true
      }
    })
  });

  if (manualResult.data.successCount < 1) {
    fail('Manual test did not report a successful delivery.');
  }

  await waitForLog(manualEventId, 'FILE_UPLOADED');

  await publishKafkaEvent({
    eventId: kafkaEventId,
    type: 'BACKUP_COMPLETED',
    payload: {
      backupId: 'backup-smoke-kafka'
    },
    metadata: {
      smoke: true
    }
  });

  await waitForLog(kafkaEventId, 'BACKUP_COMPLETED');

  console.log('Smoke test passed: manual route, Kafka route, webhook delivery, retries/log schema, and MongoDB logging are working.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
