const crypto = require('crypto');

const { eventProfiles, supportedEventTypes } = require('../config/eventTypes');
const logger = require('../config/logger');
const webhookDeliveryService = require('./webhookDeliveryService');
const webhookRepository = require('../repositories/webhookRepository');
//يعمل ID للـ Event لو مفيش ID موجود.

function generateEventId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

//بيوحد شكل الـ Event.
function normalizeEvent(rawEvent, source = 'unknown') {
  if (!rawEvent || typeof rawEvent !== 'object') {
    throw new Error('Event payload must be an object.');
  }

  const eventType = String(
    rawEvent.type || rawEvent.eventType || rawEvent.event || ''
  )
    .trim()
    .toUpperCase();

  if (!eventType) {
    throw new Error('Event type is required.');
  }

  return {
    eventId: String(rawEvent.eventId || rawEvent.id || generateEventId()),
    type: eventType,
    payload: rawEvent.payload ?? rawEvent.data ?? {},
    metadata: rawEvent.metadata && typeof rawEvent.metadata === 'object' ? rawEvent.metadata : {},
    source: rawEvent.source || source,
    occurredAt: rawEvent.occurredAt || rawEvent.createdAt || new Date().toISOString()
  };
}
//يبني الـ Payload اللي هيتبعت للـ external webhook.
function buildDispatchPayload(event) {
  const eventProfile = eventProfiles[event.type] || {
    category: 'custom',
    description: 'Custom event.'
  };

  return {
    eventId: event.eventId,
    type: event.type,
    category: eventProfile.category,
    description: eventProfile.description,
    occurredAt: event.occurredAt,
    source: event.source,
    metadata: event.metadata,
    payload: event.payload
  };
}

async function processEvent(rawEvent, context = { source: 'unknown' }) {
  const normalizedEvent = normalizeEvent(rawEvent, context.source);
  const dispatchPayload = buildDispatchPayload(normalizedEvent);
  const matchedWebhooks = await webhookRepository.findActiveWebhooksByEvent(
    normalizedEvent.type
  );

  if (!supportedEventTypes.includes(normalizedEvent.type)) {
    logger.warn('Received an unsupported event type. Dispatch will continue for matching endpoints.', {
      eventType: normalizedEvent.type
    });
  }

  if (matchedWebhooks.length === 0) {
    logger.warn('No webhook endpoints found for event type.', {
      eventType: normalizedEvent.type
    });

    return {
      eventId: normalizedEvent.eventId,
      eventType: normalizedEvent.type,
      matchedWebhooks: 0,
      successCount: 0,
      failureCount: 0,
      deliveries: []
    };
  }

  const settledDeliveries = await Promise.allSettled(
    matchedWebhooks.map((webhook) => webhookDeliveryService.dispatchToWebhook(webhook, dispatchPayload))
  );

  const deliveries = settledDeliveries.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    return {
      status: 'FAILED',
      error: result.reason ? result.reason.message : 'Unknown delivery failure.'
    };
  });

  const successCount = deliveries.filter((delivery) => (
    delivery.status === 'SUCCESS' || delivery.status === 'SUCCESS_AFTER_RETRY'
  )).length;
  const duplicateCount = deliveries.filter((delivery) => delivery.status === 'DUPLICATE_SKIPPED').length;
  const failureCount = deliveries.length - successCount - duplicateCount;

  logger.info('Event processed successfully.', {
    eventType: normalizedEvent.type,
    matchedWebhooks: matchedWebhooks.length,
    successCount,
    duplicateCount,
    failureCount
  });

  return {
    eventId: normalizedEvent.eventId,
    eventType: normalizedEvent.type,
    matchedWebhooks: matchedWebhooks.length,
    successCount,
    duplicateCount,
    failureCount,
    deliveries
  };
}

module.exports = {
  processEvent,
  handleEvent: processEvent,
  normalizeEvent,
  buildDispatchPayload
};
