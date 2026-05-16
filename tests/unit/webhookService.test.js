const webhookService = require('../../src/services/webhookService');
const apiKeyAuth = require('../../src/middleware/apiKeyAuth');

describe('webhook service unit behavior', () => {
  test('normalizes event type and fills defaults', () => {
    const event = webhookService.normalizeEvent({ type: 'file_uploaded', payload: { id: 1 } }, 'unit');

    expect(event.type).toBe('FILE_UPLOADED');
    expect(event.source).toBe('unit');
    expect(event.eventId).toBeTruthy();
  });

  test('rejects non-object event payloads', () => {
    expect(() => webhookService.normalizeEvent(null)).toThrow('Event payload must be an object.');
  });

  test('rejects events without a type', () => {
    expect(() => webhookService.normalizeEvent({ payload: {} })).toThrow('Event type is required.');
  });

  test('builds dispatch payload with event metadata', () => {
    const payload = webhookService.buildDispatchPayload({
      eventId: 'evt-1',
      type: 'FILE_UPLOADED',
      payload: { fileId: 'f1' },
      metadata: { tenantId: 't1' },
      source: 'unit',
      occurredAt: '2026-01-01T00:00:00.000Z'
    });

    expect(payload.eventId).toBe('evt-1');
    expect(payload.type).toBe('FILE_UPLOADED');
    expect(payload.metadata.tenantId).toBe('t1');
  });

  test('apiKeyAuth allows requests when API key is not configured', () => {
    const req = { get: jest.fn() };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
