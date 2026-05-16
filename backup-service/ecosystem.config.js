module.exports = {
  apps: [
    {
      name: 'backup-service',
      script: './index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        DB_HOST: 'backup-db',
        DB_PORT: 5432,
        DB_USER: 'user',
        DB_PASSWORD: 'password',
        DB_NAME: 'backup_db',
        KAFKA_BROKER: 'kafka:9092'
      },
      env_production: {
        NODE_ENV: 'production',
      }
    }
  ]
};
