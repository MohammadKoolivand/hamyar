/** Pure configuration checks: no connections, and never expose URL credentials. */
const isTrue = (v) => String(v).toLowerCase() === 'true';
const isFalse = (v) => String(v).toLowerCase() === 'false';
const loopback = (h) => ['localhost','127.0.0.1','[::1]'].includes(h.toLowerCase());
export function mongoTransportErrors(raw) {
  const errors = [];
  let url;
  try { url = new URL(raw ?? ''); } catch { return ['MONGO_URL_REQUIRED_OR_INVALID']; }
  if (!['mongodb:', 'mongodb+srv:'].includes(url.protocol) || !url.hostname) return ['MONGO_URL_REQUIRED_OR_INVALID'];
  const options = new Map([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]));
  const get = (key) => options.get(key.toLowerCase());
  if (url.protocol === 'mongodb:' && !isTrue(get('tls')) && !isTrue(get('ssl'))) errors.push('MONGO_TLS_REQUIRED');
  if (isFalse(get('tls')) || isFalse(get('ssl'))) errors.push('MONGO_TLS_DISABLED');
  for (const key of ['tlsInsecure','tlsAllowInvalidCertificates','tlsAllowInvalidHostnames','tlsDisableCertificateRevocationCheck','tlsDisableOCSPEndpointCheck']) {
    if (isTrue(get(key))) errors.push('MONGO_TLS_VERIFICATION_WEAKENED');
  }
  return [...new Set(errors)];
}
export function providerTransportErrors(raw) {
  if (!raw) return [];
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash) return ['AI_ENDPOINT_INVALID'];
    if (url.protocol === 'https:') return [];
    if (url.protocol === 'http:' && loopback(url.hostname)) return [];
    return ['AI_TLS_REQUIRED'];
  } catch { return ['AI_ENDPOINT_INVALID']; }
}
