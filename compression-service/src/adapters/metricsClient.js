const axios = require('axios');

const BASE    = process.env.METRICS_URL || 'http://metrics-service:3007';
const SERVICE = process.env.SERVICE_NAME || 'compression-service';

async function push(name, value, unit = '') {
  try {
    await axios.post(`${BASE}/metrics`, {
      service: SERVICE, name, value, unit,
      recorded_at: new Date().toISOString(),
    }, { timeout: 2000 });
  } catch {
    // fire-and-forget
  }
}

async function reportStats(originalSize, compressedSize, ratio, durationMs) {
  await push('compression.original_size_bytes',   originalSize,   'bytes');
  await push('compression.compressed_size_bytes', compressedSize, 'bytes');
  await push('compression.ratio',                 ratio,          'ratio');
  await push('compression.duration_ms',           durationMs,     'ms');
}

module.exports = { push, reportStats };
