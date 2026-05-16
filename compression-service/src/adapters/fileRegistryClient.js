const axios = require('axios');

const BASE = process.env.FILE_REGISTRY_URL || 'http://file-registry:4000';

/**
 * GET /files/{file_id} → metadata (chunk_id, mime_type, size)
 */
async function getFileMetadata(fileId) {
  try {
    const res = await axios.get(`${BASE}/files/${fileId}`, { timeout: 5000 });
    return res.data;
  } catch (e) {
    throw new Error(`File ${fileId} not found in registry: ${e.message}`);
  }
}

module.exports = { getFileMetadata };
