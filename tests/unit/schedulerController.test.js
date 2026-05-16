jest.mock('../../src/services/schedulerService', () => ({
  createJob: jest.fn(),
  runJobDirectly: jest.fn(),
  getAllJobs: jest.fn()
}));

const schedulerService = require('../../src/services/schedulerService');
const {
  createNewJob,
  runJobDirectly,
  getAllJobs
} = require('../../src/controllers/jobController');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('scheduler controller unit behavior', () => {
  test('createNewJob rejects missing jobName', async () => {
    const res = createResponse();

    await createNewJob({ body: { jobType: 'CUSTOM' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createNewJob creates a job on happy path', async () => {
    const res = createResponse();
    schedulerService.createJob.mockResolvedValue({ _id: 'job-1' });

    await createNewJob({ body: { jobName: 'job', jobType: 'CUSTOM', payload: {} } }, res, jest.fn());

    expect(schedulerService.createJob).toHaveBeenCalledWith({ jobName: 'job', jobType: 'CUSTOM', payload: {} });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('runJobDirectly rejects missing jobId', async () => {
    const res = createResponse();

    await runJobDirectly({ body: {} }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('runJobDirectly starts an existing job', async () => {
    const res = createResponse();
    schedulerService.runJobDirectly.mockResolvedValue({ _id: 'job-2' });

    await runJobDirectly({ body: { jobId: 'job-2' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-2' }));
  });

  test('getAllJobs returns count and data', async () => {
    const res = createResponse();
    schedulerService.getAllJobs.mockResolvedValue([{ _id: 'job-1' }, { _id: 'job-2' }]);

    await getAllJobs({ body: {} }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }));
  });
});
