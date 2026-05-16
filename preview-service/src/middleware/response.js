const { v4: uuidv4 } = require('uuid');

const SERVICE_NAME = process.env.SERVICE_NAME || 'preview-service';

/**
 * Standard JSON Response Format (per project spec)
 * Success: { success: true, data: {}, meta: { service, request_id } }
 * Error:   { success: false, error: { code, message, details }, meta: { service, request_id } }
 */

function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      service: SERVICE_NAME,
      request_id: uuidv4(),
    },
  });
}

function error(res, code, message, details = {}, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details },
    meta: {
      service: SERVICE_NAME,
      request_id: uuidv4(),
    },
  });
}

module.exports = { success, error };
