/**
 * Compression Service — Integration Tests
 * Starts Express app and hits real HTTP endpoints
 * Uses supertest
 */

jest.mock('../../src/tracing', () => ({}));
jest.mock('../../src/kafka/consumer', () => ({
  start: jest.fn().mockResolvedValue(undefined),
  stop:  jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/kafka/producer', () => ({
  publishCompressionCompleted: jest.fn().mockResolvedValue(undefined),
  publishCompressionFailed:    jest.fn().mockResolvedValue(undefined),
  publishCompressionRequested: jest.fn().mockResolvedValue(undefined),
  disconnect:                  jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/db/connection', () => ({
  authenticate: jest.fn().mockResolvedValue(undefined),
  sync:         jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/db/models/CompressionJob', () => ({
  create:   jest.fn(),
  update:   jest.fn(),
  findOne:  jest.fn(),
  findAll:  jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock('../../src/adapters/configClient', () => ({
  getAlgorithm:            jest.fn().mockResolvedValue('gzip'),
  getMaxFileSizeMB:        jest.fn().mockResolvedValue(500),
  getLargeFileThresholdMB: jest.fn().mockResolvedValue(10),
}));
jest.mock('../../src/adapters/fileRegistryClient', () => ({
  getFileMetadata: jest.fn(),
}));
jest.mock('../../src/adapters/storageClient', () => ({
  getRawBytes:   jest.fn(),
  putCompressed: jest.fn(),
  getCompressed: jest.fn(),
}));
jest.mock('../../src/adapters/metricsClient', () => ({
  reportStats: jest.fn().mockResolvedValue(undefined),
  push:        jest.fn().mockResolvedValue(undefined),
}));

const request        = require('supertest');
const express        = require('express');
const routes         = require('../../src/api/routes');
const { success, error } = require('../../src/middleware/response');
const sequelize      = require('../../src/db/connection');
const CompressionJob = require('../../src/db/models/CompressionJob');
const fileRegistry   = require('../../src/adapters/fileRegistryClient');
const storage        = require('../../src/adapters/storageClient');

const app = express();
app.use(express.json());
app.get('/health', (req, res) => success(res, { status: 'ok', service: 'compression-service' }));
app.get('/ready', async (req, res) => {
  try { await sequelize.authenticate(); success(res, { status: 'ready', db: 'connected' }); }
  catch (e) { error(res, 'NOT_READY', 'DB error', {}, 503); }
});
app.use('/', routes);

describe('Compression Service — Integration Tests', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── Test 1: Health check
  test('1. GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.service).toBe('compression-service');
  });

  // ── Test 2: Ready check
  test('2. GET /ready returns 200 when DB is connected', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
  });

  // ── Test 3: POST /compress missing file_id
  test('3. POST /compress returns 400 when file_id is missing', async () => {
    const res = await request(app).post('/compress').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_FILE_ID');
  });

  // ── Test 4: POST /compress success
  test('4. POST /compress returns 200 with job_id and ratio on success', async () => {
    const fileId  = 'integration-compress-001';
    const mockJob = { id: 'job-int-001', update: jest.fn().mockResolvedValue(undefined) };
    CompressionJob.create.mockResolvedValue(mockJob);
    fileRegistry.getFileMetadata.mockResolvedValue({ chunk_id: fileId, mime_type: 'text/plain', size: 1000 });
    storage.getRawBytes.mockResolvedValue(Buffer.from('integration test content '.repeat(100)));
    storage.putCompressed.mockResolvedValue(`compressed/${fileId}.gz`);

    const res = await request(app)
      .post('/compress')
      .send({ file_id: fileId, algorithm: 'gzip' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('job_id');
    expect(res.body.data).toHaveProperty('ratio');
    expect(res.body.data.status).toBe('completed');
  });

  // ── Test 5: POST /decompress missing file_id
  test('5. POST /decompress returns 400 when file_id is missing', async () => {
    const res = await request(app).post('/decompress').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_FILE_ID');
  });

  // ── Test 6: POST /decompress no completed job found
  test('6. POST /decompress returns 500 when no completed job exists', async () => {
    CompressionJob.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/decompress')
      .send({ file_id: 'unknown-file' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  // ── Test 7: GET /jobs/:file_id not found
  test('7. GET /jobs/:file_id returns 404 when no jobs exist for file', async () => {
    CompressionJob.findAll.mockResolvedValue([]);

    const res = await request(app).get('/jobs/nonexistent-file');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ── Test 8: Response structure includes meta
  test('8. All responses include meta.service = compression-service', async () => {
    const res = await request(app).get('/health');
    expect(res.body.meta).toHaveProperty('service', 'compression-service');
    expect(res.body.meta).toHaveProperty('request_id');
  });
});
