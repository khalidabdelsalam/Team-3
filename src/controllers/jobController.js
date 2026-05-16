
//الـ Service ده هو اللي بيخلق الـ Job في الـ DB.
const schedulerService = require('../services/schedulerService');
//ده بيستقبل الطلب ويعمل Validation بسيط.
//لو صح، يبعت للـ Service.
const createNewJob = async (req, res, next) => {
  try {
    const { jobName, jobType, payload } = req.body;

    if (!jobName || !jobType) {
      return res.status(400).json({ success: false, message: 'jobName and jobType are required' });
    }

    const job = await schedulerService.createJob({ jobName, jobType, payload });
    res.status(201).json({ success: true, message: 'Job created successfully', job });
  } catch (error) {
    next(error);
  }
};

//ده بياخد JobId ويشغله فورًا (Immediate Execution).
//ده مفيد جدًا في الـ Debugging أو لو عايز تشغل Job معين غصب عن الـ Cron.
const runJobDirectly = async (req, res, next) => {
  try {
    const { jobId } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'jobId is required' });
    }

    const job = await schedulerService.runJobDirectly(jobId);

    res.status(200).json({ success: true, message: 'Job execution started', jobId: job._id });
  } catch (error) {
    next(error);
  }
};

//ده بيجيب كل الـ Jobs المخزنة في الـ DB بغض النظر عن حالتها (Active/Inactive).
//مفيد عشان تشوف كل الـ Job Definitions اللي عندك.
const getAllJobs = async (req, res, next) => {
  try {
    const jobs = await schedulerService.getAllJobs();
    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    next(error);
  }
};

module.exports = { createNewJob, runJobDirectly, getAllJobs };
