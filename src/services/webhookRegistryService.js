const webhookRepository = require('../repositories/webhookRepository');
//ده بيستخدم الـ Repository عشان يجيب الـ Webhooks.
async function listWebhooks() {
  return webhookRepository.listWebhooks();
}
//يسجل Webhook جديد.

async function createWebhook(data) {
  return webhookRepository.createWebhook(data);
}
//بيبحث عن الـ Webhooks النشطة حسب الـ eventType.

async function findActiveWebhooksByEvent(eventType) {
  return webhookRepository.findActiveWebhooksByEvent(eventType);
}
//بيجيب سجلات الـ Webhooks.

async function listLogs(limit = 50) {
  return webhookRepository.listWebhookLogs(limit);
}

module.exports = {
  listWebhooks,
  createWebhook,
  findActiveWebhooksByEvent,
  listLogs
};
