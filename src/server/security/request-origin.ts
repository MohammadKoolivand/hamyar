const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isAllowedRequestOrigin(
  requestOrigin: URL,
  allowedOrigin: URL,
  environment = process.env.NODE_ENV,
) {
  if (requestOrigin.origin === allowedOrigin.origin) return true;
  return (
    environment === "development" &&
    requestOrigin.protocol === allowedOrigin.protocol &&
    requestOrigin.port === allowedOrigin.port &&
    loopbackHosts.has(requestOrigin.hostname) &&
    loopbackHosts.has(allowedOrigin.hostname)
  );
}
