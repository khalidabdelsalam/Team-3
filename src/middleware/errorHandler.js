const logger = require('../config/logger');

function notFound(req, res) {
  res.status(404).json({
    message: 'Route not found.',
    path: req.originalUrl
  });
}

function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || (error.type === 'entity.parse.failed' ? 400 : 500);

  logger.error('Request failed.', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    error: error.message
  });

  res.status(statusCode).json({
    message: statusCode === 500 ? 'Internal server error.' : error.message
  });
}

module.exports = {
  notFound,
  errorHandler
};
