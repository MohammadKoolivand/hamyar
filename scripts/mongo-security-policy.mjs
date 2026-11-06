/** Pure deployment checks. Error codes only; never serialize connection strings. */
const truthy = (value) => String(value ?? '').toLowerCase() === 'true';
export function mongoDeploymentErrors(raw, dbName) {
  const errors = [];
  let uri;
  try { uri = new URL(raw ?? ''); } catch { return ['MONGO_URI_INVALID']; }
  if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol) || !uri.hostname)
    return ['MONGO_URI_INVALID'];
  if (!uri.username || !uri.password) errors.push('MONGO_APPLICATION_CREDENTIALS_REQUIRED');
  const params = new Map();
  for (const [name, value] of uri.searchParams) {
    const key = name.toLowerCase();
    if (params.has(key)) errors.push('MONGO_DUPLICATE_URI_OPTION');
    params.set(key, value);
  }
  if (truthy(params.get('directconnection'))) errors.push('MONGO_DIRECT_CONNECTION_FORBIDDEN');
  if (uri.protocol === 'mongodb:' && !params.get('replicaset'))
    errors.push('MONGO_REPLICA_SET_OPTION_REQUIRED');
  if (uri.protocol === 'mongodb:' && !truthy(params.get('tls')) && !truthy(params.get('ssl')))
    errors.push('MONGO_TLS_REQUIRED');
  if (uri.protocol === 'mongodb+srv:' && (params.get('tls') === 'false' || params.get('ssl') === 'false'))
    errors.push('MONGO_TLS_REQUIRED');
  const authSource = params.get('authsource') ?? (uri.pathname.length > 1 ? decodeURIComponent(uri.pathname.slice(1)) : 'admin');
  if (!authSource || authSource === '$external' && !params.get('authmechanism'))
    errors.push('MONGO_AUTHSOURCE_INVALID');
  if (params.has('authmechanism') && /^(?:MONGODB-CR|PLAIN)$/i.test(params.get('authmechanism')))
    errors.push('MONGO_WEAK_AUTH_MECHANISM');
  if (!dbName || !/^[\w-]{1,63}$/.test(dbName)) errors.push('MONGO_DB_INVALID');
  return [...new Set(errors)];
}
export function checkMongoTopology(hello) {
  const errors = [];
  if (!hello || typeof hello !== 'object') return ['MONGO_TOPOLOGY_UNAVAILABLE'];
  if (!hello.setName && hello.msg !== 'isdbgrid') errors.push('MONGO_TRANSACTION_TOPOLOGY_UNSUPPORTED');
  if (!Number.isFinite(hello.logicalSessionTimeoutMinutes)) errors.push('MONGO_SESSIONS_UNSUPPORTED');
  if (!Number.isInteger(hello.maxWireVersion) || hello.maxWireVersion < 7)
    errors.push('MONGO_TRANSACTION_SERVER_VERSION_UNSUPPORTED');
  return errors;
}
export function checkMongoRoles(roles, dbName) {
  if (!Array.isArray(roles)) return ['MONGO_ROLE_INSPECTION_UNAVAILABLE'];
  const errors = [];
  const forbidden = new Set(['root', 'dbOwner', 'dbAdminAnyDatabase', 'readWriteAnyDatabase', 'userAdminAnyDatabase', 'clusterAdmin', 'backup', 'restore', 'hostManager', 'userAdmin', 'dbAdmin']);
  if (roles.some((r) => forbidden.has(r.role) || (r.db !== dbName && r.role !== 'read'))) errors.push('MONGO_EXCESSIVE_ROLE_REVIEW_REQUIRED');
  if (!roles.some((r) => r.role === 'readWrite' && r.db === dbName)) errors.push('MONGO_APPLICATION_READWRITE_ROLE_MISSING');
  return errors;
}
