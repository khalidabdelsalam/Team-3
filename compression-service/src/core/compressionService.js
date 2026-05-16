/**
 * Core compression workflow — shared by REST API and Kafka Consumer
 * Follows sequence diagram exactly:
 * 2.  GET /config (settings) → Config Client
 * 4.  INSERT Job (Status: Processing) → DB
 * 6.  GET /files/{file_id} → File Registry
 * 8.  GET /objects/{chunk_id} → Storage GW
 * 10. Compress Stream → Codec Engine
 * 12. PUT /objects/compressed/{new_id} → Storage GW
 * 14. UPDATE Job (Done, Ratio) → DB
 * 16. Push Stats (Ratio, Time) → Metrics Client
 * 18. Return result
 * 19. Publish Event (Async)
 */

const { v4: uuidv4 } = require('uuid');
const configClient   = require('../adapters/configClient');
const fileRegistry   = require('../adapters/fileRegistryClient');
const storage        = require('../adapters/storageClient');
const metrics        = require('../adapters/metricsClient');
const codec          = require('./codecEngine');
const producer       = require('../kafka/producer');
const CompressionJob = require('../db/models/CompressionJob');

async function runCompression(fileId, algorithmOverride = null) {
  // Step 2: GET /config → Config Client
  const algorithm  = algorithmOverride || await configClient.getAlgorithm();
  const maxSizeMB  = await configClient.getMaxFileSizeMB();

  // Step 4: INSERT Job (Status: Processing)
  const job = await CompressionJob.create({
    id:        uuidv4(),
    file_id:   fileId,
    algorithm,
    status:    'processing',
    created_at: new Date(),
    updated_at: new Date(),
  });

  try {
    // Step 6: GET /files/{file_id} → File Registry
    const metadata = await fileRegistry.getFileMetadata(fileId);
    const chunkId  = metadata.chunk_id || fileId;

    // Step 8: GET /objects/{chunk_id} → Storage GW
    const rawBytes = await storage.getRawBytes(chunkId);

    // Validate file size
    const sizeMB = rawBytes.length / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      throw new Error(`File size ${sizeMB.toFixed(1)}MB exceeds limit of ${maxSizeMB}MB`);
    }

    // Step 10: Compress Stream → Codec Engine
    const { compressed, ratio, originalSize, compressedSize, durationMs } =
      await codec.compress(rawBytes, algorithm);

    // Step 12: PUT /objects/compressed/{new_id} → Storage GW
    const compressedPath = await storage.putCompressed(fileId, algorithm, compressed);

    // Step 14: UPDATE Job (Done, Ratio)
    await job.update({
      status:           'completed',
      original_size:    originalSize,
      compressed_size:  compressedSize,
      ratio,
      compressed_path:  compressedPath,
      updated_at:       new Date(),
    });

    // Step 16: Push Stats → Metrics (fire-and-forget)
    metrics.reportStats(originalSize, compressedSize, ratio, durationMs).catch(() => {});

    // Step 19: Publish Event (Async, fire-and-forget)
    producer.publishCompressionCompleted(job.id, fileId, ratio, compressedPath, algorithm).catch(() => {});

    return { job_id: job.id, file_id: fileId, ratio, compressed_path: compressedPath, status: 'completed' };

  } catch (e) {
    await job.update({ status: 'failed', error_log: e.message, updated_at: new Date() });
    await producer.publishCompressionFailed(job.id, fileId, e.message).catch(() => {});
    throw e;
  }
}

async function runDecompression(fileId) {
  // Find latest completed job for this file
  const job = await CompressionJob.findOne({
    where: { file_id: fileId, status: 'completed' },
    order: [['created_at', 'DESC']],
  });

  if (!job) throw new Error(`No completed compression job for file ${fileId}`);

  const compressedBuffer = await storage.getCompressed(job.compressed_path);
  const algorithm        = job.algorithm || codec.detectAlgorithm(compressedBuffer);
  const rawBytes         = await codec.decompress(compressedBuffer, algorithm);

  // Store decompressed object back to storage
  const decompressedPath = await storage.putCompressed(
    `${fileId}_decompressed`, 'raw', rawBytes
  );

  return { file_id: fileId, decompressed_path: decompressedPath, status: 'completed' };
}

module.exports = { runCompression, runDecompression };
