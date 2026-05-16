const express = require('express');
const app     = express();
app.use(express.json());

const metrics = [];

// ── Config Service endpoints (/api/v1/configs) ─────────────────────────────
app.get('/api/v1/configs', (req, res) => {
  const { key } = req.query;
  const defaults = {
    default_algorithm:      'gzip',
    max_file_size_mb:       '500',
    large_file_threshold_mb:'10',
    thumbnail_width:        '256',
    thumbnail_height:       '256',
  };
  const value = defaults[key] || 'true';
  console.log(`[Config] GET key=${key} → ${value}`);
  res.json({ success: true, data: { key, value } });
});

// ── Feature Flags (/api/v1/flags/:name) ───────────────────────────────────
app.get('/api/v1/flags/:flag', (req, res) => {
  console.log(`[FeatureFlags] GET ${req.params.flag} → enabled`);
  res.json({ success: true, data: { flag: req.params.flag, enabled: true } });
});

// ── Metrics (/metrics) ────────────────────────────────────────────────────
app.post('/metrics', (req, res) => {
  metrics.push({ ...req.body, received_at: new Date().toISOString() });
  console.log(`[Metrics] ${req.body.service} → ${req.body.name}=${req.body.value}`);
  res.json({ success: true, data: { id: metrics.length } });
});

app.get('/metrics', (req, res) =>
  res.json({ success: true, data: { count: metrics.length, metrics: metrics.slice(-50) } })
);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'mock-support-services' })
);

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`[Mock Support] Running on port ${PORT}`));
