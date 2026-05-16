/**
 * Structured JSON Logger
 * Every log entry includes: timestamp, service, request_id, level, message
 * Compatible with Loki/ELK log aggregation
 */
const SERVICE = process.env.SERVICE_NAME || 'preview-service';

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service:   SERVICE,
    level,
    message,
    ...meta,
  };
  // Write to stdout — Docker/K8s captures this for log aggregation
  console.log(JSON.stringify(entry));
}

const logger = {
  info:  (msg, meta) => log('INFO',  msg, meta),
  warn:  (msg, meta) => log('WARN',  msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta),
  debug: (msg, meta) => log('DEBUG', msg, meta),
};

/**
 * HTTP request logging middleware
 * Attaches request_id to every request for distributed tracing
 */
function requestLogger(req, res, next) {
  const { v4: uuidv4 } = require('uuid');
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.requestId);

  const start = Date.now();
  res.on('finish', () => {
    logger.info('HTTP Request', {
      request_id: req.requestId,
      method:     req.method,
      path:       req.path,
      status:     res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
}

module.exports = { logger, requestLogger };
