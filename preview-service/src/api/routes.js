const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { success, error } = require('../middleware/response');
const { generatePreview }  = require('../core/previewService');
const cache    = require('../adapters/redisCache');
const Preview  = require('../db/models/Preview');

const router = express.Router();

/**
 * POST /preview/generate
 * Per sequence diagram:
 *   Step 1: Client calls this endpoint with file_id
 *   Steps 2-18: generate thumbnail, store, cache, push stats
 *   Step 19: publish event (async after response)
 * Per project spec: Hybrid REST + Kafka
 *   Returns immediately after preview is ready
 */
router.post('/generate', async (req, res) => {
  const { file_id } = req.body;

  if (!file_id) {
    return error(res, 'MISSING_FILE_ID', 'file_id is required', {}, 400);
  }

  try {
    const result = await generatePreview(file_id);

    return success(res, {
      file_id,
      preview_url: result.preview_path,
      cached: result.cached,
    });
  } catch (e) {
    console.error(`[API] POST /preview/generate failed for ${file_id}:`, e.message);
    return error(res, 'PREVIEW_FAILED', e.message, {}, 500);
  }
});

/**
 * GET /preview/:file_id
 * Returns existing preview URL from cache or DB
 */
router.get('/:file_id', async (req, res) => {
  const { file_id } = req.params;

  try {
    // Check cache first
    const cached = await cache.get(file_id);
    if (cached) {
      return success(res, { file_id, preview_url: cached, cached: true });
    }

    // Fall back to DB
    const preview = await Preview.findByPk(file_id);
    if (!preview) {
      return error(res, 'NOT_FOUND', `No preview found for file ${file_id}`, {}, 404);
    }

    if (preview.status !== 'completed') {
      return error(res, 'NOT_READY', `Preview status: ${preview.status}`, {}, 202);
    }

    // Re-populate cache
    await cache.set(file_id, preview.preview_path);

    return success(res, {
      file_id,
      preview_url: preview.preview_path,
      cached: false,
    });
  } catch (e) {
    return error(res, 'SERVER_ERROR', e.message, {}, 500);
  }
});

/**
 * DELETE /preview/:file_id
 * Hard-delete preview + evict cache (cascade on file.deleted)
 */
router.delete('/:file_id', async (req, res) => {
  const { file_id } = req.params;
  try {
    await Preview.destroy({ where: { file_id } });
    await cache.del(file_id);
    return success(res, { file_id, deleted: true });
  } catch (e) {
    return error(res, 'DELETE_FAILED', e.message, {}, 500);
  }
});

module.exports = router;
