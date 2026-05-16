const schedulerProducer = require('../kafka/schedulerProducer');
const logger = require('../config/logger');

class JobExecutor {
  async execute(job) {
    logger.info('Starting job execution.', { jobName: job.jobName, jobType: job.jobType });
    
    try {
      // Execute the job logic based on jobType and send matching event
      const eventSent = await schedulerProducer.sendEvent(job.jobType, job.payload);
      
      if (!eventSent) {
        throw new Error('Kafka event delivery failed.');
      }

      // Specific conditional simulation if needed
      if (job.jobType === 'RETRY_WEBHOOK' && Math.random() < 0.2) {
        throw new Error('Simulated external webhook failure during retry.');
      }

      return 'success';

    } catch (error) {
      logger.error('Job execution failed.', { error: error.message });
      throw error; // Let the caller catch the error for job log tracking
    }
  }
}

module.exports = new JobExecutor();
