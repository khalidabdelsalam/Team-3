//ده بيخزن الـ Job في الـ DB أول مرة.
const jobRepository = require('../repositories/jobRepository');
//ده بينفذ الـ Logic بتاعت الـ Job.
const jobExecutor = require('../jobs/jobExecutor');
//ده بيجيب الـ Settings ( زي retryLimits ).

const config = require('../config/config');
const logger = require('../config/logger');

//ده الـ Business Logic كله.

class SchedulerService {
  async createJob(jobData) {
    // Ensures status is PENDING and default nextRun logic applied
    const newJob = await jobRepository.createJob({
      ...jobData,
      status: 'PENDING'
    });
    return newJob;
  }
  //بيجيب كل الـ Jobs.
  async getAllJobs() {
    return await jobRepository.getAllJobs();
  }
  //بيشغل الـ Job فورًا.
  async runJobDirectly(jobId) {
    const job = await jobRepository.getJobById(jobId);
    if (!job) throw new Error('Job not found');

    // Background execution without awaiting response
    this.processJob(job).catch((err) => logger.error('Direct job execution failed.', { error: err.message }));
    return job;
  }
  //بيشغل كل الـ Jobs اللي حان وقت تشغيلها.
  async checkDueJobs() {
    try {
      const dueJobs = await jobRepository.getDueJobs();
      for (const job of dueJobs) {
        await this.processJob(job);
      }
    } catch (error) {
      logger.error('Error while checking due jobs.', { error: error.message });
    }
  }
  //ده بينفذ الـ Job فعليًا.
  async processJob(job) {
    // Mark as active
    job.status = 'ACTIVE';
    job.lastRun = new Date();
    await jobRepository.updateJob(job);

    const startTime = new Date();
    let resultStatus = 'failure';
    let errorMessage = '';

    try {
      // Send to executor
      const executorResponse = await jobExecutor.execute(job);
      resultStatus = executorResponse === 'success' ? 'success' : 'failure';
    } catch (error) {
      errorMessage = error.message;
    }

    const endTime = new Date();

    // Log the execution regardless of success/fail
    await jobRepository.saveExecutionLog({
      jobId: job._id,
      startTime,
      endTime,
      result: resultStatus,
      errorMessage: errorMessage || null
    });

    // Update job status
    if (resultStatus === 'success') {
      job.status = 'COMPLETED';
      job.retryCount = 0;
    } else {
      job.retryCount += 1;

      if (job.retryCount >= config.retryLimits) {
        job.status = 'FAILED';
      } else {
        job.status = 'PENDING';
      }
    }

    await jobRepository.updateJob(job);
  }
}

module.exports = new SchedulerService();
