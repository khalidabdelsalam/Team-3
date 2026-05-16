# webhook-service

خدمة Webhook microservice مبنية بـ Node.js وExpress وKafka وMongoDB. الخدمة تستهلك أحداثا من Kafka، تبحث عن الـ webhooks المسجلة لنوع الحدث، ترسل HTTP POST، تسجل كل محاولة في MongoDB، وتدعم retries وdead-letter topic.

## الوظائف الأساسية

- استهلاك رسائل Kafka من topic باسم `events`.
- تسجيل webhooks عبر HTTP API.
- إرسال الأحداث إلى endpoints المسجلة حسب نوع الحدث.
- تسجيل محاولات الإرسال في collection باسم `webhook_logs`.
- منع تكرار إرسال نفس `eventId` لنفس webhook.
- نشر حالة النجاح أو الفشل على topic باسم `webhook-status`.
- نشر الفشل النهائي على dead-letter topic باسم `webhook-dead-letter`.
- حماية اختيارية للـ API باستخدام `API_KEY`.

## التشغيل عبر Docker

```bash
docker compose up -d --build
```

الخدمات الافتراضية:

- `webhook-service`: http://localhost:3001
- `mock-receiver`: http://localhost:8080
- `MongoDB`: localhost:27017
- `Kafka` داخل Docker: `kafka:9092`
- `Kafka` من جهازك: `127.0.0.1:29092`

تشغيل اختبار smoke:

```bash
npm run smoke
```

الاختبار يتحقق من التسجيل، الإرسال اليدوي، Kafka، delivery logs، وMongoDB persistence.

## التشغيل المحلي

```bash
npm install
copy .env.example .env
npm run dev
```

لازم تكون MongoDB وKafka شغالين. لو هتشغل producer من جهازك مع Docker Compose استخدم:

```text
SMOKE_KAFKA_BROKERS=127.0.0.1:29092
```

## حماية الـ API

لو `API_KEY` فارغة، الحماية تكون معطلة لتسهيل التطوير المحلي. لتفعيلها:

```env
API_KEY=change-me
```

بعدها أرسل المفتاح في أي طلب API ما عدا `/health`:

```http
x-api-key: change-me
```

أو:

```http
Authorization: Bearer change-me
```

## Endpoints

### Health

```http
GET /health
```

### Register Webhook

```http
POST /api/webhooks
Content-Type: application/json
```

```json
{
  "name": "backup-monitor",
  "url": "http://webhook-receiver:8080/webhooks/ingest",
  "events": ["BACKUP_COMPLETED"],
  "headers": {
    "x-api-key": "receiver-secret"
  },
  "active": true
}
```

### List Webhooks

```http
GET /api/webhooks
```

### List Delivery Logs

```http
GET /api/webhook-logs?limit=50
```

### Manual Test

```http
POST /test-webhook
Content-Type: application/json
```

```json
{
  "eventId": "event-123",
  "type": "FILE_UPLOADED",
  "payload": {
    "fileId": "file-123"
  },
  "metadata": {
    "tenantId": "tenant-a"
  }
}
```

## Kafka Message Format

```json
{
  "eventId": "event-123",
  "type": "BACKUP_COMPLETED",
  "payload": {
    "backupId": "backup-001"
  },
  "metadata": {
    "tenantId": "tenant-a"
  }
}
```

الأنواع المدعومة حاليا:

- `FILE_UPLOADED`
- `BACKUP_COMPLETED`

## Retry وIdempotency

- `WEBHOOK_RETRY_COUNT=3` يعني 3 retries بعد المحاولة الأولى.
- التأخير بسيط ومتزايد: `WEBHOOK_RETRY_DELAY_MS * attemptNumber`.
- أي status خارج `2xx` يعتبر فشل.
- نفس `eventId` لنفس webhook لا يتم إرساله مرتين، ويتم إرجاع `DUPLICATE_SKIPPED`.
