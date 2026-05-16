const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    events: {
      type: [String],
      required: true,
      index: true
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

webhookSchema.index({ active: 1, events: 1 });

module.exports = mongoose.model('Webhook', webhookSchema, 'webhooks');
