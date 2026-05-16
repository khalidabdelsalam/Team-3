const axios = require('axios');

const BASE = process.env.STORAGE_GW_URL || 'http://storage-gateway:4001';

/**
 * GET /objects/{chunk_id} → raw bytes
 * Similar to AWS S3 GetObject
 */
async function getRawBytes(chunkId) {
  const res = await axios.get(`${BASE}/objects/${chunkId}`, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  console.log(`[StorageGW] Fetched ${res.data.byteLength} bytes for ${chunkId}`);
  return Buffer.from(res.data);
}

/**
 * PUT /objects/compressed/{new_id} → store compressed bytes
 * Similar to AWS S3 PutObject
 */
async function putCompressed(fileId, algorithm, compressedBuffer) {
  const ext = algorithm === 'gzip' ? '.gz' : '.zst';
  const key = `compressed/${fileId}${ext}`;
  const res = await axios.put(`${BASE}/objects/${key}`, compressedBuffer, {
    headers: { 'Content-Type': 'application/octet-stream' },
    timeout: 60000,
  });
  const path = res.data?.path || key;
  console.log(`[StorageGW] Compressed object stored: ${path}`);
  return path;
}

/**
 * GET compressed object for decompression
 */
async function getCompressed(compressedPath) {
  const res = await axios.get(`${BASE}/objects/${compressedPath}`, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  return Buffer.from(res.data);
}

module.exports = { getRawBytes, putCompressed, getCompressed };
