import { env } from '../../config/env.js';

const topicHandlers = {
  [env.KAFKA_UPLOAD_COMPLETED_TOPIC]: (payload) => ({
    type: 'upload-completed',
    toAddress: payload.owner_email ?? env.DEFAULT_RECIPIENT,
    subject: `Upload complete for file ${payload.file_id ?? 'unknown'}`,
    message: `Upload session ${payload.upload_id ?? 'n/a'} finished successfully.`,
    metadata: payload
  }),
  [env.KAFKA_REPLICATION_COMPLETED_TOPIC]: (payload) => ({
    type: 'replication-completed',
    toAddress: payload.owner_email ?? env.DEFAULT_RECIPIENT,
    subject: `Replication completed for chunk ${payload.chunk_id ?? 'unknown'}`,
    message: `Replication finished with status ${payload.status ?? 'completed'}.`,
    metadata: payload
  }),
  [env.KAFKA_QUOTA_EXCEEDED_TOPIC]: (payload) => ({
    type: 'quota-exceeded',
    toAddress: payload.user_email ?? env.DEFAULT_RECIPIENT,
    subject: 'Storage quota exceeded',
    message: `User ${payload.user_id ?? 'unknown'} exceeded the storage quota.`,
    metadata: payload
  }),
  [env.KAFKA_BACKUP_COMPLETED_TOPIC]: (payload) => ({
    type: 'backup-completed',
    toAddress: payload.operator_email ?? env.DEFAULT_RECIPIENT,
    subject: `Backup ${payload.status ?? 'completed'}`,
    message: `Backup run ${payload.backup_run_id ?? 'unknown'} finished.`,
    metadata: payload
  }),
  [env.KAFKA_METRICS_THRESHOLD_TOPIC]: (payload) => ({
    type: 'metric-threshold-exceeded',
    toAddress: payload.ops_email ?? env.DEFAULT_RECIPIENT,
    subject: `Metric threshold exceeded: ${payload.service ?? 'unknown'} / ${payload.name ?? 'metric'}`,
    message: `Metric value ${payload.value ?? 'n/a'} crossed threshold ${payload.threshold ?? 'n/a'}.`,
    metadata: payload
  })
};

export function buildNotificationFromEvent(topic, payload) {
  const mapper = topicHandlers[topic];
  if (!mapper) {
    return null;
  }

  return {
    ...mapper(payload),
    sourceTopic: topic
  };
}
