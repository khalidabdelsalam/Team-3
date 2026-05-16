/**
 * OpenTelemetry Distributed Tracing
 * Exports traces to Jaeger
 * Must be required FIRST before any other imports in app.js
 */
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const JAEGER_URL = process.env.JAEGER_URL || 'http://jaeger:4318/v1/traces';
const SERVICE    = process.env.SERVICE_NAME || 'preview-service';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE,
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: JAEGER_URL,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-redis': { enabled: true },
    }),
  ],
});

sdk.start();
console.log(`[Tracing] OpenTelemetry started — exporting to ${JAEGER_URL}`);

process.on('SIGTERM', () => sdk.shutdown());

module.exports = sdk;
