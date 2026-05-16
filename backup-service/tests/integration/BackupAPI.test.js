const request = require('supertest');
const app = require('../../src/app');
const repository = require('../../src/repositories/BackupRepository');
const cloudClient = require('../../src/clients/CloudStorageClient');
const publisher = require('../../src/publishers/KafkaEventPublisher');

jest.mock('../../src/clients/CloudStorageClient');
jest.mock('../../src/publishers/KafkaEventPublisher');

describe('Backup API Integration Tests (Real Service Layer)', () => {
  beforeAll(async () => {
    await repository.init();
  });

  beforeEach(async () => {
    await repository.pool.query('DELETE FROM backup_runs');
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await repository.pool.end();
  });

  test('POST /backup/run should trigger backup and return 200', async () => {
    cloudClient.uploadSnapshot.mockResolvedValue({ url: 'http://mock/snap' });
    publisher.notifyCompletion.mockResolvedValue(true);

    const response = await request(app).post('/backup/run');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify in DB
    const history = await repository.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('FINISHED');
  });

  test('GET /backup/history should return history from real DB', async () => {
    // Seed DB
    await repository.createInitialLog();

    const response = await request(app).get('/backup/history');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  test('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
