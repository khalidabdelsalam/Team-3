const config = require('../config/config');

function extractBearerToken(value) {
  if (!value) {
    return '';
  }

  const [scheme, token] = String(value).split(' ');

  return scheme && scheme.toLowerCase() === 'bearer' ? token || '' : '';
}

function apiKeyAuth(req, res, next) {
  if (!config.apiKey) {
    return next();
  }

  const providedApiKey = req.get('x-api-key') || extractBearerToken(req.get('authorization'));

  if (providedApiKey !== config.apiKey) {
    return res.status(401).json({
      message: 'A valid API key is required.'
    });
  }

  return next();
}

module.exports = apiKeyAuth;
