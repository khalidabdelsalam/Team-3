import { errorResponse, successResponse } from '../../lib/http.js';
import {
  createManualNotification,
  listRecentNotifications
} from './notification.service.js';
import { manualNotificationSchema } from './notification.schema.js';

export async function sendManualNotification(req, res) {
  const parsed = manualNotificationSchema.safeParse(req.body);

  if (!parsed.success) {
    const response = errorResponse(
      req,
      'VALIDATION_ERROR',
      'Notification payload validation failed',
      parsed.error.flatten(),
      422
    );
    return res.status(response.statusCode).json(response.body);
  }

  try {
    const notification = await createManualNotification(parsed.data);
    const response = successResponse(req, { notification }, 201);
    return res.status(response.statusCode).json(response.body);
  } catch (error) {
    req.log.error({ err: error }, 'Failed to send manual notification');
    const response = errorResponse(
      req,
      'NOTIFICATION_SEND_FAILED',
      'Failed to send notification',
      {},
      500
    );
    return res.status(response.statusCode).json(response.body);
  }
}

export async function getRecentNotifications(req, res) {
  try {
    const limit = Number(req.query.limit ?? 20);
    const notifications = await listRecentNotifications(limit);
    const response = successResponse(req, { notifications });
    return res.status(response.statusCode).json(response.body);
  } catch (error) {
    req.log.error({ err: error }, 'Failed to fetch notifications');
    const response = errorResponse(
      req,
      'NOTIFICATION_READ_FAILED',
      'Failed to fetch notifications',
      {},
      500
    );
    return res.status(response.statusCode).json(response.body);
  }
}
