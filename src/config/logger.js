const { getRequestId } = require('../middleware/requestContext');
const config = require('./config');

function log(level, message, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: config.serviceName,
    request_id: metadata.request_id || getRequestId() || 'system',
    level,
    message,
    ...metadata
  };

  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

module.exports = {
  info(message, metadata) {
    log('info', message, metadata);
  },
  warn(message, metadata) {
    log('warn', message, metadata);
  },
  error(message, metadata) {
    log('error', message, metadata);
  }
};
