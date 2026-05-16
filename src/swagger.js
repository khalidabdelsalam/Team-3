module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Scheduler Service API',
    version: '1.0.0'
  },
  paths: {
    '/health': {
      get: {
        summary: 'Liveness health check',
        responses: { 200: { description: 'Service is alive' } }
      }
    },
    '/ready': {
      get: {
        summary: 'Readiness check',
        responses: { 200: { description: 'Service is ready' } }
      }
    },
    '/metrics': {
      get: {
        summary: 'Prometheus metrics',
        responses: { 200: { description: 'Prometheus metrics text output' } }
      }
    },
    '/create-job': {
      post: {
        summary: 'Create a scheduled job',
        responses: {
          201: { description: 'Job created' },
          400: { description: 'Validation error' }
        }
      }
    },
    '/run-job': {
      post: {
        summary: 'Run a job immediately',
        responses: {
          200: { description: 'Job execution started' },
          400: { description: 'Validation error' }
        }
      }
    },
    '/jobs': {
      get: {
        summary: 'List all jobs',
        responses: { 200: { description: 'Job list' } }
      }
    }
  }
};
