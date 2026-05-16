const { DataTypes } = require('sequelize');
const sequelize = require('../connection');

// Per PM1 spec:
//   status CHECK IN ('pending','processing','completed','failed')
//   idx_file_id on file_id
//   Data Lifecycle: completed jobs retained; failed purged after 7 days
const CompressionJob = sequelize.define('CompressionJob', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  file_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  algorithm: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'gzip',
  },
  original_size: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  compressed_size: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  ratio: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: true,
  },
  compressed_path: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'processing', 'completed', 'failed']],
    },
  },
  error_log: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'compression_jobs',
  timestamps: false,
  indexes: [
    { fields: ['file_id'], name: 'idx_file_id' },
    { fields: ['status'],  name: 'idx_status'  },
  ],
});

module.exports = CompressionJob;
