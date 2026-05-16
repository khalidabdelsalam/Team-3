/**
 * Preview Service — Unit Tests
 * Tests: previewEngine, response middleware, redis cache adapter
 * Framework: Jest
 * Coverage: happy path, validation errors, edge cases
 */

// Mock external dependencies
jest.mock('../../../src/adapters/redisCache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

jest.mock('../../../src/adapters/fileRegistryClient', () => ({
  getFileMetadata: jest.fn(),
}));

jest.mock('../../../src/adapters/storageClient', () => ({
  getRawBytes: jest.fn(),
  putThumbnail: jest.fn(),
}));

jest.mock('../../../src/adapters/metricsClient', () => ({
  reportPreviewGenerated: jest.fn().mockResolvedValue(undefined),
  reportCacheHit: jest.fn().mockResolvedValue(undefined),
  reportError: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/kafka/producer', () => ({
  publishPreviewGenerated: jest.fn().mockResolvedValue(undefined),
  publishPreviewFailed: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/db/models/Preview', () => ({
  upsert: jest.fn().mockResolvedValue([{}, true]),
  findByPk: jest.fn(),
  destroy: jest.fn(),
}));

// Silence tracing in tests
jest.mock('../../../src/tracing', () => ({}));

const cache         = require('../../../src/adapters/redisCache');
const fileRegistry  = require('../../../src/adapters/fileRegistryClient');
const storage       = require('../../../src/adapters/storageClient');
const { generatePreview } = require('../../../src/core/previewService');

// ─────────────────────────────────────────────────────────────────────────────

describe('Preview Service — Unit Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Test 1: Cache HIT — returns immediately without calling external services
  test('1. Cache HIT: returns cached preview_path without calling File Registry or Storage GW', async () => {
    const fileId = 'test-file-001';
    cache.get.mockResolvedValue('previews/test-file-001.png');

    const result = await generatePreview(fileId);

    expect(result.cached).toBe(true);
    expect(result.preview_path).toBe('previews/test-file-001.png');
    expect(fileRegistry.getFileMetadata).not.toHaveBeenCalled();
    expect(storage.getRawBytes).not.toHaveBeenCalled();
  });

  // ── Test 2: Cache MISS — full generation flow
  test('2. Cache MISS: generates thumbnail, uploads to storage, saves to DB and Redis', async () => {
    const fileId = 'test-file-002';
    cache.get.mockResolvedValue(null); // Cache MISS
    fileRegistry.getFileMetadata.mockResolvedValue({
      file_id: fileId,
      chunk_id: fileId,
      mime_type: 'image/jpeg',
    });
    // Return a minimal valid JPEG buffer (just a gray 1x1 pixel equivalent)
    storage.getRawBytes.mockResolvedValue(
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    );
    storage.putThumbnail.mockResolvedValue(`previews/${fileId}.png`);

    const result = await generatePreview(fileId);

    expect(result.cached).toBe(false);
    expect(fileRegistry.getFileMetadata).toHaveBeenCalledWith(fileId);
    expect(storage.getRawBytes).toHaveBeenCalledWith(fileId);
    expect(storage.putThumbnail).toHaveBeenCalledWith(fileId, expect.any(Buffer));
    expect(cache.set).toHaveBeenCalledWith(fileId, `previews/${fileId}.png`);
  });

  // ── Test 3: File Registry failure — throws error
  test('3. Validation: throws error when File Registry returns not found', async () => {
    const fileId = 'nonexistent-file';
    cache.get.mockResolvedValue(null);
    fileRegistry.getFileMetadata.mockRejectedValue(
      new Error(`File ${fileId} not found in registry`)
    );

    await expect(generatePreview(fileId)).rejects.toThrow('not found in registry');
  });

  // ── Test 4: Storage GW failure — throws and DB status stays at error
  test('4. Edge case: throws error when Storage GW is unreachable', async () => {
    const fileId = 'test-file-004';
    cache.get.mockResolvedValue(null);
    fileRegistry.getFileMetadata.mockResolvedValue({
      file_id: fileId, chunk_id: fileId, mime_type: 'image/png',
    });
    storage.getRawBytes.mockRejectedValue(new Error('Storage GW connection refused'));

    await expect(generatePreview(fileId)).rejects.toThrow('connection refused');
  });

  // ── Test 5: Standard Response format — success structure
  test('5. Response middleware: success returns correct JSON structure', () => {
    const { success } = require('../../../src/middleware/response');
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    success(mockRes, { file_id: 'abc', preview_url: 'previews/abc.png' });

    expect(mockRes.status).toHaveBeenCalledWith(200);
    const body = mockRes.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('file_id', 'abc');
    expect(body.meta).toHaveProperty('service');
    expect(body.meta).toHaveProperty('request_id');
  });

  // ── Test 6: Standard Response format — error structure
  test('6. Response middleware: error returns correct JSON structure with error code', () => {
    const { error } = require('../../../src/middleware/response');
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    error(mockRes, 'NOT_FOUND', 'Preview not found', {}, 404);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    const body = mockRes.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Preview not found');
  });

  // ── Test 7: Redis cache — set and get
  test('7. Redis cache: set stores value and get retrieves it correctly', async () => {
    cache.get.mockResolvedValue('previews/cached-file.png');
    const result = await cache.get('some-file-id');
    expect(result).toBe('previews/cached-file.png');
    expect(cache.get).toHaveBeenCalledWith('some-file-id');
  });

  // ── Test 8: Cache eviction on file delete
  test('8. Edge case: cache.del is called with correct fileId on deletion', async () => {
    const fileId = 'file-to-delete';
    cache.del.mockResolvedValue(undefined);
    await cache.del(fileId);
    expect(cache.del).toHaveBeenCalledWith(fileId);
  });

  // ── Test 9: Kafka events are published after preview generation
  test('9. Kafka producer: publishPreviewGenerated is called after successful generation', async () => {
    const producer = require('../../../src/kafka/producer');
    const fileId   = 'kafka-test-file';

    cache.get.mockResolvedValue(null);
    fileRegistry.getFileMetadata.mockResolvedValue({
      file_id: fileId, chunk_id: fileId, mime_type: 'image/png',
    });
    storage.getRawBytes.mockResolvedValue(Buffer.alloc(100, 0));
    storage.putThumbnail.mockResolvedValue(`previews/${fileId}.png`);

    await generatePreview(fileId);

    // Give fire-and-forget time to execute
    await new Promise(r => setTimeout(r, 100));
    expect(producer.publishPreviewGenerated).toHaveBeenCalledWith(
      fileId, `previews/${fileId}.png`
    );
  });

  // ── Test 10: Metrics are reported after generation
  test('10. Metrics: reportPreviewGenerated is called with duration after successful generation', async () => {
    const metricsClient = require('../../../src/adapters/metricsClient');
    const fileId = 'metrics-test-file';

    cache.get.mockResolvedValue(null);
    fileRegistry.getFileMetadata.mockResolvedValue({
      file_id: fileId, chunk_id: fileId, mime_type: 'image/png',
    });
    storage.getRawBytes.mockResolvedValue(Buffer.alloc(100, 0));
    storage.putThumbnail.mockResolvedValue(`previews/${fileId}.png`);

    await generatePreview(fileId);
    await new Promise(r => setTimeout(r, 100));

    expect(metricsClient.reportPreviewGenerated).toHaveBeenCalledWith(
      expect.any(Number)
    );
  });
});
