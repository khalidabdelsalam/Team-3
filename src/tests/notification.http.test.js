import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateManualNotification = vi.fn();
const mockListRecentNotifications = vi.fn();

vi.mock('../modules/notifications/notification.service.js', () => ({
  createManualNotification: mockCreateManualNotification,
  listRecentNotifications: mockListRecentNotifications
}));

const { createApp } = await import('../api/app.js');

describe('notification service HTTP API', () => {
  const app = createApp();

  beforeEach(() => {
    mockCreateManualNotification.mockReset();
    mockListRecentNotifications.mockReset();
  });

  it('returns liveness status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });

  it('validates notification payloads', async () => {
    const response = await request(app).post('/notify/email').send({
      to_address: 'bad-email'
    });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a manual notification with the standard response envelope', async () => {
    mockCreateManualNotification.mockResolvedValue({
      id: 1,
      type: 'manual',
      to_address: 'ops@example.com',
      subject: 'Manual alert',
      message: 'Triggered manually',
      source_topic: 'manual',
      status: 'sent',
      metadata: { source: 'admin' },
      created_at: '2026-04-23T00:00:00.000Z',
      sent_at: '2026-04-23T00:00:00.000Z'
    });

    const response = await request(app).post('/notify/email').send({
      type: 'manual',
      to_address: 'ops@example.com',
      subject: 'Manual alert',
      message: 'Triggered manually',
      metadata: { source: 'admin' }
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.notification.status).toBe('sent');
    expect(response.body.meta.service).toBe('notification-service');
  });
});
