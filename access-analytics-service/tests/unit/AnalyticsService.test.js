const service = require('../../src/services/AnalyticsService');
const repository = require('../../src/repositories/AccessLogRepository');

jest.mock('../../src/repositories/AccessLogRepository');

describe('AnalyticsService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('processRequest should save log data successfully (Happy Path)', async () => {
    const mockData = { file_id: '123', user_id: 'user1', action: 'view' };
    repository.save.mockResolvedValue({ id: 1, ...mockData });

    const result = await service.processRequest(mockData);

    expect(repository.save).toHaveBeenCalledWith(mockData);
    expect(result.id).toBe(1);
  });

  test('getStats should return stats for a file ID', async () => {
    const fileId = '123';
    repository.findByFileId.mockResolvedValue([{ file_id: fileId, action: 'view' }]);

    const result = await service.getStats(fileId);

    expect(repository.findByFileId).toHaveBeenCalledWith(fileId);
    expect(result).toHaveLength(1);
  });

  test('processEvent should map Kafka event correctly (Edge Case: Missing Fields)', async () => {
    const eventData = {}; // Empty event
    repository.save.mockResolvedValue({ id: 2 });

    await service.processEvent(eventData);

    expect(repository.save).toHaveBeenCalledWith({
      file_id: 'UNKNOWN',
      user_id: 'SYSTEM',
      action: 'EVENT_TRIGGERED'
    });
  });

  test('processEvent should use run_id if file_id is missing', async () => {
    const eventData = { run_id: 'run-99' };
    repository.save.mockResolvedValue({ id: 3 });

    await service.processEvent(eventData);

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      file_id: 'run-99'
    }));
  });

  test('processRequest should throw error if repository fails (Validation/Error Case)', async () => {
    repository.save.mockRejectedValue(new Error('DB Error'));

    await expect(service.processRequest({})).rejects.toThrow('DB Error');
  });
});
