import crypto from 'node:crypto';
import pinoHttp from 'pino-http';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const requestContext = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && incoming.trim() ? incoming : crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    return requestId;
  }
});

export function successResponse(req, data, statusCode = 200) {
  return {
    statusCode,
    body: {
      success: true,
      data,
      meta: {
        service: env.SERVICE_NAME,
        request_id: req.id
      }
    }
  };
}

export function errorResponse(req, code, message, details = {}, statusCode = 400) {
  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        service: env.SERVICE_NAME,
        request_id: req.id ?? crypto.randomUUID()
      }
    }
  };
}
