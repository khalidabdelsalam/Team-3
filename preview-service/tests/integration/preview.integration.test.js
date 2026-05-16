/**
 * Preview Service — Integration Tests
 * Starts the Express app and hits real HTTP endpoints
 * Uses supertest for HTTP testing
 * DB is mocked via jest.mock to avoid needing a real PostgreSQL instance in CI
 */

jest.mock('../../src/tracing', () => ({}));
jest.mock('../../src/kafka/consumer', () => ({
  start: jest.fn().mockResolvedValue(undefined),
  stop:  jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/kafka/producer', () => ({
  publishPreviewGenerated: jest.fn().mockResolvedValue(undefined),
  publishPreviewFailed:    jest.fn().mockResolvedValue(undefined),
  disconnect:              jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/db/connection', () => ({
  authenticate: jest.fn().mockResolvedValue(undefined),
  sync:         jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/db/models/Preview', () => ({
  upsert:    jest.fn().mockResolvedValue([{}, true]),
  findByPk:  jest.fn(),
  destroy:   jest.fn().mockResolvedValue(1),
}));
jest.mock('../../src/adapters/redisCache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/adapters/fileRegistryClient', () => ({
  getFileMetadata: jest.fn(),
}));
jest.mock('../../src/adapters/storageClient', () => ({
  getRawBytes:  jest.fn(),
  putThumbnail: jest.fn(),
}));
jest.mock('../../src/adapters/metricsClient', () => ({
  reportPreviewGenerated: jest.fn().mockResolvedValue(undefined),
  reportCacheHit:         jest.fn().mockResolvedValue(undefined),
  reportError:            jest.fn().mockResolvedValue(undefined),
}));

const request      = require('supertest');
const express      = require('express');
const previewRoutes = require('../../src/api/routes');
const { success, error } = require('../../src/middleware/response');
const Preview      = require('../../src/db/models/Preview');
const cache        = require('../../src/adapters/redisCache');
const fileRegistry = require('../../src/adapters/fileRegistryClient');
const storage      = require('../../src/adapters/storageClient');
const sequelize    = require('../../src/db/connection');

// Build minimal app for integration testing
const app = express();
app.use(express.json());
app.get('/health', (req, res) => success(res, { status: 'ok', service: 'preview-service' }));
app.get('/ready',  async (req, res) => {
  try { await sequelize.authenticate(); success(res, { status: 'ready', db: 'connected' }); }
  catch (e) { error(res, 'NOT_READY', 'DB not connected', {}, 503); }
});
app.use('/preview', previewRoutes);

// ─────────────────────────────────────────────────────────────────────────────

describe('Preview Service — Integration Tests', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── Integration Test 1: GET /health returns 200
  test('1. GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.service).toBe('preview-service');
  });

  // ── Integration Test 2: GET /ready returns 200 when DB connected
  test('2. GET /ready returns 200 when database is connected', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ready');
  });

  // ── Integration Test 3: POST /preview/generate with missing file_id returns 400
  test('3. POST /preview/generate returns 400 when file_id is missing', async () => {
    const res = await request(app)
      .post('/preview/generate')
      .send({});  // no file_id

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_FILE_ID');
  });

  // ── Integration Test 4: POST /preview/generate success flow
  test('4. POST /preview/generate returns 200 with preview_url on success', async () => {
    const fileId = 'integration-test-file';
    cache.get.mockResolvedValue(null);
    fileRegistry.getFileMetadata.mockResolvedValue({
      file_id: fileId, chunk_id: fileId, mime_type: 'image/png',
    });
    storage.getRawBytes.mockResolvedValue(Buffer.alloc(100, 128));
    storage.putThumbnail.mockResolvedValue(`previews/${fileId}.png`);

    const res = await request(app)
      .post('/preview/generate')
      .send({ file_id: fileId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('preview_url');
    expect(res.body.data.file_id).toBe(fileId);
  });

  // ── Integration Test 5: GET /preview/:file_id cache hit returns 200
  test('5. GET /preview/:file_id returns 200 from Redis cache', async () => {
    const fileId = 'cached-file-id';
    cache.get.mockResolvedValue(`previews/${fileId}.png`);

    const res = await request(app).get(`/preview/${fileId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cached).toBe(true);
    expect(res.body.data.preview_url).toContain(fileId);
  });

  // ── Integration Test 6: GET /preview/:file_id not found returns 404
  test('6. GET /preview/:file_id returns 404 when no preview exists', async () => {
    const fileId = 'no-preview-file';
    cache.get.mockResolvedValue(null);
    Preview.findByPk.mockResolvedValue(null);

    const res = await request(app).get(`/preview/${fileId}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ── Integration Test 7: DELETE /preview/:file_id removes preview
  test('7. DELETE /preview/:file_id returns 200 and cleans up cache and DB', async () => {
    const fileId = 'file-to-delete';
    Preview.destroy.mockResolvedValue(1);
    cache.del.mockResolvedValue(undefined);

    const res = await request(app).delete(`/preview/${fileId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Preview.destroy).toHaveBeenCalledWith({ where: { file_id: fileId } });
    expect(cache.del).toHaveBeenCalledWith(fileId);
  });

  // ── Integration Test 8: Standard response includes meta.service and meta.request_id
  test('8. All responses include meta.service and meta.request_id fields', async () => {
    const res = await request(app).get('/health');
    expect(res.body.meta).toHaveProperty('service', 'preview-service');
    expect(res.body.meta).toHaveProperty('request_id');
    expect(typeof res.body.meta.request_id).toBe('string');
  });
});
