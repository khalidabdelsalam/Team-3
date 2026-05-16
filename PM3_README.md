# PM3 — Kubernetes, CI/CD, Observability & Testing
## Preview Service + Compression Service

---

## What's Included

| Deliverable | Files |
|-------------|-------|
| Kubernetes Manifests | `k8s/` |
| Helm Chart | `helm/chart/` |
| CI/CD Pipeline | `.github/workflows/ci-cd.yml` |
| Unit Tests | `*/tests/unit/*.test.js` |
| Integration Tests | `*/tests/integration/*.test.js` |
| Observability | `observability/` (Prometheus, Grafana, Jaeger) |
| n8n Workflow | `n8n/workflows/file-processing-pipeline.json` |

---

## Part 1 — Run Tests

### Install test dependencies
```bash
cd preview-service && npm install
cd ../compression-service && npm install
```

### Run unit tests
```bash
cd preview-service
npm run test:unit

cd ../compression-service
npm run test:unit
```

### Run integration tests
```bash
cd preview-service
npm run test:integration

cd ../compression-service
npm run test:integration
```

### Run all tests with coverage report
```bash
cd preview-service
npm test

cd ../compression-service
npm test
```

Coverage report generated at: `tests/coverage/`

---

## Part 2 — Kubernetes Deployment

### Prerequisites
- kubectl configured and connected to a cluster
- Helm v3 installed
- Docker images pushed to DockerHub

### Option A — Apply raw manifests
```bash
# Create namespace and config
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# Deploy Preview Service
kubectl apply -f k8s/preview-service/deployment.yaml
kubectl apply -f k8s/preview-service/service.yaml
kubectl apply -f k8s/preview-service/hpa.yaml

# Deploy Compression Service
kubectl apply -f k8s/compression-service/deployment.yaml
kubectl apply -f k8s/compression-service/service.yaml
kubectl apply -f k8s/compression-service/hpa.yaml

# Ingress
kubectl apply -f k8s/ingress.yaml
```

### Option B — Deploy with Helm (recommended)
```bash
# Edit image names first
sed -i 's/YOUR_DOCKERHUB_USERNAME/your-actual-username/g' helm/chart/values.yaml

# Install
helm install cse474 ./helm/chart \
  --namespace cse474-prod \
  --create-namespace

# Upgrade
helm upgrade cse474 ./helm/chart

# Uninstall
helm uninstall cse474 -n cse474-prod
```

### Verify deployment
```bash
kubectl get pods -n cse474-prod
kubectl get services -n cse474-prod
kubectl get hpa -n cse474-prod
kubectl describe deployment preview-service -n cse474-prod
```

---

## Part 3 — Observability Stack

### Start Prometheus + Grafana + Jaeger + Loki
```bash
# Make sure your main services network exists first
docker network create pm2_nodejs_final_fpms 2>/dev/null || true

docker-compose -f observability/docker-compose.observability.yml up -d
```

### Access points
| Tool | URL | Credentials |
|------|-----|-------------|
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3300 | admin / admin123 |
| Jaeger UI | http://localhost:16686 | — |
| Loki | http://localhost:3100 | — |

### Import Grafana Dashboard
1. Open Grafana → http://localhost:3300
2. Login: admin / admin123
3. Left sidebar → Dashboards → Import
4. Upload `observability/grafana/dashboard.json`
5. Select Prometheus as data source → Import

### Prometheus Queries (PromQL)
```promql
# Request rate per service
rate(http_requests_total[5m])

# p95 latency - Preview Service
histogram_quantile(0.95, rate(http_request_duration_ms_bucket{service="preview-service"}[5m]))

# Error rate - Compression Service
rate(http_errors_total{service="compression-service"}[5m])

# Cache hit rate
sum(preview_cache_hits_total) / sum(http_requests_total{route="/preview/:file_id"}) * 100
```

---

## Part 4 — CI/CD Pipeline

### GitHub Actions Setup
1. Push code to GitHub
2. Go to Settings → Secrets and variables → Actions
3. Add secrets:
   - `DOCKERHUB_USERNAME` — your Docker Hub username
   - `DOCKERHUB_TOKEN` — your Docker Hub access token
   - `KUBECONFIG` — base64-encoded kubeconfig file

```bash
# Encode kubeconfig
cat ~/.kube/config | base64 | tr -d '\n'
```

### Pipeline Stages
```
Push to main
    │
    ├─► Lint (ESLint)
    │       │
    │       └─► Test (Unit + Integration + Coverage)
    │               │
    │               └─► Docker Build & Push to DockerHub
    │                           │
    │                           └─► Deploy to Kubernetes via Helm
```

---

## Part 5 — n8n Workflow

### Import workflow
1. Start n8n: `docker run -p 5678:5678 n8nio/n8n`
2. Open http://localhost:5678
3. Workflows → Import from File
4. Select `n8n/workflows/file-processing-pipeline.json`
5. Activate the workflow

### Trigger workflow
```bash
curl -X POST http://localhost:5678/webhook/file-uploaded \
  -H "Content-Type: application/json" \
  -d '{"file_id": "your-file-id", "algorithm": "gzip"}'
```

The workflow:
1. Validates the payload
2. Calls Preview Service → generates thumbnail
3. Calls Compression Service → compresses file
4. Merges results
5. Reports pipeline completion to Metrics

---

## Metrics Exposed (GET /metrics)

Both services expose Prometheus metrics at `/metrics`:

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method/route/status |
| `http_request_duration_ms` | Histogram | Request latency (p50/p95/p99) |
| `http_errors_total` | Counter | 4xx and 5xx errors |
| `previews_generated_total` | Counter | Successful previews generated |
| `preview_cache_hits_total` | Counter | Redis cache hits |
| `compression_jobs_total` | Counter | Compression jobs by status/algorithm |
| `compression_ratio` | Histogram | Distribution of compression ratios |
| `process_cpu_seconds_total` | Counter | CPU usage (default Node.js metric) |
| `process_heap_bytes` | Gauge | Memory usage |
