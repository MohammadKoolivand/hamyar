import { URL, fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const root = new URL("../.next/static/", import.meta.url);
// Use paths relative to the static directory, including nested chunk directories.
const staticRoot = fileURLToPath(root).replace(/\/$/, "");
const assets = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((f) => f.isFile() && !f.name.endsWith(".map"))
  .map(
    (f) =>
      "/_next/static/" +
      f.parentPath.slice(staticRoot.length + 1) +
      (f.parentPath === staticRoot ? "" : "/") +
      f.name,
  );
const version = createHash("sha256")
  .update(assets.join("|"))
  .digest("hex")
  .slice(0, 12);
const template = readFileSync(
  new URL("./sw.template.js", import.meta.url),
  "utf8",
);
writeFileSync(
  new URL("../public/sw.js", import.meta.url),
  template
    .replace("hamyar-shell-v1", "hamyar-next-" + version)
    .replace(
      "/*SHELL_FILES*/ []",
      JSON.stringify(["/", ...assets, "/icon.svg", "/manifest.webmanifest"]),
    ),
);
