const axios = require('axios');

const BASE = process.env.STORAGE_GW_URL || 'http://storage-gateway:4001';

/**
 * GET /objects/{chunk_id} — fetch raw file bytes
 * Similar to AWS S3 GetObject
 */
async function getRawBytes(chunkId) {
  const res = await axios.get(`${BASE}/objects/${chunkId}`, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  console.log(`[StorageGW] Fetched ${res.data.byteLength} bytes for chunk ${chunkId}`);
  return Buffer.from(res.data);
}

/**
 * PUT /objects/previews/{file_id}.png — upload thumbnail PNG
 * Similar to AWS S3 PutObject
 */
async function putThumbnail(fileId, pngBuffer) {
  const key = `previews/${fileId}.png`;
  const res = await axios.put(`${BASE}/objects/${key}`, pngBuffer, {
    headers: { 'Content-Type': 'image/png' },
    timeout: 20000,
  });
  const path = res.data?.path || key;
  console.log(`[StorageGW] Thumbnail uploaded: ${path}`);
  return path;
}

module.exports = { getRawBytes, putThumbnail };
