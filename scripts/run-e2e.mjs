import process from "node:process";
import { spawn } from "node:child_process";
// Fixture-backed browser tests import the real TypeScript backend and JSON curriculum.
// Propagate the same loader to Playwright workers; no auth/API responses are fabricated.
if (
  !/^(hamyar_(ci_e2e|browser)|hodhodeh_(audit|e2e))[-_a-zA-Z0-9]*$/.test(
    process.env.MONGO_DB ?? "",
  )
) {
  throw new Error(
    "Set MONGO_DB explicitly to an isolated hamyar_browser*, hamyar_ci_e2e*, or hodhodeh_audit*/e2e* database before E2E. Never target production.",
  );
}
const child = spawn(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import tsx`.trim(),
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
