const express    = require('express');
const multer     = require('multer');
const { v4: uuidv4 } = require('uuid');
const swaggerUi  = require('swagger-ui-express');

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// ── Swagger UI ────────────────────────────────────────────────────────────
const swaggerSpec = {
  openapi: '3.0.0',
  info: { title: 'Mock File Registry', version: '1.0.0', description: 'Simulates File Registry service for local development.' },
  servers: [{ url: 'http://localhost:4000' }],
  paths: {
    '/files': {
      post: {
        summary: 'Upload a file',
        tags: ['Files'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
            },
          },
        },
        responses: { 200: { description: 'File uploaded, returns file_id' } },
      },
      get: {
        summary: 'List all files',
        tags: ['Files'],
        responses: { 200: { description: 'List of all stored files' } },
      },
    },
    '/files/{file_id}': {
      get: {
        summary: 'Get file metadata',
        tags: ['Files'],
        parameters: [{ in: 'path', name: 'file_id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'File metadata' }, 404: { description: 'Not found' } },
      },
      delete: {
        summary: 'Delete a file',
        tags: ['Files'],
        parameters: [{ in: 'path', name: 'file_id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/health': {
      get: { summary: 'Health check', tags: ['Health'], responses: { 200: { description: 'OK' } } },
    },
  },
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// In-memory stores
const files = {};       // file_id → metadata
const bytes = {};       // file_id → Buffer

// POST /files — upload a file
app.post('/files', upload.single('file'), (req, res) => {
  const file_id   = uuidv4();
  const metadata  = {
    file_id,
    name:      req.file?.originalname || 'unknown',
    mime_type: req.file?.mimetype     || 'application/octet-stream',
    size:      req.file?.size         || 0,
    chunk_id:  file_id,
  };
  files[file_id] = metadata;
  bytes[file_id] = req.file?.buffer || Buffer.alloc(0);
  console.log(`[FileRegistry] Stored: ${metadata.name} → ${file_id}`);
  res.json({ success: true, data: metadata });
});

// GET /files/:file_id — metadata
app.get('/files/:file_id', (req, res) => {
  const m = files[req.params.file_id];
  if (!m) return res.status(404).json({ success: false, error: 'Not found' });
  res.json(m);
});

// GET /files/:file_id/bytes — raw bytes (used by Storage GW)
app.get('/files/:file_id/bytes', (req, res) => {
  const buf = bytes[req.params.file_id];
  if (!buf) return res.status(404).json({ success: false, error: 'Not found' });
  res.set('Content-Type', 'application/octet-stream');
  res.send(buf);
});

// GET /files — list all
app.get('/files', (req, res) =>
  res.json({ success: true, data: { files: Object.values(files) } })
);

// DELETE /files/:file_id
app.delete('/files/:file_id', (req, res) => {
  delete files[req.params.file_id];
  delete bytes[req.params.file_id];
  res.json({ success: true, data: { deleted: req.params.file_id } });
});

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'mock-file-registry', count: Object.keys(files).length })
);

app.listen(4000, () => console.log('[Mock File Registry] Running on port 4000'));
