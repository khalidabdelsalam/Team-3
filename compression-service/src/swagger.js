const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Compression Service API',
      version: '1.0.0',
      description: 'Data Compression Service — compress and decompress files using gzip/zstd.',
    },
    servers: [{ url: 'http://localhost:3002', description: 'Local Dev' }],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          tags: ['Health'],
          responses: { 200: { description: 'Service is running' } },
        },
      },
      '/compress': {
        post: {
          summary: 'Compress a file',
          tags: ['Compression'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['file_id'],
                  properties: {
                    file_id:   { type: 'string', format: 'uuid', example: '906547fd-7d2a-4d22-9526-2117f91aa700' },
                    algorithm: { type: 'string', enum: ['gzip', 'zstd'], default: 'gzip' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'File compressed successfully',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    data: {
                      job_id: 'uuid',
                      file_id: '906547fd-7d2a-4d22-9526-2117f91aa700',
                      ratio: 0.65,
                      compressed_path: 'compressed/906547fd....gz',
                      status: 'completed',
                    },
                    meta: { service: 'compression-service', request_id: 'uuid' },
                  },
                },
              },
            },
            202: { description: 'Large file queued for async compression' },
            400: { description: 'Missing file_id' },
            500: { description: 'Compression failed' },
          },
        },
      },
      '/decompress': {
        post: {
          summary: 'Decompress a previously compressed file',
          tags: ['Compression'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['file_id'],
                  properties: {
                    file_id: { type: 'string', format: 'uuid', example: '906547fd-7d2a-4d22-9526-2117f91aa700' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'File decompressed successfully' },
            404: { description: 'No completed compression job found' },
            500: { description: 'Decompression failed' },
          },
        },
      },
      '/jobs/{file_id}': {
        get: {
          summary: 'List all compression jobs for a file',
          tags: ['Jobs'],
          parameters: [
            { in: 'path', name: 'file_id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Jobs list returned' },
            404: { description: 'No jobs found' },
          },
        },
      },
      '/jobs/status/{job_id}': {
        get: {
          summary: 'Get single job status',
          tags: ['Jobs'],
          parameters: [
            { in: 'path', name: 'job_id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Job status returned' },
            404: { description: 'Job not found' },
          },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
