const cron = require('node-cron');
const config = require('../config/config');
const schedulerService = require('../services/schedulerService');
const logger = require('../config/logger');

const initCronRunner = () => {
  logger.info('Initializing cron runner.', { cronInterval: config.cronInterval });

  cron.schedule(config.cronInterval, async () => {
    await schedulerService.checkDueJobs();
  });

  logger.info('Cron runner started.');
};

module.exports = { initCronRunner };
