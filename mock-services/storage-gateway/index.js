const express   = require('express');
const axios     = require('axios');
const path      = require('path');
const swaggerUi = require('swagger-ui-express');

const app     = express();
const OBJECTS = {};

const MIME_MAP = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
  '.gz':  'application/gzip', '.zst': 'application/zstd',
  '.json':'application/json', '.txt': 'text/plain', '.csv': 'text/csv',
};

function getMime(key) {
  const ext = path.extname(key).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

// ── Swagger UI ─────────────────────────────────────────────────────────────
const swaggerSpec = {
  openapi: '3.0.0',
  info: { title: 'Mock Storage Gateway', version: '1.0.0', description: 'Simulates S3-like object storage for local development.' },
  servers: [{ url: 'http://localhost:4001' }],
  paths: {
    '/objects/{object_key}': {
      get: {
        summary: 'Get an object by key',
        tags: ['Objects'],
        parameters: [{ in: 'path', name: 'object_key', required: true, schema: { type: 'string' },
          description: 'Examples: previews/file-id.png | compressed/file-id.gz | file-id' }],
        responses: { 200: { description: 'Object bytes returned' }, 404: { description: 'Not found' } },
      },
      put: {
        summary: 'Store an object by key',
        tags: ['Objects'],
        parameters: [{ in: 'path', name: 'object_key', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
        responses: { 200: { description: 'Object stored' } },
      },
      delete: {
        summary: 'Delete an object',
        tags: ['Objects'],
        parameters: [{ in: 'path', name: 'object_key', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/health': {
      get: { summary: 'Health check', tags: ['Health'], responses: { 200: { description: 'OK' } } },
    },
  },
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// GET /objects/* — fetch object
app.get('/objects/*', async (req, res) => {
  const key = req.params[0];

  if (OBJECTS[key]) {
    const mime = getMime(key);
    res.set('Content-Type', mime);
    return res.send(OBJECTS[key]);
  }

  // Fallback: try File Registry for original file bytes (using file_id as key)
  try {
    const FR  = process.env.FILE_REGISTRY_URL || 'http://file-registry:4000';
    const r   = await axios.get(`${FR}/files/${key}/bytes`, { responseType: 'arraybuffer', timeout: 5000 });
    const buf = Buffer.from(r.data);
    OBJECTS[key] = buf;  // cache it
    res.set('Content-Type', getMime(key));
    return res.send(buf);
  } catch {
    return res.status(404).json({ success: false, error: `Object '${key}' not found` });
  }
});

// PUT /objects/* — store object
app.put('/objects/*', express.raw({ type: '*/*', limit: '600mb' }), (req, res) => {
  const key = req.params[0];
  OBJECTS[key] = req.body;
  console.log(`[StorageGW] PUT ${key} → ${req.body.length} bytes`);
  res.json({ success: true, data: { path: key, size: req.body.length } });
});

// DELETE /objects/*
app.delete('/objects/*', (req, res) => {
  const key = req.params[0];
  delete OBJECTS[key];
  res.json({ success: true, data: { deleted: key } });
});

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'mock-storage-gateway', objects: Object.keys(OBJECTS).length })
);

app.listen(4001, () => console.log('[Mock Storage Gateway] Running on port 4001'));
