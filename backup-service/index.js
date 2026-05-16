require('./src/tracing');
const app = require('./src/app');
const consumer = require('./src/consumers/BackupEventConsumer');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backup Service running on port ${PORT}`);
  
  // Start Kafka Consumer
  consumer.start().catch(err => {
    console.error('Failed to start Kafka consumer:', err);
  });
});
