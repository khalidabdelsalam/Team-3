const request = require('supertest');
const app = require('../../src/app');
const repository = require('../../src/repositories/AccessLogRepository');

describe('Analytics API Integration Tests (Real Service Layer)', () => {
  beforeAll(async () => {
    // Ensure table exists
    await repository.init();
  });

  beforeEach(async () => {
    // Clean database between runs
    await repository.pool.query('DELETE FROM file_access_logs');
  });

  afterAll(async () => {
    await repository.pool.end();
  });

  test('POST /access/log should save to real DB and return 200', async () => {
    const logData = { file_id: '123', user_id: 'user1', action: 'view' };
    
    const response = await request(app)
      .post('/access/log')
      .send(logData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // Verify in DB
    const inDb = await repository.findByFileId('123');
    expect(inDb).toHaveLength(1);
    expect(inDb[0].action).toBe('view');
  });

  test('GET /analytics/file/:id should return logs from real DB', async () => {
    // Seed DB
    await repository.save({ file_id: '456', user_id: 'u1', action: 'download' });
    await repository.save({ file_id: '456', user_id: 'u2', action: 'view' });

    const response = await request(app).get('/analytics/file/456');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  test('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
