const repository = require('../repositories/BackupRepository');
const cloudClient = require('../clients/CloudStorageClient');
const publisher = require('../publishers/KafkaEventPublisher');
const axios = require('axios'); // For fetching metadata from other services

class BackupManager {
  async triggerBackup(type = 'manual') {
    console.log(`Starting ${type} backup process...`);
    
    // 1. Initial Logging
    const run = await repository.createInitialLog();
    
    try {
      // 2. Fetch Metadata (Simulated calls to Registry/Catalog/Config)
      // In a real scenario, this would call REST endpoints of other services
      console.log('Fetching metadata from external services...');
      const metadata = { registry: {}, catalog: {}, config: {} }; 
      
      // 3. Upload Snapshot
      const uploadResult = await cloudClient.uploadSnapshot(metadata);
      
      // 4. Update Status
      const finalRun = await repository.updateStatus(run.id, 'FINISHED');
      
      // 5. Notify Completion
      await publisher.notifyCompletion({ run_id: run.id, type, status: 'FINISHED' });
      
      return finalRun;
    } catch (error) {
      console.error('Backup failed:', error);
      await repository.updateStatus(run.id, 'FAILED');
      throw error;
    }
  }

  async getHistory() {
    return await repository.getHistory();
  }
}

module.exports = new BackupManager();
