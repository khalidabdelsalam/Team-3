import { logger } from '../../lib/logger.js';
import { publishNotificationSent } from '../../events/kafka.js';
import { fetchRecentNotifications, insertNotification } from './notification.repository.js';
import { buildNotificationFromEvent } from './notification.events.js';

async function dispatchNotification(notification) {
  logger.info(
    {
      to: notification.toAddress,
      subject: notification.subject,
      sourceTopic: notification.sourceTopic
    },
    'Dispatching notification'
  );

  return {
    ...notification,
    status: 'sent',
    sentAt: new Date().toISOString()
  };
}

export async function createManualNotification(input) {
  const sentNotification = await dispatchNotification({
    type: input.type,
    toAddress: input.to_address,
    subject: input.subject,
    message: input.message,
    metadata: input.metadata,
    sourceTopic: 'manual'
  });

  const saved = await insertNotification(sentNotification);
  await publishNotificationSent({
    notification_id: saved.id,
    type: saved.type,
    to_address: saved.to_address,
    source_topic: saved.source_topic,
    status: saved.status,
    sent_at: saved.sent_at
  });

  return saved;
}

export async function processEventNotification(topic, payload) {
  const notification = buildNotificationFromEvent(topic, payload);

  if (!notification) {
    logger.warn({ topic }, 'No notification mapper registered for topic');
    return null;
  }

  const sentNotification = await dispatchNotification(notification);
  const saved = await insertNotification(sentNotification);

  await publishNotificationSent({
    notification_id: saved.id,
    type: saved.type,
    to_address: saved.to_address,
    source_topic: saved.source_topic,
    status: saved.status,
    sent_at: saved.sent_at
  });

  return saved;
}

export async function listRecentNotifications(limit) {
  return fetchRecentNotifications(limit);
}
