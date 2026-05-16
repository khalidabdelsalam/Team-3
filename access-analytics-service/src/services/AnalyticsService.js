const repository = require('../repositories/AccessLogRepository');

/**
 * @class AnalyticsService
 * @implements IAnalyticsProcessor
 */
class AnalyticsService {
  async processRequest(logData) {
    console.log('Processing analytics log request:', logData);
    return await repository.save(logData);
  }

  async getStats(fileId) {
    console.log('Fetching stats for file:', fileId);
    return await repository.findByFileId(fileId);
  }

  async processEvent(eventData) {
    console.log('Processing event from Kafka:', eventData);
    // Extract metadata - flexible mapping
    const logEntry = {
      file_id: eventData.file_id || eventData.run_id || 'UNKNOWN',
      user_id: eventData.user_id || 'SYSTEM',
      action: eventData.action || 'EVENT_TRIGGERED'
    };
    return await repository.save(logEntry);
  }
}

module.exports = new AnalyticsService();
