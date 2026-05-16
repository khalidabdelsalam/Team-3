/**
 * Core preview generation workflow — shared by REST API and Kafka Consumer
 * Follows the sequence diagram exactly:
 * 1. Check Redis cache
 * 2. GET metadata from File Registry
 * 3. GET raw bytes from Storage GW
 * 4. Generate thumbnail (Preview Engine)
 * 5. PUT thumbnail to Storage GW
 * 6. INSERT/UPDATE Preview DB
 * 7. Set Redis cache
 * 8. Push stats to Metrics (async)
 * 9. Publish Kafka event (async)
 */

const cache         = require('../adapters/redisCache');
const fileRegistry  = require('../adapters/fileRegistryClient');
const storage       = require('../adapters/storageClient');
const metrics       = require('../adapters/metricsClient');
const previewEngine = require('./previewEngine');
const producer      = require('../kafka/producer');
const Preview       = require('../db/models/Preview');

async function generatePreview(fileId) {
  const start = Date.now();

  // Step 2: Check Redis cache
  const cached = await cache.get(fileId);
  if (cached) {
    await metrics.reportCacheHit();
    return { preview_path: cached, cached: true };
  }

  // Step 4: GET /files/{file_id} → File Registry
  const metadata = await fileRegistry.getFileMetadata(fileId);
  const chunkId  = metadata.chunk_id || fileId;
  const mimeType = metadata.mime_type || 'application/octet-stream';

  // Step 6: GET /objects/{chunk_id} → Storage GW
  const rawBytes = await storage.getRawBytes(chunkId);

  // Step 8: Generate thumbnail
  const pngBytes = await previewEngine.generate(rawBytes, mimeType);

  // Step 10: PUT /objects/previews/{id} → Storage GW
  const previewPath = await storage.putThumbnail(fileId, pngBytes);

  // Step 12: INSERT Path & Metadata → Preview DB
  await Preview.upsert({
    file_id:      fileId,
    preview_path: previewPath,
    status:       'completed',
    updated_at:   new Date(),
  });

  // Step 14: Set Cache (URL) → Redis
  await cache.set(fileId, previewPath);

  const durationMs = Date.now() - start;

  // Step 16: Push Stats — fire-and-forget
  metrics.reportPreviewGenerated(durationMs).catch(() => {});

  // Step 19: Publish Event (Async) — fire-and-forget
  producer.publishPreviewGenerated(fileId, previewPath).catch(() => {});

  return { preview_path: previewPath, cached: false };
}

module.exports = { generatePreview };
