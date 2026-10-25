// Explicit operator bootstrap; never called by the web app or public registration.
import { MongoClient } from "mongodb";
import { createContext } from "../src/server/context";
import { bootstrapSuperadmin } from "../src/server/access-bootstrap";
const client = new MongoClient(
  process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017",
);
try {
  await client.connect();
  await bootstrapSuperadmin(
    createContext(client.db(process.env.MONGO_DB ?? "hamyar")),
    {
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      name: process.env.BOOTSTRAP_ADMIN_NAME,
    },
  );
  console.log(
    "First super administrator created. No existing account was promoted.",
  );
} finally {
  await client.close();
}
