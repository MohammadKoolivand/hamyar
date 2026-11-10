// Keep development auto-login unavailable in deployed environments.
export function isLocalDevLoginAllowed(env = process.env) {
  if (env.NODE_ENV !== "development" || env.HODHOD_DEV_AUTO_LOGIN !== "true")
    return false;
  if (env.MONGO_DB !== "hamyar_dev") return false;
  try {
    const db = new URL(env.MONGO_URL ?? "");
    const origin = new URL(env.APP_ORIGIN ?? "");
    return (
      db.protocol === "mongodb:" &&
      ["127.0.0.1", "localhost"].includes(db.hostname) &&
      origin.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(origin.hostname) &&
      (origin.port === "5174") &&
      !db.username &&
      !db.password
    );
  } catch {
    return false;
  }
}
