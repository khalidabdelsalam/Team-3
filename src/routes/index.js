const express = require('express');

const healthRoutes = require('./healthRoutes');
const webhookRoutes = require('./webhookRoutes');
const apiKeyAuth = require('../middleware/apiKeyAuth');

const router = express.Router();
///health مش محتاج API Key
//لكن باقي webhook routes محتاجة apiKeyAuth
router.use(healthRoutes);
router.use(apiKeyAuth);
router.use(webhookRoutes);

module.exports = router;
