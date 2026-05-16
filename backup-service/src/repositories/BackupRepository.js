const { Pool } = require('pg');

class BackupRepository {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'user',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'backup_db',
    });
    if (process.env.NODE_ENV !== 'test') {
      this.init();
    }
  }

  async init() {
    const query = `
      CREATE TABLE IF NOT EXISTS backup_runs (
        id SERIAL PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP
      );
    `;
    try {
      await this.pool.query(query);
      console.log('Backup table initialized');
    } catch (err) {
      console.error('Error initializing table', err);
    }
  }

  async createInitialLog() {
    const query = 'INSERT INTO backup_runs (status) VALUES ($1) RETURNING *';
    const res = await this.pool.query(query, ['STARTED']);
    return res.rows[0];
  }

  async updateStatus(id, status) {
    const query = 'UPDATE backup_runs SET status = $1, finished_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
    const res = await this.pool.query(query, [status, id]);
    return res.rows[0];
  }

  async getHistory() {
    const query = 'SELECT * FROM backup_runs ORDER BY started_at DESC';
    const res = await this.pool.query(query);
    return res.rows;
  }
}

module.exports = new BackupRepository();
