const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  jobName: {
    type: String,
    required: true,
  },
  jobType: {
    type: String,
    required: true,
    enum: ['RETRY_WEBHOOK', 'BACKUP_STARTED', 'PREVIEW_REQUESTED', 'COMPRESSION_REQUESTED', 'CUSTOM'],
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  lastRun: {
    type: Date,
  },
  nextRun: {
    type: Date,
    default: Date.now,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('Job', JobSchema);
