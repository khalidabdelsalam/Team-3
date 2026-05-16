const axios = require('axios');

const BASE    = process.env.CONFIG_URL || 'http://config-service:3005';
const SERVICE = process.env.SERVICE_NAME || 'compression-service';

const _cache = {};

/**
 * Fetch config value from Config Service
 * Similar to Netflix Archaius / AWS AppConfig
 */
async function get(key, defaultVal = null) {
  if (_cache[key] !== undefined) return _cache[key];
  try {
    const res = await axios.get(`${BASE}/api/v1/configs`, {
      params: { service: SERVICE, key },
      timeout: 3000,
    });
    const val = res.data?.data?.value ?? defaultVal;
    _cache[key] = val;
    return val;
  } catch {
    return defaultVal;
  }
}

async function getAlgorithm() {
  return (await get('default_algorithm', process.env.DEFAULT_ALGORITHM || 'gzip'));
}

async function getMaxFileSizeMB() {
  return parseInt(await get('max_file_size_mb', process.env.MAX_FILE_SIZE_MB || '500'));
}

async function getLargeFileThresholdMB() {
  return parseInt(await get('large_file_threshold_mb', process.env.LARGE_FILE_THRESHOLD_MB || '10'));
}

module.exports = { get, getAlgorithm, getMaxFileSizeMB, getLargeFileThresholdMB };
