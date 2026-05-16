jest.mock('../../src/services/schedulerService', () => ({
  createJob: jest.fn().mockResolvedValue({ _id: 'job-1', jobName: 'job', jobType: 'CUSTOM' }),
  runJobDirectly: jest.fn().mockResolvedValue({ _id: 'job-1' }),
  getAllJobs: jest.fn().mockResolvedValue([])
}));

const request = require('supertest');
const app = require('../../src/app');
const schedulerService = require('../../src/services/schedulerService');

describe('scheduler service integration routes', () => {
  test('GET /health returns simple health payload', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok', service: 'scheduler-service' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  test('GET /ready returns readiness payload', async () => {
    const response = await request(app).get('/ready').expect(200);

    expect(response.body).toEqual({ status: 'ready', service: 'scheduler-service' });
  });

  test('GET /metrics exposes Prometheus metrics', async () => {
    const response = await request(app).get('/metrics').expect(200);

    expect(response.text).toContain('scheduler_service_http_requests_total');
  });

  test('POST /create-job validates required fields', async () => {
    const response = await request(app).post('/create-job').send({ jobType: 'CUSTOM' }).expect(400);

    expect(response.body.message).toBe('jobName and jobType are required');
  });

  test('POST /create-job creates a job on happy path', async () => {
    await request(app)
      .post('/create-job')
      .send({ jobName: 'job', jobType: 'CUSTOM', payload: { ok: true } })
      .expect(201);

    expect(schedulerService.createJob).toHaveBeenCalledWith({
      jobName: 'job',
      jobType: 'CUSTOM',
      payload: { ok: true }
    });
  });
});
