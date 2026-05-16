const axios = require('axios');

const BASE = process.env.METRICS_URL || 'http://metrics-service:3007';
const SERVICE = process.env.SERVICE_NAME || 'preview-service';

/**
 * Push stats to Metrics Service — fire-and-forget
 * Similar to Netflix Atlas time-series metrics push
 */
async function push(name, value, unit = '') {
  try {
    await axios.post(`${BASE}/metrics`, {
      service: SERVICE,
      name,
      value,
      unit,
      recorded_at: new Date().toISOString(),
    }, { timeout: 2000 });
  } catch (e) {
    // Fire-and-forget: never block main flow
    console.warn(`[Metrics] Push failed (non-critical): ${e.message}`);
  }
}

async function reportPreviewGenerated(durationMs) {
  await push('preview.generated.count', 1, 'count');
  await push('preview.generation_time_ms', durationMs, 'ms');
}

async function reportCacheHit() {
  await push('preview.cache_hit.count', 1, 'count');
}

async function reportError() {
  await push('preview.error.count', 1, 'count');
}

module.exports = { push, reportPreviewGenerated, reportCacheHit, reportError };
