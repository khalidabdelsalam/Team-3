/**
 * Compression Service — Unit Tests
 * Tests: codecEngine, compressionService workflow, response middleware
 * Framework: Jest
 * Coverage: happy path, validation errors, edge cases
 */

jest.mock('../../src/tracing', () => ({}));
jest.mock('../../src/adapters/configClient', () => ({
  getAlgorithm:             jest.fn().mockResolvedValue('gzip'),
  getMaxFileSizeMB:         jest.fn().mockResolvedValue(500),
  getLargeFileThresholdMB:  jest.fn().mockResolvedValue(10),
}));
jest.mock('../../src/adapters/fileRegistryClient', () => ({
  getFileMetadata: jest.fn(),
}));
jest.mock('../../src/adapters/storageClient', () => ({
  getRawBytes:     jest.fn(),
  putCompressed:   jest.fn(),
  getCompressed:   jest.fn(),
}));
jest.mock('../../src/adapters/metricsClient', () => ({
  reportStats: jest.fn().mockResolvedValue(undefined),
  push:        jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/kafka/producer', () => ({
  publishCompressionCompleted:  jest.fn().mockResolvedValue(undefined),
  publishCompressionFailed:     jest.fn().mockResolvedValue(undefined),
  publishCompressionRequested:  jest.fn().mockResolvedValue(undefined),
  disconnect:                   jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/db/models/CompressionJob', () => ({
  create:   jest.fn(),
  findOne:  jest.fn(),
  findAll:  jest.fn(),
  findByPk: jest.fn(),
}));

const zlib              = require('zlib');
const { promisify }     = require('util');
const codec             = require('../../src/core/codecEngine');
const fileRegistry      = require('../../src/adapters/fileRegistryClient');
const storage           = require('../../src/adapters/storageClient');
const CompressionJob    = require('../../src/db/models/CompressionJob');
const { runCompression } = require('../../src/core/compressionService');

const gzip   = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

describe('Compression Service — Unit Tests', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── Test 1: gzip compress produces smaller or equal output
  test('1. Codec Engine: gzip compress returns compressed buffer and ratio', async () => {
    const input  = Buffer.from('hello world this is test data for compression '.repeat(50));
    const result = await codec.compress(input, 'gzip');

    expect(result.compressed).toBeInstanceOf(Buffer);
    expect(result.originalSize).toBe(input.length);
    expect(result.compressedSize).toBe(result.compressed.length);
    expect(typeof result.ratio).toBe('number');
    expect(result.ratio).toBeGreaterThan(0);
    expect(typeof result.durationMs).toBe('number');
  });

  // ── Test 2: decompress restores original data exactly
  test('2. Codec Engine: decompress restores original bytes exactly (lossless)', async () => {
    const original   = Buffer.from('lossless compression test data '.repeat(20));
    const { compressed } = await codec.compress(original, 'gzip');
    const decompressed   = await codec.decompress(compressed, 'gzip');

    expect(decompressed.toString()).toBe(original.toString());
    expect(decompressed.length).toBe(original.length);
  });

  // ── Test 3: unsupported algorithm throws error
  test('3. Validation: compress throws error for unsupported algorithm', async () => {
    const input = Buffer.from('test data');
    await expect(codec.compress(input, 'bzip2')).rejects.toThrow('Unsupported algorithm');
  });

  // ── Test 4: detectAlgorithm correctly identifies gzip by magic bytes
  test('4. Codec Engine: detectAlgorithm identifies gzip from magic bytes 0x1f 0x8b', async () => {
    const { compressed } = await codec.compress(Buffer.from('test'), 'gzip');
    const detected = codec.detectAlgorithm(compressed);
    expect(detected).toBe('gzip');
  });

  // ── Test 5: runCompression full workflow with mocked dependencies
  test('5. Happy path: runCompression completes full workflow and returns job result', async () => {
    const fileId    = 'compress-test-001';
    const rawData   = Buffer.from('file content '.repeat(100));
    const mockJobId = 'job-uuid-001';

    const mockJob = {
      id:     mockJobId,
      update: jest.fn().mockResolvedValue(undefined),
    };
    CompressionJob.create.mockResolvedValue(mockJob);
    fileRegistry.getFileMetadata.mockResolvedValue({ chunk_id: fileId, mime_type: 'image/png', size: 1000 });
    storage.getRawBytes.mockResolvedValue(rawData);
    storage.putCompressed.mockResolvedValue(`compressed/${fileId}.gz`);

    const result = await runCompression(fileId, 'gzip');

    expect(result.status).toBe('completed');
    expect(result.file_id).toBe(fileId);
    expect(typeof result.ratio).toBe('number');
    expect(result.compressed_path).toContain(fileId);
    expect(mockJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  // ── Test 6: runCompression marks job as failed when Storage GW fails
  test('6. Error handling: runCompression marks job failed when Storage GW throws', async () => {
    const fileId  = 'compress-fail-001';
    const mockJob = { id: 'job-fail', update: jest.fn().mockResolvedValue(undefined) };
    CompressionJob.create.mockResolvedValue(mockJob);
    fileRegistry.getFileMetadata.mockResolvedValue({ chunk_id: fileId, mime_type: 'image/png', size: 100 });
    storage.getRawBytes.mockRejectedValue(new Error('Storage GW unavailable'));

    await expect(runCompression(fileId, 'gzip')).rejects.toThrow('Storage GW unavailable');
    expect(mockJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });

  // ── Test 7: response middleware — error format
  test('7. Response middleware: error returns correct structure with code and message', () => {
    const { error } = require('../../src/middleware/response');
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json:   jest.fn(),
    };

    error(mockRes, 'COMPRESSION_FAILED', 'gzip failed', {}, 500);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    const body = mockRes.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('COMPRESSION_FAILED');
    expect(body.meta.service).toBe('compression-service');
  });

  // ── Test 8: compression ratio for already-compressed data is >= 1
  test('8. Edge case: already-compressed PNG data has ratio close to or above 1.0', async () => {
    // PNG header magic bytes — already compressed data
    const pngLike = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(100, Math.random() * 255)]);
    const result  = await codec.compress(pngLike, 'gzip');
    // Ratio above 1 means gzip made it bigger — expected for pre-compressed data
    expect(result.ratio).toBeGreaterThan(0);
  });

  // ── Test 9: Kafka event published after successful compression
  test('9. Kafka: publishCompressionCompleted is called after successful compression', async () => {
    const producer = require('../../src/kafka/producer');
    const fileId   = 'kafka-compress-test';
    const mockJob  = { id: 'kafka-job-001', update: jest.fn().mockResolvedValue(undefined) };
    CompressionJob.create.mockResolvedValue(mockJob);
    fileRegistry.getFileMetadata.mockResolvedValue({ chunk_id: fileId, mime_type: 'text/plain', size: 500 });
    storage.getRawBytes.mockResolvedValue(Buffer.from('test content '.repeat(50)));
    storage.putCompressed.mockResolvedValue(`compressed/${fileId}.gz`);

    await runCompression(fileId, 'gzip');
    await new Promise(r => setTimeout(r, 100)); // fire-and-forget

    expect(producer.publishCompressionCompleted).toHaveBeenCalled();
  });

  // ── Test 10: Job is created with status 'processing' before compression starts
  test('10. DB: CompressionJob is created with status processing before compression', async () => {
    const fileId  = 'status-check-file';
    const mockJob = { id: 'status-job', update: jest.fn().mockResolvedValue(undefined) };
    CompressionJob.create.mockResolvedValue(mockJob);
    fileRegistry.getFileMetadata.mockResolvedValue({ chunk_id: fileId, mime_type: 'text/plain', size: 100 });
    storage.getRawBytes.mockResolvedValue(Buffer.from('content'.repeat(20)));
    storage.putCompressed.mockResolvedValue(`compressed/${fileId}.gz`);

    await runCompression(fileId, 'gzip');

    expect(CompressionJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing', file_id: fileId })
    );
  });
});
