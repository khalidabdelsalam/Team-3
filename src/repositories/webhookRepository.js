const Webhook = require('../models/webhookModel');
const WebhookLog = require('../models/webhookLogModel');
//بيجيب الـ Webhooks الـ Active بس من الـ DB.
async function listWebhooks() {
  return Webhook.find().sort({ createdAt: -1 }).lean();
}

async function createWebhook(data) {
  const webhook = new Webhook({
    name: data.name.trim(),
    description: data.description ? data.description.trim() : '',
    url: data.url.trim(),
    events: [...new Set(data.events.map((eventType) => eventType.trim().toUpperCase()))],
    headers: data.headers || {},
    active: data.active !== false
  });

  return webhook.save();
}

//دي بتدور على كل الـ Webhooks اللي شغالة (active) وبتستقبل الـ eventType ده.
async function findActiveWebhooksByEvent(eventType) {
  return Webhook.find({
    active: true,
    events: eventType
  }).lean();
}

async function createWebhookLog(data) {
  return WebhookLog.create(data);
}

async function findWebhookLogByWebhookAndEvent(webhookId, eventId) {
  return WebhookLog.findOne({
    webhook: webhookId,
    eventId
  });
}

async function saveWebhookLog(logEntry) {
  return logEntry.save();
}

async function listWebhookLogs(limit = 50) {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  return WebhookLog.find()
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .populate('webhook', 'name url')
    .lean();
}

module.exports = {
  listWebhooks,
  createWebhook,
  findActiveWebhooksByEvent,
  createWebhookLog,
  findWebhookLogByWebhookAndEvent,
  saveWebhookLog,
  listWebhookLogs
};
