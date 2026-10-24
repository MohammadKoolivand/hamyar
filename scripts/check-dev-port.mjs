import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function inspectDevPort(port = 5174, host = "127.0.0.1") {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", (error) => {
      done({ available: false, code: error.code ?? "UNKNOWN" });
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => done({ available: true }));
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await inspectDevPort();
  if (!result.available) {
    console.error(
      result.code === "EADDRINUSE"
        ? [
            "HamYar: پورت 5174 اشغال است؛ شاید برنامه از قبل اجرا شده باشد.",
            "آدرس فعلی را بررسی کنید: http://127.0.0.1:5174",
            "برای شناسایی پردازش در مک: lsof -nP -iTCP:5174 -sTCP:LISTEN",
            "فقط در صورت اطمینان از اینکه پردازش متعلق به شماست، آن را متوقف کنید.",
          ].join("\n")
        : `HamYar: امکان استفاده از 127.0.0.1:5174 وجود ندارد (${result.code}).`,
    );
    process.exitCode = 1;
  }
}
