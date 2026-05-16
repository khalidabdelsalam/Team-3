const express = require('express');

const logger = require('./config/logger');
const routes = require('./routes');
const { requestContext } = require('./middleware/requestContext');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { router: platformRoutes, metricsMiddleware } = require('./routes/platformRoutes');

const app = express();

app.use(requestContext);
app.use(metricsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  logger.info('Incoming request.', {
    method: req.method,
    path: req.originalUrl
  });

  res.setHeader('x-service-name', 'webhook-service');
  next();
});

app.use(platformRoutes);
app.use(routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
