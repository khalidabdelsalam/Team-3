module.exports = {
  apps: [
    {
      name: 'scheduler-service',
      script: 'src/server.js',
      instances: 1,      // Scheduler usually requires 1 instance to avoid duplicate cron executions, unless we have a distributed lock
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3002
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    }
  ]
};
