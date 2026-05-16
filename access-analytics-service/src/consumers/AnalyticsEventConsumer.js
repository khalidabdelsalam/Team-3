const { Kafka } = require('kafkajs');
const service = require('../services/AnalyticsService');

class AnalyticsEventConsumer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'access-analytics-service',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    });
    this.consumer = this.kafka.consumer({ groupId: 'analytics-group' });
  }

  async start() {
    await this.consumer.connect();
    await this.consumer.subscribe({ 
      topics: ['file.downloaded', 'file.shared', 'backup.completed'], 
      fromBeginning: true 
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const eventData = JSON.parse(message.value.toString());
        console.log(`Received event from topic ${topic}:`, eventData);
        
        try {
          await service.processEvent({ ...eventData, action: topic });
          // Manual commit offset is handled by kafkajs by default unless configured otherwise
          console.log(`Successfully processed and acknowledged event from ${topic}`);
        } catch (error) {
          console.error(`Failed to process event from ${topic}:`, error);
        }
      },
    });
  }
}

module.exports = new AnalyticsEventConsumer();
