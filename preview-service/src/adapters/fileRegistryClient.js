const axios = require('axios');

const BASE = process.env.FILE_REGISTRY_URL || 'http://file-registry:4000';

/**
 * GET /files/{file_id} — fetch file metadata (mime_type, chunk_id, name)
 * Similar to AWS S3 HeadObject or Google Drive Files.get metadata call
 */
async function getFileMetadata(fileId) {
  try {
    const res = await axios.get(`${BASE}/files/${fileId}`, { timeout: 5000 });
    console.log(`[FileRegistry] Metadata for ${fileId}: mime=${res.data.mime_type}`);
    return res.data;
  } catch (e) {
    console.error(`[FileRegistry] GET /files/${fileId} failed:`, e.message);
    throw new Error(`File ${fileId} not found in registry`);
  }
}

module.exports = { getFileMetadata };
