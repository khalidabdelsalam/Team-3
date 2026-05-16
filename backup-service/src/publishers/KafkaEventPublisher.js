const { Kafka } = require('kafkajs');

class KafkaEventPublisher {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'backup-service',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    });
    this.producer = this.kafka.producer();
  }

  async notifyCompletion(backupData) {
    await this.producer.connect();
    await this.producer.send({
      topic: 'backup.completed',
      messages: [
        { value: JSON.stringify({ ...backupData, timestamp: new Date() }) },
      ],
    });
    console.log('Published backup.completed event');
  }
}

module.exports = new KafkaEventPublisher();
