jest.mock('../../src/services/webhookRegistryService', () => ({
  listWebhooks: jest.fn().mockResolvedValue([]),
  createWebhook: jest.fn().mockResolvedValue({ id: 'webhook-1' }),
  listLogs: jest.fn().mockResolvedValue([])
}));

jest.mock('../../src/services/webhookService', () => ({
  processEvent: jest.fn().mockResolvedValue({ eventId: 'evt-1', matchedWebhooks: 0 })
}));

const request = require('supertest');
const app = require('../../src/app');
const webhookRegistryService = require('../../src/services/webhookRegistryService');

describe('webhook service integration routes', () => {
  test('GET /health returns simple health payload', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok', service: 'webhook-service' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  test('GET /ready returns readiness payload', async () => {
    const response = await request(app).get('/ready').expect(200);

    expect(response.body).toEqual({ status: 'ready', service: 'webhook-service' });
  });

  test('GET /metrics exposes Prometheus metrics', async () => {
    const response = await request(app).get('/metrics').expect(200);

    expect(response.text).toContain('webhook_service_http_requests_total');
  });

  test('POST /api/webhooks returns validation error for invalid URL', async () => {
    const response = await request(app)
      .post('/api/webhooks')
      .send({ name: 'bad', url: 'not-a-url', events: ['FILE_UPLOADED'] })
      .expect(400);

    expect(response.body.message).toBe('A valid webhook URL is required.');
  });

  test('POST /api/webhooks creates a webhook on happy path', async () => {
    await request(app)
      .post('/api/webhooks')
      .send({ name: 'ok', url: 'https://example.com/hook', events: ['FILE_UPLOADED'] })
      .expect(201);

    expect(webhookRegistryService.createWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ok', events: ['FILE_UPLOADED'] })
    );
  });
});
