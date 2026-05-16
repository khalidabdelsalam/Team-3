const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Preview Service API',
      version: '1.0.0',
      description: 'File Preview Service — generates thumbnail previews for uploaded files.',
    },
    servers: [{ url: 'http://localhost:3001', description: 'Local Dev' }],
    components: {
      schemas: {
        StandardSuccess: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            meta: {
              type: 'object',
              properties: {
                service: { type: 'string', example: 'preview-service' },
                request_id: { type: 'string', example: 'uuid-v4' },
              },
            },
          },
        },
        StandardError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          tags: ['Health'],
          responses: {
            200: { description: 'Service is running' },
          },
        },
      },
      '/preview/generate': {
        post: {
          summary: 'Generate a thumbnail preview for a file',
          tags: ['Preview'],
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
            200: {
              description: 'Preview generated successfully',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    data: {
                      file_id: '906547fd-7d2a-4d22-9526-2117f91aa700',
                      preview_url: 'previews/906547fd-7d2a-4d22-9526-2117f91aa700.png',
                      cached: false,
                    },
                    meta: { service: 'preview-service', request_id: 'uuid' },
                  },
                },
              },
            },
            400: { description: 'Missing file_id' },
            404: { description: 'File not found in registry' },
            500: { description: 'Preview generation failed' },
          },
        },
      },
      '/preview/{file_id}': {
        get: {
          summary: 'Get preview URL for a file (from cache or DB)',
          tags: ['Preview'],
          parameters: [
            { in: 'path', name: 'file_id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Preview URL returned' },
            202: { description: 'Preview not ready yet' },
            404: { description: 'No preview found' },
          },
        },
        delete: {
          summary: 'Hard-delete preview + evict cache',
          tags: ['Preview'],
          parameters: [
            { in: 'path', name: 'file_id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Preview deleted' },
          },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
