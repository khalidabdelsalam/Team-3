import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  SERVICE_NAME: z.string().default('notification-service'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/notification_service'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('notification-service'),
  KAFKA_CONSUMER_GROUP: z.string().default('notification-group'),
  KAFKA_NOTIFICATION_SENT_TOPIC: z.string().default('notification.sent'),
  KAFKA_UPLOAD_COMPLETED_TOPIC: z.string().default('upload.completed'),
  KAFKA_REPLICATION_COMPLETED_TOPIC: z.string().default('replication.completed'),
  KAFKA_QUOTA_EXCEEDED_TOPIC: z.string().default('quota.exceeded'),
  KAFKA_BACKUP_COMPLETED_TOPIC: z.string().default('backup.completed'),
  KAFKA_METRICS_THRESHOLD_TOPIC: z.string().default('metrics.threshold.exceeded'),
  DEFAULT_RECIPIENT: z.string().email().default('ops@example.com')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = {
  ...parsed.data,
  kafkaBrokers: parsed.data.KAFKA_BROKERS.split(',').map((broker) => broker.trim())
};
