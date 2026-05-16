const logger = require('../config/logger');

const errorHandler = (err, req, res, _next) => {
  logger.error('Request failed.', {
    method: req.method,
    path: req.originalUrl,
    error: err.message
  });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
