const { Kafka } = require('kafkajs');
const manager = require('../services/BackupManager');

class BackupEventConsumer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'backup-service',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    });
    this.consumer = this.kafka.consumer({ groupId: 'backup-group' });
  }

  async start() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: 'scheduler.trigger.backup', fromBeginning: true });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        console.log('Received scheduled backup trigger from Kafka');
        try {
          await manager.triggerBackup('scheduled');
          console.log('Scheduled backup completed successfully');
        } catch (error) {
          console.error('Scheduled backup failed:', error);
        }
      },
    });
  }
}

module.exports = new BackupEventConsumer();
