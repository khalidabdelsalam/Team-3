const mongoose = require('mongoose');
const config = require('./config');
const logger = require('./logger');

const connectDB = async (retries = 5) => {
  while (retries) {
    try {
      await mongoose.connect(config.mongoUri);
      logger.info('Connected to MongoDB.', { uri: config.mongoUri });
      break;
    } catch (error) {
      logger.error('MongoDB connection failed.', { error: error.message });
      retries -= 1;
      logger.warn('Retrying MongoDB connection.', { retriesLeft: retries });
      if (retries === 0) {
        logger.error('All MongoDB retries exhausted.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

module.exports = connectDB;
