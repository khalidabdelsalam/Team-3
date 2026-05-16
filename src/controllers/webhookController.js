//ده بيستقبل REST Requests من المستخدم.

const { supportedEventTypes } = require('../config/eventTypes');
const webhookService = require('../services/webhookService');
const webhookRegistryService = require('../services/webhookRegistryService');


//عشان لما تعمل Webhook لازم الـ URL يكون فعلاً URL صالح.
//بيعمل validate يعني بيتاكد إن الكلام ده صح
function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch (error) {
    return false;
  }
}

//ده بيوحد الـ Events: عشان ممكن يجيلك كذا حاجة:
//"file_uploaded" أو "FILE_UPLOADED" أو "FileUploaded".
//فالدالة دي بتحولهم كلهم لشكل واحد موحد (UpperCase). 
function normalizeEvents(events) {
  if (!Array.isArray(events)) {
    return [];
  }

  return [...new Set(events.map((eventType) => String(eventType).trim().toUpperCase()).filter(Boolean))];
}

async function listWebhooks(req, res) {
  const webhooks = await webhookRegistryService.listWebhooks();

  res.status(200).json({
    data: webhooks
  });
}
//بتعمل Validation:
//يعني Controller مش بيكلم DB مباشرة.

async function createWebhook(req, res) {
  const { name, url, events, headers, active, description } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({
      message: 'Webhook name is required.'
    });
  }

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({
      message: 'A valid webhook URL is required.'
    });
  }

  const normalizedEvents = normalizeEvents(events);

  if (normalizedEvents.length === 0) {
    return res.status(400).json({
      message: 'At least one event type is required.'
    });
  }

  const unsupportedEvents = normalizedEvents.filter(
    (eventType) => !supportedEventTypes.includes(eventType)
  );

  if (unsupportedEvents.length > 0) {
    return res.status(400).json({
      message: 'Unsupported event types were provided.',
      unsupportedEvents,
      supportedEventTypes
    });
  }

  const webhook = await webhookRegistryService.createWebhook({
    name,
    url,
    events: normalizedEvents,
    headers: headers && typeof headers === 'object' && !Array.isArray(headers) ? headers : {},
    active,
    description
  });

  res.status(201).json({
    message: 'Webhook registered successfully.',
    data: webhook
  });
}



//ويرجع كل Webhooks المسجلة.


async function listWebhookLogs(req, res) {
  const logs = await webhookRegistryService.listLogs(req.query.limit);

  res.status(200).json({
    data: logs
  });
}
//دي بتعمل Manual Event Test.
async function testWebhook(req, res) {
  const eventType = String(
    (req.body && (req.body.type || req.body.eventType || req.body.event)) || ''
  )
    .trim()
    .toUpperCase();

  if (!eventType) {
    return res.status(400).json({
      message: 'Event type is required for test-webhook.'
    });
  }

  const result = await webhookService.processEvent(
    {
      ...req.body,
      type: eventType
    },
    {
      source: 'manual-test'
    }
  );

  res.status(200).json({
    message: 'Test event processed.',
    data: result
  });
}

module.exports = {
  listWebhooks,
  createWebhook,
  listWebhookLogs,
  testWebhook
};
