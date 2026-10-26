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
      process.env.MELIPAYAMAK_USERNAME &&
      process.env.MELIPAYAMAK_PASSWORD &&
      /^\d+$/.test(process.env.MELIPAYAMAK_OTP_BODY_ID ?? ""),
    );
  }
  async sendOtp(phone: string, code: string) {
    if (!this.configured()) throw new Error("SMS not configured");
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
