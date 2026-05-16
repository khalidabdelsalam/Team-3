const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

let sdk;

function startTracing() {
  if (process.env.OTEL_TRACING_ENABLED !== 'true') {
    return undefined;
  }

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'webhook-service',
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
    })
  });

  sdk.start();
  return sdk;
}

function shutdownTracing() {
  if (!sdk) {
    return Promise.resolve();
  }

  return sdk.shutdown();
}

module.exports = {
  startTracing,
  shutdownTracing
};
