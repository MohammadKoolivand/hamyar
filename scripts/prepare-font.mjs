import { copyFile } from "node:fs/promises";

// Keep the prebuilt Persian fallback consistent with the bundled question font.
// The previous fallback copied Poppins into the Persian face, making Persian UI
// text look incorrect on servers without the optional private font.
await copyFile(
  "src/assets/fonts/BNazanin-Regular.ttf",
  "src/assets/fonts/PersianLocal.ttf",
);
console.log("B Nazanin Persian fallback prepared.");
