import { configuredQuestionGenerator } from "./ai/question-generator";
import { buildApp } from "./app";
import { configuredProvider } from "./ai/provider";
import { connect } from "./db";
import type { FastifyInstance } from "fastify";
// A single pool and modular backend per Next Node.js process, including HMR.
const state = globalThis as typeof globalThis & {
  hamyarBackend?: Promise<FastifyInstance>;
};
export function backend() {
  if (!state.hamyarBackend)
    state.hamyarBackend = (async () => {
      const { client, db } = await connect();
      try {
        const app = await buildApp(
          db,
          configuredProvider(),
          {},
          process.env.AI_AUTHOR_PROVIDER === "ollama"
            ? configuredQuestionGenerator()
            : undefined,
        );
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
