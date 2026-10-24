import { buildApp } from "./app";
import { connect } from "./db";
import type { FastifyInstance } from "fastify";
// A single pool and modular backend per Next Node.js process, including HMR.
const state = globalThis as typeof globalThis & {
  hamyarBackend?: Promise<FastifyInstance>;
};
export function backend() {
  if (!state.hamyarBackend)
    state.hamyarBackend = (async () => {
      if (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "mock")
        throw new Error("Unsupported AI_PROVIDER");
      const { client, db } = await connect();
      try {
        const app = await buildApp(db);
        await app.ready();
        return app;
      } catch (error) {
        await client.close();
        throw error;
      }
    })().catch((error) => {
      state.hamyarBackend = undefined;
      throw error;
    });
  return state.hamyarBackend;
}
