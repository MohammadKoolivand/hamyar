import { test } from "node:test";
import assert from "node:assert/strict";
import { developmentOtpBypass } from "../../src/server/modules/phone-auth";

test("development OTP bypass needs an explicit loopback app and development database", () => {
  const names = ["NODE_ENV", "AUTH_OTP_DEV_BYPASS", "APP_ORIGIN", "MONGO_URL", "MONGO_DB"] as const;
  const prior = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    Object.assign(process.env, {
      NODE_ENV: "development", AUTH_OTP_DEV_BYPASS: "true",
      APP_ORIGIN: "http://127.0.0.1:5174",
      MONGO_URL: "mongodb://127.0.0.1:27017/?replicaSet=hamyar-rs",
      MONGO_DB: "hodhodeh_dev",
    });
    assert.equal(developmentOtpBypass(), true);
    assert.equal(developmentOtpBypass("hamyar_test_other"), false);
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(developmentOtpBypass(), false);
    Object.assign(process.env, { NODE_ENV: "test" });
    assert.equal(developmentOtpBypass(), false);
    Object.assign(process.env, { NODE_ENV: "development" });
    process.env.MONGO_DB = "hamyar";
    assert.equal(developmentOtpBypass(), false);
    process.env.MONGO_DB = "hodhodeh_dev";
    process.env.MONGO_URL = "mongodb://example.com:27017";
    assert.equal(developmentOtpBypass(), false);
    process.env.MONGO_URL = "mongodb://127.0.0.1:27017";
    process.env.APP_ORIGIN = "https://hodhodedu.ir";
    assert.equal(developmentOtpBypass(), false);
    process.env.APP_ORIGIN = "http://127.0.0.1:5174";
    process.env.AUTH_OTP_DEV_BYPASS = "false";
    assert.equal(developmentOtpBypass(), false);
  } finally {
    for (const name of names) {
      if (prior[name] === undefined) delete process.env[name];
      else Object.assign(process.env, { [name]: prior[name] });
    }
  }
});
