const config = require('../config/config');
const sleep = require('../utils/sleep');

function getDelayForAttempt(attemptNumber) {
  return config.webhook.retryDelayMs * attemptNumber;
}

async function waitForRetry(attemptNumber) {
  await sleep(getDelayForAttempt(attemptNumber));
}

module.exports = {
  getDelayForAttempt,
  waitForRetry
};
