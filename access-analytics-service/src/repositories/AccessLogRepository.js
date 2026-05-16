const { Pool } = require('pg');

class AccessLogRepository {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'user',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'access_analytics_db',
    });
    if (process.env.NODE_ENV !== 'test') {
      this.init();
    }
  }

  async init() {
    const query = `
      CREATE TABLE IF NOT EXISTS file_access_logs (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_file_id ON file_access_logs(file_id);
    `;
    try {
      await this.pool.query(query);
      console.log('AccessLog table initialized');
    } catch (err) {
      console.error('Error initializing table', err);
    }
  }

  async save(logEntry) {
    const { file_id, user_id, action } = logEntry;
    const query = 'INSERT INTO file_access_logs (file_id, user_id, action) VALUES ($1, $2, $3) RETURNING *';
    const values = [file_id, user_id, action];
    const res = await this.pool.query(query, values);
    return res.rows[0];
  }

  async findByFileId(fileId) {
    const query = 'SELECT * FROM file_access_logs WHERE file_id = $1 ORDER BY created_at DESC';
    const res = await this.pool.query(query, [fileId]);
    return res.rows;
  }
}

module.exports = new AccessLogRepository();
