import { pool } from '../../db/pool.js';

export async function insertNotification(notification) {
  const query = `
    INSERT INTO notifications (type, to_address, subject, message, source_topic, status, metadata, sent_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
    RETURNING id, type, to_address, subject, message, source_topic, status, metadata, created_at, sent_at;
  `;

  const values = [
    notification.type,
    notification.toAddress,
    notification.subject,
    notification.message,
    notification.sourceTopic ?? null,
    notification.status,
    JSON.stringify(notification.metadata ?? {}),
    notification.sentAt ?? null
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function fetchRecentNotifications(limit = 20) {
  const { rows } = await pool.query(
    `
      SELECT id, type, to_address, subject, message, source_topic, status, metadata, created_at, sent_at
      FROM notifications
      ORDER BY created_at DESC
      LIMIT $1;
    `,
    [limit]
  );

  return rows;
}
