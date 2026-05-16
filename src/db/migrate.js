import { pool } from './pool.js';
import { logger } from '../lib/logger.js';

const migrationSql = `
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(80) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  source_topic VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_status_created_at
  ON notifications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_to_address_created_at
  ON notifications (to_address, created_at DESC);
`;

try {
  await pool.query(migrationSql);
  logger.info('Notification schema migration completed');
} catch (error) {
  logger.error({ err: error }, 'Notification schema migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
