const webhookRepository = require('../repositories/webhookRepository');

async function createPendingLog(webhook, eventPayload, maxRetries) {
  try {
    const logEntry = await webhookRepository.createWebhookLog({
      webhook: webhook._id,
      eventId: eventPayload.eventId,
      eventType: eventPayload.type,
      endpoint: webhook.url,
      payload: eventPayload,
      source: eventPayload.source,
      status: 'PENDING',
      retryCount: 0,
      maxRetries
    });

    return {
      logEntry,
      duplicate: false
    };
  } catch (error) {
    if (error && error.code === 11000) {
      const logEntry = await webhookRepository.findWebhookLogByWebhookAndEvent(
        webhook._id,
        eventPayload.eventId
      );

      return {
        logEntry,
        duplicate: true
      };
    }

    throw error;
  }
}

async function save(logEntry) {
  return webhookRepository.saveWebhookLog(logEntry);
}

module.exports = {
  createPendingLog,
  save
};
