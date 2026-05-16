import { Router } from 'express';
import {
  getRecentNotifications,
  sendManualNotification
} from './notification.controller.js';

export const notificationRouter = Router();

notificationRouter.post('/notify/email', sendManualNotification);
notificationRouter.get('/notifications', getRecentNotifications);
