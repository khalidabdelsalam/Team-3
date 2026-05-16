const { supportedEventTypes } = require('../config/eventTypes');
const config = require('../config/config');
const logger = require('../config/logger');
const Webhook = require('../models/Webhook');

async function seedSampleWebhook() {
  if (!config.seed.enabled || !config.seed.url) {
    logger.info('Sample webhook seeding skipped.');
    return null;
  }

  const existingWebhook = await Webhook.findOne({
    name: config.seed.name,
    url: config.seed.url
  });

  if (existingWebhook) {
    logger.info('Sample webhook already exists.', {
      name: existingWebhook.name,
      url: existingWebhook.url
    });
    return existingWebhook;
  }

  const createdWebhook = await Webhook.create({
    name: config.seed.name,
    description: 'Auto-seeded webhook target used by docker-compose smoke testing.',
    url: config.seed.url,
    events: supportedEventTypes,
    headers: {
      'x-webhook-target': 'sample-receiver'
    },
    active: true
  });

  logger.info('Sample webhook seeded successfully.', {
    name: createdWebhook.name,
    url: createdWebhook.url
  });

  return createdWebhook;
}

module.exports = {
  seedSampleWebhook
};
