const { Kafka, logLevel } = require('kafkajs');

const config = require('./config');

module.exports = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  logLevel: logLevel.INFO,
  retry: {
    initialRetryTime: 300,
    retries: 8
  }
});
