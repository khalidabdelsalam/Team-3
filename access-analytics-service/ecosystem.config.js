module.exports = {
  apps: [
    {
      name: 'access-analytics-service',
      script: './index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3010,
        DB_HOST: 'access-analytics-db',
        DB_PORT: 5432,
        DB_USER: 'user',
        DB_PASSWORD: 'password',
        DB_NAME: 'access_analytics_db',
        KAFKA_BROKER: 'kafka:9092'
      },
      env_production: {
        NODE_ENV: 'production',
      }
    }
  ]
};
