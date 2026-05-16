//يحول response body إلى string مختصر.
//عشان نخزن response في log، لكن مش نخزن body ضخم.
const config = require('../config/config');
const logger = require('../config/logger');
const deliveryLogger = require('./deliveryLogger');
const retryManager = require('./retryManager');
const webhookDispatcher = require('./webhookDispatcher');
const webhookProducer = require('../kafka/webhookProducer');

function serializeBody(body) {
  if (body === null || body === undefined) {
    return '';
  }

  if (typeof body === 'string') {
    return body.slice(0, 2000);
  }

  try {
    return JSON.stringify(body).slice(0, 2000);
  } catch (error) {
    return '[unserializable-response-body]';
  }
}

function normalizeDeliveryError(error) {
  if (error.response) {
    return {
      httpStatus: error.response.status,
      responseBody: serializeBody(error.response.data),
      message: `Webhook returned status ${error.response.status}.`
    };
  }

  if (error.code === 'ECONNABORTED') {
    return {
      httpStatus: null,
      responseBody: '',
      message: `Webhook request timed out after ${config.webhook.timeoutMs}ms.`
    };
  }

  return {
    httpStatus: null,
    responseBody: '',
    message: error.message || 'Webhook request failed.'
  };
}

async function dispatchToWebhook(webhook, eventPayload) {
  const totalAttempts = config.webhook.retryCount + 1;

  const pendingDelivery = await deliveryLogger.createPendingLog(
    webhook,
    eventPayload,
    config.webhook.retryCount
  );
  const { logEntry, duplicate } = pendingDelivery;

  if (duplicate) {
    logger.warn('Duplicate webhook delivery skipped.', {
      endpoint: webhook.url,
      eventId: eventPayload.eventId,
      eventType: eventPayload.type,
      existingStatus: logEntry ? logEntry.status : 'unknown'
    });

    return {
      status: 'DUPLICATE_SKIPPED',
      endpoint: webhook.url,
      eventId: eventPayload.eventId,
      attempts: logEntry ? logEntry.attempts.length : 0,
      httpStatus: logEntry ? logEntry.httpStatus : null
    };
  }

  for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber += 1) {
    const startedAt = Date.now();

    try {
      const response = await webhookDispatcher.send(webhook, eventPayload);

      const durationMs = Date.now() - startedAt;
      const responseBody = serializeBody(response.data);
      const isSuccessfulStatus = response.status >= 200 && response.status < 300;

      logEntry.attempts.push({
        attemptNumber,
        httpStatus: response.status,
        responseBody,
        errorMessage: isSuccessfulStatus ? undefined : `Webhook returned status ${response.status}.`,
        attemptedAt: new Date(),
        durationMs,
        succeeded: isSuccessfulStatus
      });
      logEntry.retryCount = attemptNumber - 1;
      logEntry.httpStatus = response.status;
      logEntry.lastAttemptAt = new Date();
      logEntry.lastResponseBody = responseBody;

      if (isSuccessfulStatus) {
        logEntry.status = attemptNumber > 1 ? 'SUCCESS_AFTER_RETRY' : 'SUCCESS';
        logEntry.deliveredAt = new Date();
        logEntry.lastError = undefined;
        logEntry.nextRetryAt = undefined;
        await deliveryLogger.save(logEntry);

        await webhookProducer.publishWebhookStatus('WEBHOOK_DELIVERED', {
          eventId: eventPayload.eventId,
          eventType: eventPayload.type,
          endpoint: webhook.url,
          httpStatus: response.status,
          retryCount: attemptNumber - 1
        });

        return {
          status: attemptNumber > 1 ? 'SUCCESS_AFTER_RETRY' : 'SUCCESS',
          endpoint: webhook.url,
          eventId: eventPayload.eventId,
          attempts: attemptNumber,
          httpStatus: response.status
        };
      }

      const hasNextAttempt = attemptNumber < totalAttempts;
      const delayMs = retryManager.getDelayForAttempt(attemptNumber);

      logEntry.status = hasNextAttempt ? 'RETRYING' : 'FAILED';
      logEntry.lastError = `Webhook returned status ${response.status}.`;
      logEntry.nextRetryAt = hasNextAttempt ? new Date(Date.now() + delayMs) : undefined;
      await deliveryLogger.save(logEntry);

      if (!hasNextAttempt) {
        logger.error('Webhook delivery failed after all retry attempts.', {
          endpoint: webhook.url,
          eventType: eventPayload.type,
          httpStatus: response.status
        });

        await webhookProducer.publishWebhookStatus('WEBHOOK_FAILED', {
          eventId: eventPayload.eventId,
          eventType: eventPayload.type,
          endpoint: webhook.url,
          httpStatus: response.status,
          retryCount: attemptNumber - 1,
          error: logEntry.lastError
        });
        await webhookProducer.publishDeadLetter({
          eventId: eventPayload.eventId,
          eventType: eventPayload.type,
          endpoint: webhook.url,
          httpStatus: response.status,
          retryCount: attemptNumber - 1,
          error: logEntry.lastError,
          payload: eventPayload
        });

        return {
          status: 'FAILED',
          endpoint: webhook.url,
          eventId: eventPayload.eventId,
          attempts: attemptNumber,
          httpStatus: response.status,
          error: logEntry.lastError
        };
      }

      logger.warn(`Retrying webhook delivery attempt ${attemptNumber + 1}.`, {
        endpoint: webhook.url,
        eventType: eventPayload.type,
        delayMs
      });

      await retryManager.waitForRetry(attemptNumber);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const normalizedError = normalizeDeliveryError(error);
      const hasNextAttempt = attemptNumber < totalAttempts;
      const delayMs = retryManager.getDelayForAttempt(attemptNumber);

      logEntry.attempts.push({
        attemptNumber,
        httpStatus: normalizedError.httpStatus || undefined,
        responseBody: normalizedError.responseBody,
        errorMessage: normalizedError.message,
        attemptedAt: new Date(),
        durationMs,
        succeeded: false
      });
      logEntry.retryCount = attemptNumber - 1;
      logEntry.httpStatus = normalizedError.httpStatus || undefined;
      logEntry.lastAttemptAt = new Date();
      logEntry.lastResponseBody = normalizedError.responseBody;
      logEntry.lastError = normalizedError.message;
      logEntry.status = hasNextAttempt ? 'RETRYING' : 'FAILED';
      logEntry.nextRetryAt = hasNextAttempt ? new Date(Date.now() + delayMs) : undefined;
      await deliveryLogger.save(logEntry);

      if (!hasNextAttempt) {
        logger.error('Webhook delivery failed after all retry attempts.', {
          endpoint: webhook.url,
          eventType: eventPayload.type,
          error: normalizedError.message
        });

        await webhookProducer.publishWebhookStatus('WEBHOOK_FAILED', {
          eventId: eventPayload.eventId,
          eventType: eventPayload.type,
          endpoint: webhook.url,
          httpStatus: normalizedError.httpStatus,
          retryCount: attemptNumber - 1,
          error: normalizedError.message
        });
        await webhookProducer.publishDeadLetter({
          eventId: eventPayload.eventId,
          eventType: eventPayload.type,
          endpoint: webhook.url,
          httpStatus: normalizedError.httpStatus,
          retryCount: attemptNumber - 1,
          error: normalizedError.message,
          payload: eventPayload
        });

        return {
          status: 'FAILED',
          endpoint: webhook.url,
          eventId: eventPayload.eventId,
          attempts: attemptNumber,
          httpStatus: normalizedError.httpStatus,
          error: normalizedError.message
        };
      }

      logger.warn(`Retrying webhook delivery attempt ${attemptNumber + 1}.`, {
        endpoint: webhook.url,
        eventType: eventPayload.type,
        delayMs
      });

      await retryManager.waitForRetry(attemptNumber);
    }
  }

  return {
    status: 'FAILED',
    endpoint: webhook.url,
    eventId: eventPayload.eventId,
    attempts: totalAttempts,
    error: 'Webhook delivery exhausted retries.'
  };
}

module.exports = {
  dispatchToWebhook
};
