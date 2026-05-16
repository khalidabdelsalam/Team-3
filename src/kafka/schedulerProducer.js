//ده اللي بيوصل الـ Scheduler بالـ Cluster بتاع Kafka.
const { Kafka } = require('kafkajs');
const config = require('../config/config');
const logger = require('../config/logger');
//الـ Class ده مسؤول إنه يبعت أي حدث (Event) بيحصل هنا.

class SchedulerProducer {
  constructor() {
    const kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
    });
    this.producer = kafka.producer();
    this.isConnected = false;
  }
  //بيربط الـ Producer بالـ Kafka Broker.

  async connect() {
    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('Kafka producer connected.', { brokers: config.kafka.brokers });
    } catch (error) {
      logger.error('Kafka producer connection failed.', { error: error.message });
    }
  }
  //بيبعت الـ Message.

  async sendEvent(eventKey, payload) {
    if (!this.isConnected) {
      logger.warn('Kafka producer not connected. Attempting to connect.');
      await this.connect();
    }

    try {
      await this.producer.send({
        topic: config.kafkaTopic,
        messages: [
          {
            key: eventKey,
            value: JSON.stringify({
              event: eventKey,
              payload,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      });
      logger.info('Kafka event produced.', { eventKey, topic: config.kafkaTopic });
      return true;
    } catch (error) {
      logger.error('Kafka event publish failed.', { eventKey, error: error.message });
      return false;
    }
  }
}

module.exports = new SchedulerProducer();
