import { createInterface } from "node:readline";
import { connect as tlsConnect } from "node:tls";

export type PasswordResetMailer = (
  email: string,
  token: string,
  purpose?: "password_reset" | "email_verification",
) => Promise<void>;

// Use implicit TLS (port 465); do not authenticate or transmit credentials on plaintext SMTP.
export function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.SMTP_FROM &&
    process.env.APP_ORIGIN,
  );
}

function checkedEmail(value: string) {
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) || /[\r\n]/.test(value))
    throw new Error("Invalid SMTP address");
  return value;
}

export const sendPasswordResetEmail: PasswordResetMailer = async (
  email,
  token,
  purpose = "password_reset",
) => {
  if (!smtpConfigured()) throw new Error("SMTP is not configured");
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT ?? "465");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid SMTP port");
  const from = checkedEmail(process.env.SMTP_FROM!);
  const to = checkedEmail(email);
  const origin = new URL(process.env.APP_ORIGIN!);
  if (
    origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(origin.hostname)
  )
    throw new Error("Password reset requires HTTPS APP_ORIGIN");
  const verification = purpose === "email_verification";
  const url =
    origin.origin +
    (verification ? "/verify-email#token=" : "/#reset=") +
    token;
  const message = [
    verification
      ? "برای تأیید مالکیت ایمیل هدهده لینک زیر را باز کنید:"
      : "برای تغییر رمز عبور هدهده روی لینک زیر باز کنید:",
    url,
    "",
    verification
      ? "این لینک تنها یک بار و تا ۳۰ دقیقه معتبر است."
      : "این لینک تنها یک بار و تا ۱۰ دقیقه معتبر است.",
    "اگر درخواست نداده‌اید، این پیام را نادیده بگیرید.",
  ].join("\n");
  const encoded =
    Buffer.from(message, "utf8")
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? "";
  const body = [
    "From: <" + from + ">",
    "To: <" + to + ">",
    "Subject: =?UTF-8?B?" +
      Buffer.from(
        verification ? "تأیید ایمیل هدهده" : "بازیابی رمز عبور هدهده",
      ).toString("base64") +
      "?=",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "Auto-Submitted: auto-generated",
    "",
    encoded,
  ]
    .join("\r\n")
    .replace(/^\./gm, "..");

  const socket = tlsConnect({
    host,
    port,
    servername: host,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });
  socket.setTimeout(12000, () => socket.destroy(new Error("SMTP timeout")));
  const deadline = setTimeout(
    () => socket.destroy(new Error("SMTP deadline")),
    30000,
  );
  const rl = createInterface({ input: socket, crlfDelay: Infinity });
  const lines = rl[Symbol.asyncIterator]();
  async function reply(expected: number) {
    let code = 0;
    for (let i = 0; i < 60; i++) {
      const next = await lines.next();
      if (next.done) throw new Error("SMTP connection closed");
      const line = next.value;
      if (!/^\d{3}[ -]/.test(line)) throw new Error("Invalid SMTP response");
      code = Number(line.slice(0, 3));
      if (line[3] === " ") break;
    }
    if (code !== expected) throw new Error("SMTP rejected operation");
  }
  async function command(line: string, expected: number) {
    socket.write(line + "\r\n");
    await reply(expected);
  }
  try {
    await new Promise<void>((resolve, reject) => {
      if (socket.encrypted && !socket.connecting && socket.authorized)
        return resolve();
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    if (!socket.authorized) throw new Error("SMTP TLS verification failed");
    await reply(220);
    await command("EHLO hodhod", 250);
    await command(
      "AUTH PLAIN " +
        Buffer.from(
          "\0" + process.env.SMTP_USER + "\0" + process.env.SMTP_PASSWORD,
        ).toString("base64"),
      235,
    );
    await command("MAIL FROM:<" + from + ">", 250);
    await command("RCPT TO:<" + to + ">", 250);
    await command("DATA", 354);
    socket.write(body + "\r\n.\r\n");
    await reply(250);
    socket.write("QUIT\r\n");
  } finally {
    clearTimeout(deadline);
    rl.close();
    socket.destroy();
  }
};
