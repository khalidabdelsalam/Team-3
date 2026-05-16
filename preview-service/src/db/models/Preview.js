const { DataTypes } = require('sequelize');
const sequelize = require('../connection');

// Per PM1 spec: file_id is PK (1:1 with File Registry)
// Data Lifecycle: cascade hard-delete on file.deleted event
const Preview = sequelize.define('Preview', {
  file_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
  },
  preview_path: {
    type: DataTypes.STRING(512),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
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
  tableName: 'previews',
  timestamps: false,
});

module.exports = Preview;
