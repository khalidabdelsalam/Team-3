require('./src/tracing');
const app = require('./src/app');
const consumer = require('./src/consumers/AnalyticsEventConsumer');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Access Analytics Service running on port ${PORT}`);
  
  // Start Kafka Consumer
  consumer.start().catch(err => {
    console.error('Failed to start Kafka consumer:', err);
  });
});
