const axios = require('axios');

const config = require('../config/config');

function send(webhook, eventPayload) {
  return axios.post(webhook.url, eventPayload, {
    timeout: config.webhook.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-event': eventPayload.type,
      'x-webhook-event-id': eventPayload.eventId,
      ...(webhook.headers || {})
    },
    validateStatus: () => true
  });
}

module.exports = {
  send
};
