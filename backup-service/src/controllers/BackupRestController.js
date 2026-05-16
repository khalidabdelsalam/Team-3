const manager = require('../services/BackupManager');
const crypto = require('crypto');

/**
 * @class BackupRestController
 * @implements IBackupManagementAPI
 * Port: Port_Kafka_In (REST)
 */
class BackupRestController {
  async runBackup(req, res) {
    const requestId = crypto.randomUUID();
    try {
      const result = await manager.triggerBackup('manual');
      res.status(200).json({
        success: true,
        data: result,
        meta: { service: 'backup-service', request_id: requestId }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
        meta: { service: 'backup-service', request_id: requestId }
      });
    }
  }

  async getHistory(req, res) {
    const requestId = crypto.randomUUID();
    try {
      const result = await manager.getHistory();
      res.status(200).json({
        success: true,
        data: result,
        meta: { service: 'backup-service', request_id: requestId }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
        meta: { service: 'backup-service', request_id: requestId }
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

module.exports = new BackupRestController();
