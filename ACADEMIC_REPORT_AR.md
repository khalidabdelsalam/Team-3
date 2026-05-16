# التقرير الأكاديمي التفصيلي
## مشروع `webhook-service` ضمن بيئة Microservices

## ملاحظة مهمة قبل البدء
هذا المستودع يحتوي على **تنفيذ فعلي كامل لخدمة Webhook Service** فقط.  
أما **Scheduler Service** فليست موجودة ككود منفذ داخل هذا المجلد حاليًا، لذلك سيأتي شرحها هنا باعتبارها **الخدمة المكملة المتوقعة معماريًا** والتي تتكامل مع Webhook Service عبر Kafka وبنفس الأسلوب الهندسي.  
بمعنى آخر:

- ما يخص `Webhook Service` في هذا التقرير مرتبط مباشرة بالملفات الموجودة فعليًا داخل المشروع.
- ما يخص `Scheduler Service` هو شرح معماري وتنفيذي مقترح متوافق مع نفس النظام، وليس وصفًا لملفات موجودة حاليًا داخل هذا الريبو.

---

## 1. مقدمة عامة

### ما فكرة النظام؟
فكرة النظام هي بناء بنية **Microservices** تعتمد على **الأحداث Event-Driven Architecture** بدل الاعتماد على استدعاءات مباشرة بين الخدمات.  
أي أن الخدمات لا تتصل ببعضها دائمًا بأسلوب synchronous request/response، بل تقوم خدمة ما بإنتاج حدث Event إلى وسيط رسائل مثل Kafka، ثم تقوم خدمات أخرى مهتمة بهذا الحدث باستهلاكه وتنفيذ المنطق المناسب.

في هذا المشروع:

- خدمة ما في النظام قد تنتج حدثًا مثل `FILE_UPLOADED`.
- يتم إرسال هذا الحدث إلى Kafka على Topic اسمه `events`.
- تقوم `Webhook Service` باستهلاك هذا الحدث.
- تبحث عن الـ endpoints المسجلة لهذا النوع من الأحداث.
- ترسل HTTP webhook requests إلى الأنظمة الخارجية.
- تسجل النتيجة في MongoDB.

وفي التوسعة المعمارية للنظام:

- تقوم `Scheduler Service` بتشغيل وظائف دورية scheduled jobs.
- عند انتهاء job أو نجاحها أو فشلها، ترسل Event إلى Kafka.
- تلتقط `Webhook Service` هذا الحدث وترسل إشعارًا خارجيًا.

### ما معنى Microservices؟
الـ Microservices هي طريقة تصميم للنظام يتم فيها تقسيم التطبيق إلى خدمات صغيرة مستقلة نسبيًا، بحيث تكون كل خدمة مسؤولة عن Domain أو وظيفة محددة.

بدل أن نضع كل المنطق داخل تطبيق واحد Monolith، نقسمه إلى خدمات مثل:

- خدمة للويب هوكس
- خدمة للجدولة
- خدمة للملفات
- خدمة للنسخ الاحتياطي
- خدمة للإشعارات

ميزات هذا الأسلوب:

- سهولة التوسع الأفقي لكل خدمة على حدة
- سهولة الصيانة والفصل بين المسؤوليات
- تقليل الترابط المباشر بين المكونات
- إمكانية نشر كل خدمة بشكل مستقل

### لماذا نستخدم Kafka؟
نستخدم Kafka لأنه Message Broker قوي مناسب للتعامل مع الأحداث في الأنظمة الموزعة.

أهم أسبابه:

- يفصل بين المنتج Producer والمستهلك Consumer
- يسمح بالاتصال غير المتزامن Asynchronous Communication
- يدعم تحمل الضغط العالي
- يقلل من الترابط المباشر بين الخدمات
- يجعل من السهل إضافة مستهلكين جدد للأحداث مستقبلًا

في هذا المشروع، Kafka تجعل `Webhook Service` لا تحتاج معرفة من أرسل الحدث. كل ما يهمها هو أن رسالة صحيحة وصلت إلى Topic `events`.

### لماذا نستخدم Docker؟
نستخدم Docker لأن المشروع يعتمد على أكثر من مكون:

- Node.js service
- MongoDB
- Kafka
- mock webhook receiver

Docker يجعل تشغيل هذه البيئة أسهل وأكثر ثباتًا، لأن كل مكون يعمل داخل container معزول وله إعداداته الخاصة.  
كما أن `docker-compose.yml` يسمح بتشغيل المنظومة كاملة بأمر واحد.

### لماذا نستخدم PM2؟
نستخدم PM2 لأنه Process Manager مخصص لتشغيل تطبيقات Node.js في بيئات production.

وظائفه الأساسية:

- إعادة تشغيل الخدمة تلقائيًا عند الفشل
- إدارة الـ process lifecycle
- تسهيل التشغيل داخل الحاوية باستخدام `pm2-runtime`
- التحكم في إعدادات التشغيل من خلال `ecosystem.config.js`

### لماذا نستخدم MongoDB؟
نستخدم MongoDB لأنها قاعدة NoSQL مرنة جدًا ومناسبة لتخزين بيانات الأحداث واللوجات والـ webhook payloads.

في هذا المشروع لدينا نوعان من البيانات:

- تعريفات الـ webhooks المسجلة
- سجلات تنفيذ الإرسال لكل محاولة

هذه البيانات ذات بنية مرنة، وقد تحتوي payloads مختلفة حسب نوع الحدث. لذلك MongoDB اختيار مناسب لأنها تتعامل جيدًا مع مستندات JSON.

---

## 2. شرح Webhook Service بالتفصيل

### ما هي Webhook Service؟
هي خدمة مسؤولة عن **تحويل الأحداث الداخلية للنظام إلى HTTP callbacks خارجية**.  
بمعنى أنها تستقبل حدثًا داخليًا من Kafka، ثم ترسل طلب HTTP POST إلى أنظمة خارجية كانت قد سجلت نفسها مسبقًا للاستماع لهذا النوع من الأحداث.

### ما وظيفتها داخل النظام؟
وظيفة الخدمة هي الربط بين العالم الداخلي للنظام والعالم الخارجي.

النظام الداخلي يولد Events مثل:

- `FILE_UPLOADED`
- `BACKUP_COMPLETED`

أما الأنظمة الخارجية فلا تقرأ Kafka غالبًا، لذلك نحتاج طبقة وسيطة تقوم بما يلي:

1. استقبال الحدث
2. معرفة من يهتم به
3. إرسال webhook
4. تسجيل النتيجة
5. إعادة المحاولة عند الفشل

### متى تعمل؟
تعمل في حالتين:

1. عند استقبال رسالة من Kafka على topic `events`
2. عند استدعاء endpoint تجريبي يدوي هو `POST /test-webhook`

### ماذا تستقبل؟
الخدمة تستقبل حدثًا Event في صورة JSON.  
الحقول الأساسية التي تتعامل معها موضحة في الملف `src/services/eventProcessorService.js` داخل الدالة `normalizeEvent`.

الشكل المنطقي للحدث:

```json
{
  "type": "FILE_UPLOADED",
  "payload": {
    "fileId": "file-123"
  },
  "metadata": {
    "tenantId": "tenant-a"
  }
}
```

### ماذا ترسل؟
ترسل HTTP `POST` إلى الـ endpoint المسجل داخل MongoDB، وتضع داخل body نسخة منظمة من الحدث تتضمن:

- `eventId`
- `type`
- `category`
- `description`
- `occurredAt`
- `source`
- `metadata`
- `payload`

كما تضيف headers مثل:

- `x-webhook-event`
- `x-webhook-event-id`

وهذا واضح في `src/services/webhookDeliveryService.js`.

### ما علاقتها بـ Kafka؟
علاقة `Webhook Service` بـ Kafka هي علاقة **Consumer**.

- ملف [src/config/kafka.js](./src/config/kafka.js) ينشئ Kafka client.
- ملف [src/services/kafkaConsumerService.js](./src/services/kafkaConsumerService.js) هو المسؤول عن:
  - إنشاء الـ topic عند الحاجة
  - الاتصال بالـ broker
  - الاشتراك في topic `events`
  - تنفيذ `eachMessage`
  - تمرير الرسالة إلى `eventProcessorService`

### ما علاقتها بـ MongoDB؟
الخدمة تستخدم MongoDB في مسارين:

1. قراءة الـ webhooks المسجلة من collection `webhooks`
2. تخزين نتائج الإرسال في collection `webhook_logs`

هذه العلاقة معرفة في:

- [src/models/Webhook.js](./src/models/Webhook.js)
- [src/models/WebhookLog.js](./src/models/WebhookLog.js)
- [src/services/webhookRegistryService.js](./src/services/webhookRegistryService.js)
- [src/services/webhookDeliveryService.js](./src/services/webhookDeliveryService.js)

### ما علاقتها بـ Scheduler Service؟
العلاقة بين الخدمتين غير مباشرة.  
`Scheduler Service` لا تنادي `Webhook Service` مباشرة، بل ترسل Event إلى Kafka، ثم تقوم `Webhook Service` بالتقاط الحدث إذا كان هناك webhook مسجل لهذا النوع.

إذًا العلاقة هي:

- Scheduler Service = Producer
- Kafka = الوسيط
- Webhook Service = Consumer

### لماذا نحتاج retry logic؟
لأن إرسال webhook إلى نظام خارجي عملية غير مضمونة دائمًا. قد يحدث:

- timeout
- فشل في الشبكة
- endpoint غير متاح
- رجوع status code مثل `500` أو `503`

لو لم توجد retry logic، فسيضيع الإشعار بمجرد أول فشل.  
لذلك تم تصميم الخدمة بحيث تعيد المحاولة حسب:

- `WEBHOOK_RETRY_COUNT`
- `WEBHOOK_RETRY_DELAY_MS`

وهي معرفة في [src/config/env.js](./src/config/env.js) ومستخدمة في [src/services/retrySchedulerService.js](./src/services/retrySchedulerService.js).

### ماذا يحدث عند نجاح إرسال webhook؟
عند النجاح:

1. يتم اعتبار أي status داخل `2xx` نجاحًا.
2. يتم تسجيل المحاولة داخل `attempts`.
3. يتم تحديث `status` إلى `success`.
4. يتم حفظ `deliveredAt`.
5. يتم حفظ `httpStatus`.
6. يتم الاحتفاظ بنسخة مختصرة من response body.

### ماذا يحدث عند فشل إرسال webhook؟
عند الفشل:

1. يتم تسجيل الخطأ أو status code.
2. يتم تحديث `status` إلى `retrying` إذا بقيت محاولات أخرى.
3. يتم حساب `nextRetryAt`.
4. إذا انتهت جميع المحاولات، يصبح `status = failed`.
5. يتم حفظ `lastError` و`retryCount` و`attempts`.

---

## 3. شرح Scheduler Service بالتفصيل

## تنبيه
هذا القسم يشرح **الخدمة الثانية المتوقعة معماريًا** وليس ملفات موجودة حاليًا في هذا المستودع.

### ما هي Scheduler Service؟
هي خدمة مسؤولة عن تشغيل وظائف دورية تلقائيًا مثل:

- تشغيل backup كل ساعة
- فحص الملفات القديمة يوميًا
- تنظيف بيانات مؤقتة
- تنفيذ retry jobs مؤجلة

### ما وظيفتها داخل النظام؟
وظيفتها هي إدارة الأعمال المجدولة Scheduled Tasks بدلًا من وضع هذا المنطق داخل خدمات أخرى.

مثال:

- بدل أن تبقى `Webhook Service` نفسها مسؤولة عن جدولة أعمال مستقبلية كثيرة
- نضع جدولة المهام في خدمة مستقلة
- وعند انتهاء المهمة ترسل Event إلى Kafka

### ما معنى scheduled jobs؟
هي وظائف برمجية تنفذ في وقت لاحق أو بشكل دوري بناءً على وقت أو rule محدد مسبقًا.

### ما معنى cron job؟
cron job هي وظيفة تُنفّذ وفق تعبير زمني مثل:

- كل دقيقة
- كل ساعة
- كل يوم عند 2 صباحًا

مثال cron expression:

```text
0 * * * *
```

وهذا يعني تشغيل المهمة في الدقيقة صفر من كل ساعة.

### ما أنواع jobs الموجودة عادة؟
في نظام مثل هذا يمكن أن توجد jobs مثل:

- `backupJob`
- `cleanupJob`
- `retryFailedWebhookJob`
- `generateDailyReportJob`

### كيف يتم إنشاء job؟
يتم عادة تخزين job definition داخل MongoDB في collection مثل `scheduled_jobs`، ويحتوي على:

- اسم المهمة
- نوعها
- cron expression
- هل هي فعالة أم لا
- آخر وقت تشغيل
- وقت التشغيل التالي
- payload خاص بالمهمة

### كيف يتم تنفيذ job؟
الخطوات المنطقية:

1. scheduler يقرأ الـ jobs الفعالة
2. يحسب أي jobs يجب تشغيلها الآن
3. يشغل الـ handler المناسب
4. يسجل نتيجة التنفيذ
5. يرسل Event إلى Kafka إذا كان التنفيذ يولد حدثًا مهمًا

### كيف يتم تسجيل نتيجة التنفيذ؟
يتم تخزين logs داخل collection مثل `job_logs`، ومن حقولها:

- `jobId`
- `jobName`
- `status`
- `startedAt`
- `finishedAt`
- `durationMs`
- `errorMessage`
- `result`

### كيف ترسل Scheduler events إلى Kafka؟
تكون `Scheduler Service` Producer، فتستخدم `kafkajs` كما يلي:

1. تنشئ producer
2. تتصل بـ Kafka
3. ترسل رسالة إلى topic `events`
4. تضع داخل الرسالة `type`, `payload`, `metadata`

مثال منطقي:

```json
{
  "type": "BACKUP_COMPLETED",
  "payload": {
    "backupId": "bkp-001",
    "durationSeconds": 87
  },
  "metadata": {
    "jobName": "nightly-backup"
  }
}
```

### كيف تتعامل مع MongoDB؟
تستخدم MongoDB من أجل:

- حفظ job definitions
- حفظ execution logs
- حفظ next run time
- حفظ حالة الـ jobs النشطة أو المتوقفة

---

## 4. شرح Architecture

### شكل المشروع العام
المعمارية الحالية الفعلية في هذا المستودع هي:

1. `Webhook Service`
2. `Kafka`
3. `MongoDB`
4. `Mock Receiver`

والمعمارية المتكاملة المقصودة أكاديميًا هي:

1. `Scheduler Service` تنتج أحداثًا
2. `Kafka` يستقبلها
3. `Webhook Service` تستهلكها
4. `MongoDB` تخزن التعريفات واللوجات
5. `External Systems` تستقبل webhooks

### كيف تتواصل الخدمتان مع بعض؟
التواصل بين `Scheduler Service` و`Webhook Service` يتم عبر Kafka، وليس عبر HTTP مباشر.

### من يرسل event؟
في التصميم الكامل:

- أي خدمة منتجة Producer قد ترسل Event
- خصوصًا `Scheduler Service`
- ويمكن أيضًا أن ترسل خدمات رفع ملفات أو نسخ احتياطي

### من يستقبل event؟
`Webhook Service` هي المستهلك Consumer في هذا المشروع.

### لماذا الاتصال بين الخدمات asynchronous؟
لأن الاتصال غير المتزامن:

- يقلل الترابط المباشر
- يمنع انتظار خدمة لأخرى
- يسمح بإعادة المعالجة والتوسع
- يجعل النظام أكثر تحملًا للأعطال المؤقتة

### ما دور Kafka producer؟
الـ Producer ينشر الرسالة إلى topic.  
في السيناريو الأكاديمي يكون Producer هو `Scheduler Service` أو أي خدمة Domain أخرى.

### ما دور Kafka consumer؟
الـ Consumer يشترك في topic، يقرأ الرسائل، ويحوّلها إلى منطق عمل.  
في هذا المشروع يقوم `src/services/kafkaConsumerService.js` بهذا الدور.

---

## 5. شرح File Structure

## 5.1 شجرة ملفات Webhook Service الفعلية

```text
webhook-service/
├─ src/
│  ├─ config/
│  │  ├─ db.js
│  │  ├─ env.js
│  │  ├─ eventTypes.js
│  │  ├─ kafka.js
│  │  └─ logger.js
│  ├─ controllers/
│  │  ├─ healthController.js
│  │  └─ webhookController.js
│  ├─ middleware/
│  │  └─ errorHandler.js
│  ├─ models/
│  │  ├─ Webhook.js
│  │  └─ WebhookLog.js
│  ├─ routes/
│  │  ├─ healthRoutes.js
│  │  ├─ index.js
│  │  └─ webhookRoutes.js
│  ├─ services/
│  │  ├─ eventProcessorService.js
│  │  ├─ kafkaConsumerService.js
│  │  ├─ retrySchedulerService.js
│  │  ├─ seedService.js
│  │  ├─ webhookDeliveryService.js
│  │  └─ webhookRegistryService.js
│  ├─ utils/
│  │  ├─ asyncHandler.js
│  │  └─ sleep.js
│  ├─ app.js
│  └─ server.js
├─ mock-receiver/
│  ├─ Dockerfile
│  └─ server.js
├─ Dockerfile
├─ docker-compose.yml
├─ ecosystem.config.js
├─ package.json
└─ README.md
```

### شرح وظيفة كل folder وملف

#### `src/server.js`
نقطة التشغيل الرئيسية. يبدأ الـ HTTP server، ويتصل بـ MongoDB، وينفذ seeding اختياريًا، ويبدأ Kafka consumer، ويعالج shutdown signals.

#### `src/app.js`
يبني تطبيق Express نفسه، ويضيف:

- JSON parsing
- request logging
- routes
- error handling

#### `src/config/`
مجلد الإعدادات المركزية:

- `env.js`: قراءة environment variables وتحويلها لأنواع مناسبة
- `db.js`: الاتصال بـ MongoDB مع retry
- `kafka.js`: إنشاء Kafka client
- `eventTypes.js`: تعريف الأحداث المدعومة
- `logger.js`: logging بسيط موحد

#### `src/controllers/`
طبقة الـ controllers تستقبل HTTP request وتحوّلها إلى service call.  
أي أنها لا تحتوي business logic ثقيل، بل تنظم الاستجابة فقط.

#### `src/routes/`
تعريف الـ endpoints وربط كل endpoint بالـ controller المناسب.

#### `src/models/`
تعريف الـ Mongoose schemas والـ collections المستخدمة.

#### `src/services/`
هذه أهم طبقة في المشروع، وتحتوي business logic الحقيقي:

- قراءة الأحداث من Kafka
- تنظيم الحدث
- البحث عن الـ webhooks
- إرسال الـ HTTP requests
- تسجيل النتائج
- retry logic

#### `src/middleware/errorHandler.js`
يعالج أخطاء Express والـ 404.

#### `src/utils/`
دوال مساعدة:

- `sleep.js`: delay للاستخدام في retries
- `asyncHandler.js`: تغليف handlers غير المتزامنة

#### `mock-receiver/`
خدمة صغيرة لاختبار وصول الـ webhooks فعليًا داخل `docker-compose`.

#### `Dockerfile`
يبني image خاصة بالخدمة.

#### `docker-compose.yml`
يشغل البيئة كاملة: MongoDB + Kafka + Webhook Service + Mock Receiver.

#### `ecosystem.config.js`
إعدادات PM2 لتشغيل الخدمة في نمط production.

#### `package.json`
يعرف dependencies وscripts الرسمية للمشروع.

#### `README.md`
يوثق التشغيل والاستخدام والـ endpoints.

## 5.2 شجرة ملفات Scheduler Service المقترحة

```text
scheduler-service/
├─ src/
│  ├─ config/
│  │  ├─ db.js
│  │  ├─ env.js
│  │  ├─ kafka.js
│  │  └─ logger.js
│  ├─ controllers/
│  │  └─ schedulerController.js
│  ├─ jobs/
│  │  ├─ backupJob.js
│  │  ├─ cleanupJob.js
│  │  └─ retryFailedWebhookJob.js
│  ├─ models/
│  │  ├─ ScheduledJob.js
│  │  └─ JobLog.js
│  ├─ routes/
│  │  └─ schedulerRoutes.js
│  ├─ scheduler/
│  │  ├─ cronRunner.js
│  │  └─ jobExecutor.js
│  ├─ services/
│  │  ├─ kafkaProducerService.js
│  │  └─ schedulerService.js
│  ├─ app.js
│  └─ server.js
├─ Dockerfile
├─ ecosystem.config.js
├─ package.json
└─ README.md
```

هذه الشجرة ليست موجودة حاليًا في المستودع، لكنها هي البنية الأنسب لو أردنا تنفيذ Scheduler Service بنفس مستوى التنظيم المستخدم في Webhook Service.

---

## 6. شرح أهم أجزاء الكود

## 6.1 ملف تشغيل السيرفر

الملف: [src/server.js](./src/server.js)

أهم مقطع:

```js
async function bootstrapDependencies() {
  await connectMongoWithRetry();
  await seedSampleWebhook();
  await kafkaConsumerService.start();
}
```

الشرح:

- `connectMongoWithRetry()` يتأكد أن قاعدة البيانات متصلة قبل بدء الاعتماد عليها.
- `seedSampleWebhook()` ينشئ webhook تجريبي إذا كانت البيئة تطلب ذلك.
- `kafkaConsumerService.start()` يبدأ استهلاك الأحداث من Kafka.

هذا الترتيب مهم، لأن استهلاك الرسائل قبل جاهزية MongoDB قد يؤدي إلى استلام event بينما قاعدة البيانات غير جاهزة لتخزين logs.

## 6.2 ملف بناء التطبيق

الملف: [src/app.js](./src/app.js)

مقطع مهم:

```js
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
```

هذا يعني أن التطبيق قادر على استقبال JSON payloads في طلبات الـ API.

ومقطع مهم آخر:

```js
app.use((req, res, next) => {
  logger.info('Incoming request.', {
    method: req.method,
    path: req.originalUrl
  });

  res.setHeader('x-service-name', 'webhook-service');
  next();
});
```

هذا middleware يسجل الطلبات الواردة ويضيف header تعريفي للخدمة.

## 6.3 ملف الإعدادات

الملف: [src/config/env.js](./src/config/env.js)

هذا الملف مهم جدًا لأن كل إعدادات البيئة موجودة فيه:

- منفذ التشغيل
- رابط MongoDB
- Kafka brokers
- topic name
- timeout
- retry count
- retry delay

ميزة هذا التصميم أنه يمنع توزيع الإعدادات على ملفات متعددة بشكل غير منظم.

## 6.4 ملف الاتصال بقاعدة البيانات

الملف: [src/config/db.js](./src/config/db.js)

مقطع مهم:

```js
while (mongoose.connection.readyState !== 1) {
  try {
    await mongoose.connect(config.mongoUri);
    return mongoose.connection;
  } catch (error) {
    await sleep(config.database.retryConnectionDelayMs);
  }
}
```

المعنى:

- إذا فشل الاتصال بقاعدة البيانات، لا تنهار الخدمة مباشرة
- بل تنتظر قليلًا ثم تعيد المحاولة

وهذا مناسب جدًا لبيئات Docker، لأن الحاويات قد لا تكون جاهزة كلها في نفس اللحظة.

## 6.5 Kafka Consumer

الملف: [src/services/kafkaConsumerService.js](./src/services/kafkaConsumerService.js)

مقطع مهم:

```js
await consumer.subscribe({
  topic: config.kafka.topic,
  fromBeginning: false
});
```

هذا يعني أن الخدمة تشترك في topic `events` وتقرأ الرسائل الجديدة فقط.

ومقطع أهم:

```js
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = parseKafkaMessage(message);
    await eventProcessorService.handleEvent(event, { source: 'kafka' });
  }
});
```

المعنى:

- Kafka تعطي الرسالة الخام
- `parseKafkaMessage` يحولها إلى كائن منظم
- `handleEvent` ينفذ منطق العمل الكامل

## 6.6 Event Processor

الملف: [src/services/eventProcessorService.js](./src/services/eventProcessorService.js)

هو الطبقة التي تربط بين قراءة الحدث وتنفيذ webhook delivery.

الوظائف الأساسية:

- `normalizeEvent`: توحيد شكل الرسالة
- `buildDispatchPayload`: تجهيز payload مناسب للإرسال الخارجي
- `handleEvent`: تشغيل المعالجة الكاملة

مقطع مهم:

```js
const matchedWebhooks = await webhookRegistryService.findActiveWebhooksByEvent(
  normalizedEvent.type
);
```

هذه الخطوة تبحث داخل MongoDB عن كل webhooks الفعالة المسجلة لنفس نوع الحدث.

ثم:

```js
const settledDeliveries = await Promise.allSettled(
  matchedWebhooks.map((webhook) => webhookDeliveryService.dispatchToWebhook(webhook, dispatchPayload))
);
```

هذا يعني أن الخدمة يمكنها إرسال نفس الحدث إلى أكثر من endpoint في نفس الوقت.

## 6.7 Webhook Delivery Service

الملف: [src/services/webhookDeliveryService.js](./src/services/webhookDeliveryService.js)

هذا هو قلب المشروع الحقيقي.

أولًا يتم إنشاء log مبدئي:

```js
const logEntry = await WebhookLog.create({
  webhook: webhook._id,
  eventId: eventPayload.eventId,
  eventType: eventPayload.type,
  endpoint: webhook.url,
  payload: eventPayload,
  source: eventPayload.source,
  status: 'pending'
});
```

ثم يبدأ loop المحاولات:

```js
for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber += 1) {
```

ثم يتم إرسال الطلب:

```js
const response = await axios.post(webhook.url, eventPayload, {
  timeout: config.webhook.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-event': eventPayload.type,
    'x-webhook-event-id': eventPayload.eventId,
    ...(webhook.headers || {})
  },
  validateStatus: () => true
});
```

النقاط المهمة هنا:

- `timeout` يحمي الخدمة من الانتظار الطويل
- يتم إرسال event metadata داخل headers
- `validateStatus: () => true` يمنع axios من رمي exception تلقائيًا لكل status غير ناجح، حتى نستطيع التعامل معه برمجيًا

إذا كان status من `2xx`:

- يتم تحديث `status = success`
- يتم حفظ `deliveredAt`
- يتم حفظ `responseBody`

أما عند الفشل:

- يتم حفظ الخطأ
- يتم حساب `nextRetryAt`
- يتم الانتظار بواسطة `waitForRetry`
- ثم تعاد المحاولة

## 6.8 Webhook Registry Service

الملف: [src/services/webhookRegistryService.js](./src/services/webhookRegistryService.js)

هو طبقة الوصول إلى بيانات التسجيل:

- إنشاء webhook جديد
- جلب webhooks
- البحث حسب نوع الحدث
- جلب اللوجات

## 6.9 الـ Controllers

الملف: [src/controllers/webhookController.js](./src/controllers/webhookController.js)

هذا الملف يعرّف منطق endpoints الخاصة بالتعامل مع:

- `GET /api/webhooks`
- `POST /api/webhooks`
- `GET /api/webhook-logs`
- `POST /test-webhook`

وهو يقوم بالتحقق من صحة المدخلات قبل تمريرها إلى services.

## 6.10 الـ Models

### `src/models/Webhook.js`
يمثل endpoint مسجلًا، ويحتوي على:

- `name`
- `url`
- `events`
- `headers`
- `active`

### `src/models/WebhookLog.js`
يمثل عملية إرسال فعلية، ويحتوي على:

- نوع الحدث
- الـ endpoint
- الحالة النهائية
- عدد الإعادات
- بيانات آخر محاولة
- قائمة `attempts`

## 6.11 ملفات الـ Routes

الملف: [src/routes/webhookRoutes.js](./src/routes/webhookRoutes.js)

هذا الملف يربط الـ endpoints بالـ controllers باستخدام `asyncHandler`.

## 6.12 ملفات الـ Jobs في Scheduler Service

في الخدمة المقترحة `Scheduler Service` ستكون هناك ملفات مثل:

- `jobs/backupJob.js`
- `jobs/cleanupJob.js`
- `jobs/retryFailedWebhookJob.js`

كل ملف job يكون مسؤولًا عن نوع واحد من المهام، وهذا يحقق separation of concerns.

---

## 7. شرح Database

### أسماء الـ collections المستخدمة فعليًا

- `webhooks`
- `webhook_logs`

### وظيفة كل collection

#### `webhooks`
تخزن الـ endpoints المسجلة التي يجب إرسال webhooks إليها.

#### `webhook_logs`
تخزن كل محاولة إرسال webhook مع الحالة والنتيجة والتوقيتات.

### أهم fields في `webhooks`

- `name`: اسم endpoint
- `description`: وصف اختياري
- `url`: رابط الـ webhook
- `events`: أنواع الأحداث التي يشترك فيها
- `headers`: headers إضافية
- `active`: هل التسجيل فعال أم لا

### أهم fields في `webhook_logs`

- `webhook`: مرجع إلى التسجيل الأصلي
- `eventId`: معرف الحدث
- `eventType`: نوع الحدث
- `endpoint`: الرابط المرسل إليه
- `payload`: البيانات المرسلة
- `status`: pending / retrying / success / failed
- `retryCount`: عدد الإعادات الفعلية
- `maxRetries`: العدد الأقصى
- `httpStatus`: آخر HTTP status
- `lastError`: آخر خطأ
- `nextRetryAt`: موعد المحاولة القادمة
- `deliveredAt`: وقت التسليم الناجح
- `attempts`: سجل مفصل لكل محاولة

### لماذا نحتاج هذه البيانات؟
لأننا نحتاج:

- تتبع ما الذي تم إرساله
- معرفة النجاح والفشل
- مراقبة retries
- دعم debugging
- تقديم audit trail

### ماذا يتم تخزينه عند success؟

- `status = success`
- `httpStatus`
- `deliveredAt`
- المحاولة الناجحة داخل `attempts`
- `lastResponseBody`

### ماذا يتم تخزينه عند failure؟

- `status = retrying` أو `failed`
- `lastError`
- `retryCount`
- `nextRetryAt` إذا بقيت محاولات
- تفاصيل كل محاولة فاشلة داخل `attempts`

### بيانات Scheduler Service المقترحة
في الخدمة الثانية المقترحة يمكن إضافة collections مثل:

- `scheduled_jobs`
- `job_logs`

---

## 8. شرح Kafka Setup

### ما هي الـ topics المستخدمة؟
في التنفيذ الحالي يوجد topic واحد:

- `events`

وهو معرف في [src/config/env.js](./src/config/env.js) ويُنشأ أيضًا داخل [src/services/kafkaConsumerService.js](./src/services/kafkaConsumerService.js).

### من هو الـ Producer؟
في هذا المستودع الحالي تم اختبار الإنتاج بطريقتين:

- من endpoint `/test-webhook` بشكل يدوي داخليًا دون المرور على Kafka
- ومن Producer تجريبي داخل الحاوية أثناء الـ smoke test

أما معماريًا فالـ Producer المفترض هو:

- `Scheduler Service`
- أو أي خدمة أعمال أخرى مثل file service أو backup service

### من هو الـ Consumer؟
الـ Consumer الفعلي هو `Webhook Service`.

### ما شكل الرسالة التي تُرسل؟

```json
{
  "type": "BACKUP_COMPLETED",
  "payload": {
    "backupId": "bkp-001",
    "durationSeconds": 87
  },
  "metadata": {
    "tenantId": "tenant-a"
  }
}
```

### كيف يتم استقبالها؟
داخل `eachMessage` في `kafkaConsumerService.js`:

1. يتم قراءة `message.value`
2. تحويله إلى string
3. عمل `JSON.parse`
4. تمريره إلى `eventProcessorService.handleEvent`

### ماذا يحدث بعد استقبالها؟

1. توحيد شكل الحدث
2. تحديد webhooks المطابقة
3. إرسال webhooks
4. تسجيل logs في MongoDB
5. إرجاع ملخص النجاح والفشل

---

## 9. شرح Docker

### وظيفة Dockerfile
الملف: [Dockerfile](./Dockerfile)

يقوم بما يلي:

1. اختيار صورة `node:20-alpine`
2. تعيين `WORKDIR`
3. نسخ `package*.json`
4. تثبيت dependencies باستخدام `npm ci --omit=dev`
5. نسخ ملفات المشروع
6. فتح المنفذ `3001`
7. تشغيل التطبيق باستخدام `pm2-runtime`

### وظيفة docker-compose.yml
الملف: [docker-compose.yml](./docker-compose.yml)

هذا الملف يشغل عدة containers معًا:

- `mongo`
- `kafka`
- `webhook-receiver`
- `webhook-service`

### ما الـ containers المستخدمة؟

- `mongo:7`
- `apache/kafka:latest`
- `webhookservice-webhook-receiver`
- `webhookservice-webhook-service`

### كيف يتم تشغيل MongoDB؟
داخل service اسمها `mongo`، مع volume دائم `mongo_data` وhealthcheck للتأكد أن القاعدة جاهزة.

### كيف يتم تشغيل Kafka؟
داخل service اسمها `kafka` باستخدام وضع KRaft، مع environment variables خاصة بالـ broker والـ controller.

### كيف تعمل الخدمات داخل containers؟
كل خدمة لها:

- image أو build context
- environment variables
- ports
- healthcheck
- restart policy

### لماذا نستخدم depends_on؟
لأن `webhook-service` تعتمد على:

- `mongo`
- `kafka`
- `webhook-receiver`

واستخدام `depends_on` مع `condition: service_healthy` يقلل احتمالية بدء الخدمة قبل جاهزية المكونات الأخرى.

### لماذا نستخدم environment variables؟
لأنها تسمح بفصل الإعدادات عن الكود، مثل:

- عنوان Kafka
- عنوان MongoDB
- timeout
- retry count
- seed URL

---

## 10. شرح PM2

### ما هو PM2؟
PM2 هو مدير عمليات لتطبيقات Node.js في بيئات التشغيل.

### لماذا نستخدم `ecosystem.config.js`؟
لأنه يجمع إعدادات تشغيل الخدمة في ملف واحد:

- اسم الخدمة
- ملف التشغيل
- عدد instances
- نمط التنفيذ
- متغيرات البيئة
- حدود الذاكرة

### كيف يتم تشغيل الخدمة باستخدام PM2؟

محليًا:

```bash
npx pm2 start ecosystem.config.js --env production
```

وداخل Docker:

```bash
pm2-runtime ecosystem.config.js --env production
```

### ما الفرق بين تشغيل `node` مباشرة وتشغيل PM2؟

تشغيل `node` مباشرة:

- بسيط
- مناسب للتطوير السريع
- لا يوفر إدارة عمليات متقدمة

تشغيل PM2:

- يعيد تشغيل التطبيق عند الانهيار
- يدير lifecycle بشكل أفضل
- مناسب أكثر للإنتاج

---

## 11. شرح API Endpoints

## 11.1 Webhook Service الفعلية

### `GET /health`
- الهدف: فحص صحة الخدمة
- method: `GET`
- body: لا يوجد
- response: حالة الخدمة وMongoDB وKafka والإعدادات الأساسية

مثال:

```bash
curl http://localhost:3001/health
```

### `GET /api/webhooks`
- الهدف: جلب قائمة الـ webhooks المسجلة
- method: `GET`
- body: لا يوجد

### `POST /api/webhooks`
- الهدف: تسجيل webhook جديد
- method: `POST`

body example:

```json
{
  "name": "backup-monitor",
  "url": "http://localhost:8080/webhooks/custom",
  "events": ["BACKUP_COMPLETED"],
  "headers": {
    "x-api-key": "secret"
  },
  "active": true
}
```

### `GET /api/webhook-logs`
- الهدف: جلب سجلات الإرسال
- method: `GET`
- query optional: `limit`

مثال:

```bash
curl "http://localhost:3001/api/webhook-logs?limit=10"
```

### `POST /test-webhook`
- الهدف: اختبار منطق معالجة الحدث يدويًا دون انتظار Kafka
- method: `POST`

body example:

```json
{
  "type": "FILE_UPLOADED",
  "payload": {
    "fileId": "file-123",
    "fileName": "backup.zip"
  },
  "metadata": {
    "tenantId": "tenant-a"
  }
}
```

## 11.2 Scheduler Service المقترحة

لو تم تنفيذها فالمتوقع أن تملك endpoints مثل:

- `GET /health`
- `GET /api/jobs`
- `POST /api/jobs`
- `POST /api/jobs/:id/run`
- `PATCH /api/jobs/:id/toggle`
- `GET /api/job-logs`

هذه endpoints ليست موجودة في المستودع الحالي، لكنها منطقية جدًا في حال بناء Scheduler Service كاملة.

---

## 12. شرح Run Instructions

### تشغيل محلي

1. تثبيت الحزم:

```bash
npm install
```

2. إنشاء ملف بيئة من المثال:

```bash
cp .env.example .env
```

3. تشغيل الخدمة:

```bash
npm run dev
```

### تشغيل عبر Docker Compose

```bash
docker compose up --build
```

هذا يشغّل:

- MongoDB
- Kafka
- Mock Receiver
- Webhook Service

### اختبار الخدمات

1. فحص الصحة:

```bash
curl http://localhost:3001/health
```

2. فحص الـ webhooks:

```bash
curl http://localhost:3001/api/webhooks
```

3. اختبار يدوي:

```bash
curl -X POST http://localhost:3001/test-webhook \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"FILE_UPLOADED\",\"payload\":{\"fileId\":\"file-123\"}}"
```

### اختبار Kafka messages
من داخل بيئة الـ compose يمكن استخدام Producer لإرسال رسالة إلى topic `events` ثم التأكد من استهلاكها.

---

## 13. شرح Flow كامل

## Scenario 1
### حدث file uploaded يحصل -> Kafka -> Webhook Service -> MongoDB

1. خدمة رفع الملفات تنتج Event من نوع `FILE_UPLOADED`
2. يتم إرسال الرسالة إلى Kafka topic `events`
3. `Webhook Service` تستقبل الرسالة عبر `kafkaConsumerService`
4. `eventProcessorService` يوحد شكل الحدث
5. `webhookRegistryService` يبحث عن الـ endpoints المسجلة لهذا الحدث
6. `webhookDeliveryService` يرسل POST request لكل endpoint
7. إذا نجح الإرسال يتم تسجيل `success` في `webhook_logs`
8. إذا فشل يتم تنفيذ retries ثم تسجيل النتيجة النهائية

## Scenario 2
### Scheduler يشغل job دوري -> يرسل Event -> Webhook أو retry job

1. `Scheduler Service` تشغّل job مثل backup دوري
2. تنتهي الـ job بنجاح
3. ترسل scheduler event إلى Kafka مثل `BACKUP_COMPLETED`
4. `Webhook Service` تلتقط الرسالة
5. تبحث عن الـ webhooks المهتمة بهذا الحدث
6. ترسل الإشعار الخارجي
7. تسجل النتيجة في MongoDB

وفي سيناريو آخر:

1. توجد job مخصصة لإعادة المحاولة على عمليات معينة مؤجلة
2. تنفذ scheduler هذه job في وقت لاحق
3. ترسل Event يوضح نجاح retry أو فشله
4. تلتقطه `Webhook Service` وترسل إشعارًا للخارج

---

## 14. لماذا صممنا النظام بهذا الشكل؟

### لماذا فصلنا Webhook عن Scheduler؟
لأن كل خدمة لها مسؤولية مختلفة:

- `Webhook Service`: إرسال الأحداث إلى أنظمة خارجية
- `Scheduler Service`: إدارة المهام الزمنية والدورية

هذا الفصل يجعل كل خدمة أبسط وأكثر قابلية للصيانة.

### لماذا استخدمنا Kafka بدل direct calls؟
لأن direct calls تربط الخدمات ببعضها بإحكام.  
أما Kafka فتجعل:

- المنتج لا يحتاج لمعرفة المستهلك
- المستهلك يمكن تغييره أو توسيعه بسهولة
- النظام أكثر مرونة وتحملًا

### لماذا استخدمنا MongoDB؟
لأن payloads والأحداث واللوجات بيانات مرنة بطبيعتها، وMongoDB مناسبة جدًا لهذا الشكل.

### لماذا استخدمنا Docker؟
لأن المشروع متعدد المكونات، وDocker يوفر بيئة تشغيل ثابتة وسهلة النقل.

### لماذا استخدمنا PM2؟
لأن Node.js process قد تحتاج إلى مراقبة وإدارة restart في الإنتاج.

### كيف يحقق هذا التصميم Microservices Architecture؟
لأنه:

- يفصل المسؤوليات
- يعتمد على event-driven communication
- يستخدم broker وسيط
- يسمح بتوسع كل خدمة بشكل مستقل

---

## 15. نقاط مهمة للمناقشة

### سؤال: لماذا Kafka؟
الإجابة: لأنها تدعم event-driven architecture، وتفصل المنتج عن المستهلك، وتسمح بالتوسع وإضافة مستهلكين جدد دون تعديل المنتج.

### سؤال: لماذا Docker؟
الإجابة: لأن النظام يحتاج Node.js وMongoDB وKafka معًا، وDocker يجعل تشغيل البيئة بالكامل متسقًا وسهلًا.

### سؤال: لماذا PM2؟
الإجابة: لإدارة عملية Node.js في الإنتاج، وإعادة التشغيل التلقائي، وتوحيد إعدادات التشغيل.

### سؤال: ما الفرق بين Webhook وScheduler؟
الإجابة:

- Webhook Service ترسل إشعارات إلى أنظمة خارجية عند وصول حدث
- Scheduler Service تنشئ أو تنفذ أحداثًا دورية أو jobs زمنية

### سؤال: ماذا يحدث لو webhook فشل؟
الإجابة: يتم تسجيل الفشل، ثم تعاد المحاولة حسب عدد الـ retries والـ delay المحدد، ثم تحفظ النتيجة النهائية في `webhook_logs`.

### سؤال: كيف نضمن عدم ضياع events؟
الإجابة: Kafka تحفظ الرسائل، والخدمة تعمل كمستهلك مستقل، كما أن نتائج الإرسال تحفظ في MongoDB، وهذا يعطي traceability ومتابعة أفضل.

### سؤال: أين يتم تخزين logs؟
الإجابة:

- لوجات التشغيل العامة تظهر في stdout / PM2 logs
- لوجات تنفيذ webhooks تحفظ في MongoDB داخل `webhook_logs`

### سؤال: كيف تتوسع الخدمة مستقبلًا؟
الإجابة:

- إضافة topics جديدة
- إضافة event types جديدة في `src/config/eventTypes.js`
- إضافة consumers أخرى
- فصل retry mechanism إلى queue مستقلة
- تنفيذ Scheduler Service فعليًا

### سؤال: هل المشروع الحالي يحتوي Scheduler Service فعلًا؟
الإجابة الدقيقة أكاديميًا: لا، المستودع الحالي يحتوي تنفيذ Webhook Service فقط، لكن المعمارية المصممة تسمح بإضافة Scheduler Service بسهولة لأنها ستعمل كـ Kafka producer مستقل.

---

## خلاصة نهائية

المشروع الحالي يحقق تنفيذًا فعليًا لخدمة `Webhook Service` ضمن بنية Microservices تعتمد على:

- Node.js + Express
- Kafka
- MongoDB
- Docker
- PM2

وقد تم بناؤه بحيث:

- يستهلك الأحداث من Kafka
- يطابق الحدث مع webhooks مسجلة
- يرسل webhooks للأنظمة الخارجية
- يسجل كل محاولة في MongoDB
- يطبق retry logic
- يعمل داخل Docker Compose

أما `Scheduler Service` فهي الخدمة الطبيعية التالية في هذا النظام، ودورها أن تكون مصدرًا منظمًا للأحداث الزمنية والدورية التي ستغذي Kafka، ثم تستفيد منها `Webhook Service` أو أي خدمات أخرى مستقبلًا.
