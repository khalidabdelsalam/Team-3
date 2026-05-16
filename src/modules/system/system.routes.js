import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { errorResponse, successResponse } from '../../lib/http.js';
import { getRuntimeState } from '../../events/runtime-state.js';

export const systemRouter = Router();

systemRouter.get('/health', async (req, res) => {
  const response = successResponse(req, { status: 'ok' });
  return res.status(response.statusCode).json(response.body);
});

systemRouter.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const runtimeState = getRuntimeState();

    if (!runtimeState.kafkaConnected) {
      const response = errorResponse(req, 'SERVICE_NOT_READY', 'Kafka connection is not ready', {}, 503);
      return res.status(response.statusCode).json(response.body);
    }

    const response = successResponse(req, {
      status: 'ready',
      dependencies: {
        postgres: 'up',
        kafka: 'up'
      }
    });

    return res.status(response.statusCode).json(response.body);
  } catch (error) {
    req.log.error({ err: error }, 'Readiness check failed');
    const response = errorResponse(req, 'SERVICE_NOT_READY', 'One or more dependencies are unavailable', {}, 503);
    return res.status(response.statusCode).json(response.body);
  }
});
