
//بيجهز Express.
//يعني Routes كلها جاية من jobRoutes.
// ده الـ Global Error Handler بتاع الـ Service كله.
// لو أي حاجة حصلت فوق (Exception) مش متعالج.

const express = require('express');
const jobRoutes = require('./routes/jobRoutes');
const logger = require('./config/logger');
const { requestContext } = require('./middleware/requestContext');
const errorHandler = require('./middleware/errorHandler');
const { router: platformRoutes, metricsMiddleware } = require('./routes/platformRoutes');

const app = express();

app.use(requestContext);
app.use(metricsMiddleware);
app.use(express.json());
app.use((req, res, next) => {
  logger.info('Incoming request.', {
    method: req.method,
    path: req.originalUrl
  });
  res.setHeader('x-service-name', 'scheduler-service');
  next();
});
app.use(platformRoutes);
app.use('/', jobRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Use our new global error handler
app.use(errorHandler);

module.exports = app;
