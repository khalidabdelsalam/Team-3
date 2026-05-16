const redis = require('redis');

let client = null;

async function getClient() {
  if (!client) {
    client = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    client.on('error', (err) => console.error('[Redis] Error:', err));
    await client.connect();
    console.log('[Redis] Connected');
  }
  return client;
}

async function get(fileId) {
  try {
    const r = await getClient();
    const val = await r.get(`preview:${fileId}`);
    if (val) console.log(`[Redis] Cache HIT for ${fileId}`);
    else console.log(`[Redis] Cache MISS for ${fileId}`);
    return val;
  } catch (e) {
    console.warn('[Redis] GET failed (non-critical):', e.message);
    return null;
  }
}

async function set(fileId, previewPath) {
  try {
    const r = await getClient();
    const ttl = parseInt(process.env.CACHE_TTL || '3600');
    await r.set(`preview:${fileId}`, previewPath, { EX: ttl });
    console.log(`[Redis] Cached preview for ${fileId}`);
  } catch (e) {
    console.warn('[Redis] SET failed (non-critical):', e.message);
  }
}

async function del(fileId) {
  try {
    const r = await getClient();
    await r.del(`preview:${fileId}`);
    console.log(`[Redis] Evicted cache for ${fileId}`);
  } catch (e) {
    console.warn('[Redis] DEL failed:', e.message);
  }
}

module.exports = { get, set, del };
