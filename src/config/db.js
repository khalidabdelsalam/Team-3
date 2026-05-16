const mongoose = require('mongoose');

const config = require('./env');
const logger = require('./logger');
const sleep = require('../utils/sleep');

mongoose.set('strictQuery', true);

mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected event emitted.');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection emitted an error event.', {
    error: err.message
  });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected event emitted.');
});

const mongoStateMap = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

async function connectMongoWithRetry() {
  while (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(config.mongoUri);
      logger.info('Connected to MongoDB.', { uri: config.mongoUri });
      return mongoose.connection;
    } catch (error) {
      logger.error('MongoDB connection failed. Retrying.', {
        error: error.message,
        retryInMs: config.database.retryConnectionDelayMs
      });
      await sleep(config.database.retryConnectionDelayMs);
    }
  }

  return mongoose.connection;
}

async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB.');
  }
}

function getMongoStatus() {
  return mongoStateMap[mongoose.connection.readyState] || 'unknown';
}

module.exports = {
  connectMongoWithRetry,
  disconnectMongo,
  getMongoStatus
};
