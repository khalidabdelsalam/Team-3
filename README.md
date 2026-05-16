# Notification Service

The Notification Service is the `#28` pure Kafka consumer microservice from the project specification. It runs continuously in the background, reacts to system events, stores delivery history, and emits `notification.sent` when a notification is dispatched.

## Responsibilities

- Expose the required `GET /health` and `GET /ready` endpoints.
- Accept optional manual notification requests through `POST /notify/email`.
- Persist notification history in its own PostgreSQL database.
- Consume asynchronous events from Kafka and convert them into user or ops notifications.
- Publish `notification.sent` for downstream services such as Webhook.
- Run under PM2 and inside Docker.

## Architecture

The service follows a layered architecture:

- `src/api`: Express app and middleware.
- `src/config`: environment validation and runtime settings.
- `src/db`: PostgreSQL pool and schema migration.
- `src/events`: Kafka producer and consumer setup.
- `src/modules/notifications`: controller, service, repository, validation, and event translation.
- `src/modules/system`: health and readiness endpoints.
- `src/tests`: API-level tests.

## API

### `GET /health`

Liveness probe.

### `GET /ready`

Readiness probe that checks PostgreSQL and Kafka connectivity state.

### `POST /notify/email`

Creates and sends a manual notification.

Request body:

```json
{
  "type": "manual",
  "to_address": "ops@example.com",
  "subject": "Manual alert",
  "message": "A manual notification was triggered.",
  "metadata": {
    "source": "admin"
  }
}
```

## Kafka Topics

- Consumes: `upload.completed`, `replication.completed`, `quota.exceeded`, `backup.completed`, `metrics.threshold.exceeded`
- Produces: `notification.sent`

## Environment Variables

Create a local `.env` file from `.env.example` if you want to override defaults.

```env
PORT=3001
NODE_ENV=development
SERVICE_NAME=notification-service
DATABASE_URL=postgresql://postgres:postgres@notification-db:5432/notification_service
KAFKA_BROKERS=kafka:29092
KAFKA_CLIENT_ID=notification-service
KAFKA_CONSUMER_GROUP=notification-group
KAFKA_NOTIFICATION_SENT_TOPIC=notification.sent
KAFKA_UPLOAD_COMPLETED_TOPIC=upload.completed
KAFKA_REPLICATION_COMPLETED_TOPIC=replication.completed
KAFKA_QUOTA_EXCEEDED_TOPIC=quota.exceeded
KAFKA_BACKUP_COMPLETED_TOPIC=backup.completed
KAFKA_METRICS_THRESHOLD_TOPIC=metrics.threshold.exceeded
DEFAULT_RECIPIENT=ops@example.com
```

## Run Locally

```bash
cd services/notification
npm install
npm run migrate
npm start
```

## Run With PM2

```bash
cd services/notification
npm install
npm run pm2
```

## Run With Docker Compose

From the repository root:

```bash
docker compose up --build
```

This starts the full shared stack for both services and their infrastructure.

## Testing

```bash
cd services/notification
npm test
```

## Verification

After posting a threshold-breaching metric to the Metrics service, verify notifications:

```bash
curl http://localhost:3001/notifications?limit=5
```

Expected behavior:

- a `metric-threshold-exceeded` notification is saved
- `source_topic` is `metrics.threshold.exceeded`
- `status` is `sent`
