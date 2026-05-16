const service = require('../services/AnalyticsService');
const crypto = require('crypto');

/**
 * @class AnalyticsRestController
 * @implements IAccessTrackingAPI
 * Port: Port_REST
 */
class AnalyticsRestController {
  async logAccess(req, res) {
    const requestId = crypto.randomUUID();
    try {
      const result = await service.processRequest(req.body);
      res.status(200).json({
        success: true,
        data: result,
        meta: { service: 'access-analytics-service', request_id: requestId }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
        meta: { service: 'access-analytics-service', request_id: requestId }
      });
    }
  }

  async getFileAnalytics(req, res) {
    const requestId = crypto.randomUUID();
    try {
      const result = await service.getStats(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
        meta: { service: 'access-analytics-service', request_id: requestId }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
        meta: { service: 'access-analytics-service', request_id: requestId }
      });
    }
  }

  health(req, res) {
    res.status(200).json({ success: true, status: 'UP' });
  }

  ready(req, res) {
    res.status(200).json({ success: true, status: 'READY' });
  }
}

module.exports = new AnalyticsRestController();
