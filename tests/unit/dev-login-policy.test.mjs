import test from "node:test";
import assert from "node:assert/strict";
import { isLocalDevLoginAllowed } from "../../scripts/dev-login-policy.mjs";

const good = {
  NODE_ENV: "development", HODHOD_DEV_AUTO_LOGIN: "true",
  MONGO_DB: "hamyar_dev", MONGO_URL: "mongodb://127.0.0.1:27017/?replicaSet=hamyar-rs",
  APP_ORIGIN: "http://127.0.0.1:5174",
};
test("only a dedicated local development setup supports demo login", () => {
  assert.equal(isLocalDevLoginAllowed(good), true);
  for (const patch of [
    { NODE_ENV: "production" }, { NODE_ENV: "test" },
    { HODHOD_DEV_AUTO_LOGIN: "false" }, { MONGO_DB: "hamyar" },
    { MONGO_URL: "mongodb://db.example.com:27017" },
    { MONGO_URL: "mongodb+srv://db.example.com" },
    { APP_ORIGIN: "https://staging.example.com" },
    { APP_ORIGIN: "http://0.0.0.0:5174" },
    { MONGO_URL: "mongodb://username:password@127.0.0.1:27017" },
  ]) assert.equal(isLocalDevLoginAllowed({ ...good, ...patch }), false);
});
