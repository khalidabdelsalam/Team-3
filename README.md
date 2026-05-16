# Scheduler Service

A robust microservice built with Node.js, Express, and node-cron for scheduling background tasks, integrated with Kafka for event emission and MongoDB for job storage.

## Features
- Recurring jobs via `node-cron`.
- Retry mechanisms for failed jobs (e.g. `WEBHOOK_RETRY`).
- Kafka Integration to produce events.
- Job logging (success, failure, retries) inside MongoDB.
- Docker & Docker Compose setup, orchestrated by PM2.

## Prerequisites
- Docker and Docker Compose
- Node.js > 18 (if running locally without Docker)

## Running the Application
The easiest way to run the entire stack (Zookeeper, Kafka, MongoDB, and the Scheduler Service) is via Docker Compose:

```bash
docker-compose up --build -d
```

Once running, the service will be available at `http://localhost:3002`.

## Using the API

### 1. Create a Pending Job
```bash
curl -X POST http://localhost:3002/create-job \
-H "Content-Type: application/json" \
-d '{
  "name": "Retry Payment Webhook",
  "type": "WEBHOOK_RETRY",
  "payload": { "orderId": "123", "amount": 50 }
}'
```
The job will be picked up by the cron interval (every 10 seconds).

### 2. View All Jobs
```bash
curl -X GET http://localhost:3002/jobs
```

### 3. Run Job Directly (Ad-hoc)
```bash
curl -X POST http://localhost:3002/run-job \
-H "Content-Type: application/json" \
-d '{
  "jobId": "<REPLACE_WITH_JOB_ID_FROM_GET>"
}'
```

## Kafka Events Sent
The service acts as a producer and sends the following events to the `events` topic:
- `RETRY_WEBHOOK`
- `BACKUP_STARTED`
- `PREVIEW_REQUESTED`
- `JOB_FAILED` (If a job fails completely after max retries)

## PM2 Integration
The service runs inside the Docker container utilizing `pm2-runtime` based on the configuration defined in `ecosystem.config.js`. It ensures the process stays alive and properly logs errors.
