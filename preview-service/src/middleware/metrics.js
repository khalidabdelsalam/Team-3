/**
 * Prometheus Metrics Middleware
 * Exposes GET /metrics in Prometheus format
 * Tracks: request count, latency (p50/p95/p99), error rate
 * Compatible with Prometheus scraping via annotations in K8s
 */
const client = require('prom-client');

const SERVICE = process.env.SERVICE_NAME || 'preview-service';

// Create a Registry
const register = new client.Registry();
register.setDefaultLabels({ service: SERVICE });
client.collectDefaultMetrics({ register });

// Request counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Request duration histogram (p50, p95, p99)
const httpRequestDurationMs = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [register],
});

// Error rate counter
const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors (4xx + 5xx)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Preview-specific metrics
const previewsGenerated = new client.Counter({
  name: 'previews_generated_total',
  help: 'Total number of previews generated',
  registers: [register],
});

const cacheHits = new client.Counter({
  name: 'preview_cache_hits_total',
  help: 'Total number of Redis cache hits',
  registers: [register],
});

// Middleware to record metrics per request
function metricsMiddleware(req, res, next) {
  const start  = Date.now();
  const route  = req.route?.path || req.path || 'unknown';

  res.on('finish', () => {
    const duration   = Date.now() - start;
    const statusCode = res.statusCode.toString();
    const labels     = { method: req.method, route, status_code: statusCode };

    httpRequestsTotal.inc(labels);
    httpRequestDurationMs.observe(labels, duration);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }
  });
  next();
}

// GET /metrics endpoint handler
async function metricsEndpoint(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  previewsGenerated,
  cacheHits,
  register,
};
