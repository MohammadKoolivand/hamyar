/* global console */
import { copyFile, access } from "node:fs/promises";
const licensed = ".private/fonts/IRANSansXFaNum-Regular.ttf";
let source = "src/assets/fonts/Poppins-Regular.ttf";
try {
  await access(licensed);
  source = licensed;
} catch {
  /* Optional local font is absent on a fresh checkout. */
}
await copyFile(source, "src/assets/fonts/PersianLocal.ttf");
console.log(
  source === licensed
    ? "Licensed local IRANSans enabled for this build."
    : "Persian uses system fallback; optional licensed font not present.",
);
