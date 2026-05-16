const Job = require('../models/jobModel');
const JobLog = require('../models/jobLogModel');

class JobRepository {
  async createJob(jobData) {
    const job = new Job(jobData);
    return await job.save();
  }

  async getDueJobs() {
    const now = new Date();
    return await Job.find({
      nextRun: { $lte: now },
      status: { $in: ['PENDING', 'ACTIVE'] }
    });
  }

  async getJobById(jobId) {
    return await Job.findById(jobId);
  }

  async getAllJobs() {
    return await Job.find().sort({ createdAt: -1 });
  }

  async updateJob(job) {
    return await job.save();
  }

  async saveExecutionLog(logData) {
    const log = new JobLog(logData);
    return await log.save();
  }
}

module.exports = new JobRepository();
