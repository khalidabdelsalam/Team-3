# API Documentation

This project exposes two microservices with Swagger UI available at runtime.

## Preview Service
- **Runtime Swagger UI:** `http://localhost:3001/docs`
- **Health:** `GET /health`
- **Ready:** `GET /ready`
- **Metrics:** `GET /metrics`

## Compression Service
- **Runtime Swagger UI:** `http://localhost:3002/docs`
- **Health:** `GET /health`
- **Ready:** `GET /ready`
- **Metrics:** `GET /metrics`

## Running Locally

```bash
docker-compose up
```

Then visit:
- Preview API Docs: http://localhost:3001/docs
- Compression API Docs: http://localhost:3002/docs
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3300
- Jaeger: http://localhost:16686
- Kafka UI: http://localhost:8080
