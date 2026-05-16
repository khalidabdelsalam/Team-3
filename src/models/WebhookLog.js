const mongoose = require('mongoose');

const webhookAttemptSchema = new mongoose.Schema(
  {
    attemptNumber: {
      type: Number,
      required: true
    },
    httpStatus: Number,
    responseBody: String,
    errorMessage: String,
    attemptedAt: {
      type: Date,
      default: Date.now
    },
    durationMs: Number,
    succeeded: {
      type: Boolean,
      default: false
    }
  },
  {
    _id: false
  }
);

const webhookLogSchema = new mongoose.Schema(
  {
    webhook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Webhook',
      required: true
    },
    eventId: {
      type: String,
      required: true
    },
    eventType: {
      type: String,
      required: true,
      index: true
    },
    endpoint: {
      type: String,
      required: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    source: {
      type: String,
      default: 'unknown'
    },
    status: {
      type: String,
      enum: ['PENDING', 'RETRYING', 'SUCCESS', 'SUCCESS_AFTER_RETRY', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    retryCount: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 0
    },
    httpStatus: Number,
    lastError: String,
    lastResponseBody: String,
    nextRetryAt: Date,
    deliveredAt: Date,
    lastAttemptAt: Date,
    attempts: {
      type: [webhookAttemptSchema],
      default: []
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

webhookLogSchema.index({ webhook: 1, createdAt: -1 });
webhookLogSchema.index({ webhook: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('WebhookLog', webhookLogSchema, 'webhook_logs');
