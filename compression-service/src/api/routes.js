const express = require('express');
const { success, error } = require('../middleware/response');
const { runCompression, runDecompression } = require('../core/compressionService');
const configClient   = require('../adapters/configClient');
const producer       = require('../kafka/producer');
const CompressionJob = require('../db/models/CompressionJob');

const router = express.Router();

/**
 * POST /compress
 * Per project spec — Threshold pattern:
 *   Small files (< threshold): compress synchronously, return result
 *   Large files (>= threshold): queue job, publish compression.requested, return { status: queued }
 * Per sequence diagram steps 1-19
 */
router.post('/compress', async (req, res) => {
  const { file_id, algorithm } = req.body;

  if (!file_id) {
    return error(res, 'MISSING_FILE_ID', 'file_id is required', {}, 400);
  }

  try {
    // Step 2: GET /config → get threshold
    const thresholdMB = await configClient.getLargeFileThresholdMB();
    const algo        = algorithm || await configClient.getAlgorithm();

    // Check file size to decide sync vs async
    // We attempt a HEAD or use metadata size
    let fileSizeMB = 0;
    try {
      const axios    = require('axios');
      const BASE     = process.env.FILE_REGISTRY_URL || 'http://file-registry:4000';
      const metaRes  = await axios.get(`${BASE}/files/${file_id}`, { timeout: 5000 });
      fileSizeMB     = (metaRes.data?.size || 0) / (1024 * 1024);
    } catch {
      // If can't determine size, treat as small file
      fileSizeMB = 0;
    }

    if (fileSizeMB >= thresholdMB) {
      // Large file — async pattern (per project spec: compression.requested)
      await producer.publishCompressionRequested(file_id, algo);
      return success(res, {
        file_id,
        status: 'queued',
        message: `Large file (${fileSizeMB.toFixed(1)}MB) queued for async compression`,
      }, 202);
    }

    // Small file — sync compression
    const result = await runCompression(file_id, algo);
    return success(res, result);

  } catch (e) {
    console.error(`[API] POST /compress failed for ${file_id}:`, e.message);
    return error(res, 'COMPRESSION_FAILED', e.message, {}, 500);
  }
});

/**
 * POST /decompress
 * Decompress a previously compressed file
 */
router.post('/decompress', async (req, res) => {
  const { file_id } = req.body;

  if (!file_id) {
    return error(res, 'MISSING_FILE_ID', 'file_id is required', {}, 400);
  }

  try {
    const result = await runDecompression(file_id);
    return success(res, result);
  } catch (e) {
    console.error(`[API] POST /decompress failed for ${file_id}:`, e.message);
    return error(res, 'DECOMPRESSION_FAILED', e.message, {}, 500);
  }
});

/**
 * GET /jobs/:file_id — list all compression jobs for a file
 */
router.get('/jobs/:file_id', async (req, res) => {
  try {
    const jobs = await CompressionJob.findAll({
      where: { file_id: req.params.file_id },
      order: [['created_at', 'DESC']],
    });
    if (!jobs.length) return error(res, 'NOT_FOUND', 'No jobs found', {}, 404);
    return success(res, { jobs });
  } catch (e) {
    return error(res, 'SERVER_ERROR', e.message, {}, 500);
  }
});

/**
 * GET /jobs/status/:job_id — single job status
 */
router.get('/jobs/status/:job_id', async (req, res) => {
  try {
    const job = await CompressionJob.findByPk(req.params.job_id);
    if (!job) return error(res, 'NOT_FOUND', 'Job not found', {}, 404);
    return success(res, { job });
  } catch (e) {
    return error(res, 'SERVER_ERROR', e.message, {}, 500);
  }
});

module.exports = router;
