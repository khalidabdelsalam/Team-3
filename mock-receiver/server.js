const http = require('http');

const PORT = Number(process.env.PORT || 8080);

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();

      if (body.length > 1024 * 1024) {
        reject(new Error('Payload too large.'));
        req.destroy();
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parseBody(rawBody) {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    return rawBody;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'mock-receiver',
        timestamp: new Date().toISOString()
      })
    );
    return;
  }

  try {
    const rawBody = await readRequestBody(req);
    const body = parseBody(rawBody);
    const receivedAt = new Date().toISOString();

    console.log(`[${receivedAt}] Mock receiver accepted ${req.method} ${req.url}`, body);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'received',
        service: 'mock-receiver',
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
        receivedAt
      })
    );
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'error',
        message: error.message
      })
    );
  }
});

server.listen(PORT, () => {
  console.log(`Mock receiver listening on port ${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
