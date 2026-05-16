const manager = require('../../src/services/BackupManager');
const repository = require('../../src/repositories/BackupRepository');
const cloudClient = require('../../src/clients/CloudStorageClient');
const publisher = require('../../src/publishers/KafkaEventPublisher');

jest.mock('../../src/repositories/BackupRepository');
jest.mock('../../src/clients/CloudStorageClient');
jest.mock('../../src/publishers/KafkaEventPublisher');

describe('BackupManager Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('triggerBackup should complete successfully (Happy Path)', async () => {
    repository.createInitialLog.mockResolvedValue({ id: 'run-1' });
    cloudClient.uploadSnapshot.mockResolvedValue({ url: 'http://cloud/snap.zip' });
    repository.updateStatus.mockResolvedValue({ id: 'run-1', status: 'FINISHED' });

    const result = await manager.triggerBackup('scheduled');

    expect(repository.createInitialLog).toHaveBeenCalled();
    expect(cloudClient.uploadSnapshot).toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenCalledWith('run-1', 'FINISHED');
    expect(publisher.notifyCompletion).toHaveBeenCalled();
    expect(result.status).toBe('FINISHED');
  });

  test('triggerBackup should handle failure and update status to FAILED', async () => {
    repository.createInitialLog.mockResolvedValue({ id: 'run-2' });
    cloudClient.uploadSnapshot.mockRejectedValue(new Error('Cloud Failure'));

    await expect(manager.triggerBackup()).rejects.toThrow('Cloud Failure');

    expect(repository.updateStatus).toHaveBeenCalledWith('run-2', 'FAILED');
  });

  test('getHistory should return backup history from repository', async () => {
    repository.getHistory.mockResolvedValue([{ id: 'run-1', status: 'FINISHED' }]);

    const result = await manager.getHistory();

    expect(repository.getHistory).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  test('triggerBackup should default type to manual', async () => {
    repository.createInitialLog.mockResolvedValue({ id: 'run-3' });
    cloudClient.uploadSnapshot.mockResolvedValue({ url: 'ok' });
    repository.updateStatus.mockResolvedValue({ id: 'run-3' });

    await manager.triggerBackup();

    expect(publisher.notifyCompletion).toHaveBeenCalledWith(expect.objectContaining({
      type: 'manual'
    }));
  });

  test('triggerBackup should notify completion after success', async () => {
    repository.createInitialLog.mockResolvedValue({ id: 'run-4' });
    cloudClient.uploadSnapshot.mockResolvedValue({ url: 'ok' });
    repository.updateStatus.mockResolvedValue({ id: 'run-4' });

    await manager.triggerBackup();

    expect(publisher.notifyCompletion).toHaveBeenCalledWith(expect.objectContaining({
      run_id: 'run-4'
    }));
  });
});
