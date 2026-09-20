import * as Sentry from "@sentry/astro";

// The reading inbox holds private browser data, so do not initialize client telemetry there.
if (window.location.pathname !== "/inbox" && window.location.pathname !== "/inbox/") {
  Sentry.init({
    dsn: import.meta.env.PUBLIC_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
  });
}
