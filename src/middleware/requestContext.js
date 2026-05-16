const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();

function createRequestId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return crypto.randomBytes(16).toString('hex');
}

function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || createRequestId();

  storage.run({ requestId }, () => {
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });
}

function getRequestId() {
  return storage.getStore()?.requestId;
}

module.exports = {
  requestContext,
  getRequestId
};
