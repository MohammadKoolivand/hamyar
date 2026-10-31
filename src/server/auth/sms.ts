export interface SmsProvider {
  readonly name: string;
  configured(): boolean;
  sendOtp(phone: string, code: string): Promise<void>;
}
export class MelipayamakProvider implements SmsProvider {
  readonly name = "melipayamak";
  constructor(private readonly transport: typeof fetch = fetch) {}
  configured() {
    return Boolean(
      (this.sharedEndpoint() ||
        (!process.env.MELIPAYAMAK_SHARED_ENDPOINT &&
          process.env.MELIPAYAMAK_USERNAME &&
          process.env.MELIPAYAMAK_PASSWORD)) &&
      /^\d+$/.test(process.env.MELIPAYAMAK_OTP_BODY_ID ?? ""),
    );
  }
  private sharedEndpoint() {
    try {
      const url = new URL(process.env.MELIPAYAMAK_SHARED_ENDPOINT ?? "");
      if (
        url.origin === "https://console.melipayamak.com" &&
        /^\/api\/send\/shared\/[A-Za-z0-9_-]+$/.test(url.pathname) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      )
        return url.href;
    } catch {
      /* An absent or invalid endpoint is not configured. */
    }
    return null;
  }
  async sendOtp(phone: string, code: string) {
    if (!this.configured()) throw new Error("SMS not configured");
    const endpoint = this.sharedEndpoint();
    if (endpoint) {
      // Never propagate fetch/JSON errors: the request URL contains the API key.
      try {
        const response = await this.transport(endpoint, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            bodyId: Number(process.env.MELIPAYAMAK_OTP_BODY_ID),
            to: phone.startsWith("+98") ? `0${phone.slice(3)}` : phone,
            args: [code],
          }),
        });
        if (!response.ok) throw new Error("SMS unavailable");
        const body = (await response.json()) as {
          recId?: unknown;
          RetStatus?: unknown;
        };
        if (
          !body ||
          typeof body !== "object" ||
          (body.RetStatus !== undefined && Number(body.RetStatus) !== 1) ||
          !/^\d+$/.test(String(body.recId)) ||
          BigInt(String(body.recId)) <= 0n
        )
          throw new Error("SMS rejected");
        return;
      } catch {
        throw new Error("SMS delivery failed");
      }
    }
    const response = await this.transport(
      "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
          username: process.env.MELIPAYAMAK_USERNAME!,
          password: process.env.MELIPAYAMAK_PASSWORD!,
          bodyId: process.env.MELIPAYAMAK_OTP_BODY_ID!,
          to: phone,
          text: code,
        }),
      },
    );
    if (!response.ok) throw new Error("SMS unavailable");
    // Only positive acceptance status with a real message receipt is success.
    const body = (await response.json()) as {
      RetStatus?: unknown;
      Value?: unknown;
    };
    if (
      Number(body.RetStatus) !== 1 ||
      !/^\d+$/.test(String(body.Value)) ||
      BigInt(String(body.Value)) <= 0n
    )
      throw new Error("SMS rejected");
  }
}
