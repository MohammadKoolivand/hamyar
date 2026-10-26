"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { normalizePhone } from "@/lib/phone";
import { Brand } from "@/components/ui/brand";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
export function PhoneAuthScreen({ onPassword }: { onPassword: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [register, setRegister] = useState(false);
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (token) {
      setInvite(token);
      setRegister(true);
    }
  }, []);
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(
      () => setRemaining((v) => Math.max(0, v - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [remaining]);
  async function request() {
    const result = await api<{
      challengeId: string;
      resendAfter: number;
      message: string;
    }>("/auth/otp/request", { phone: normalizePhone(phone) });
    setChallenge(result.challengeId);
    setCode("");
    setRemaining(result.resendAfter);
    setNotice(result.message);
  }
  return (
    <main className="mx-auto my-[5vh] max-w-lg p-5 sm:pt-12" dir="rtl">
      <div className="mb-7">
        <Brand size="lg" showTagline />
      </div>
      <section className="glass-panel grid gap-5 p-6 sm:p-8">
        <h1 className="text-xl font-bold">
          {challenge ? "کد تأیید را وارد کنید" : "ورود یا ثبت‌نام در هدهده"}
        </h1>
        <p className="text-sm leading-7 text-slate-500">
          {challenge
            ? `کد پیامکی برای ${normalizePhone(phone)} ارسال شده و پنج دقیقه معتبر است.`
            : "با شماره موبایل خودتان وارد شوید؛ نیازی به رمز عبور نیست."}
        </p>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            setNotice("");
            try {
              if (!challenge) {
                await request();
                return;
              }
              await api("/auth/otp/verify", {
                phone: normalizePhone(phone),
                challengeId: challenge,
                code,
                ...(register
                  ? {
                      name,
                      ...(invite ? { invitationToken: invite } : { role }),
                    }
                  : {}),
              });
              window.location.replace("/dashboard");
            } catch (err) {
              const message = (err as Error).message;
              setError(message);
              if (message.includes("نام و نقش")) setRegister(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!challenge ? (
            <Field title="شماره موبایل">
              <input
                className="glass-field min-h-12 w-full p-3 text-left"
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                maxLength={24}
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          ) : (
            <Field title="کد یک‌بارمصرف">
              <input
                className="glass-field min-h-12 w-full p-3 text-center text-xl tracking-[0.4em]"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                minLength={6}
                required
                value={code}
                onChange={(e) =>
                  setCode(
                    normalizePhone(e.target.value)
                      .replace(/\D/g, "")
                      .slice(0, 6),
                  )
                }
              />
            </Field>
          )}
          {register && (
            <>
              <Field title="نام و نام خانوادگی">
                <input
                  className="glass-field w-full p-3"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              {!invite && (
                <Field title="نقش شما">
                  <select
                    className="glass-field w-full p-3"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="student">دانش‌آموز</option>
                    <option value="teacher">معلم</option>
                  </select>
                </Field>
              )}
              {invite && (
                <p className="text-xs leading-6 text-slate-500">
                  نقش و ارتباط حساب از دعوت معتبر معلم تعیین می‌شود.
                </p>
              )}
            </>
          )}
          <Button disabled={busy}>
            {busy
              ? "در حال بررسی…"
              : challenge
                ? "تأیید کد و ورود"
                : "دریافت کد تأیید"}
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm leading-7 text-rose-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm leading-7 text-emerald-700">
            {notice}
          </p>
        )}
        {!invite && !challenge && (
          <button
            type="button"
            className="text-sm text-blue-800"
            onClick={() => setRegister((v) => !v)}
          >
            {register ? "حساب دارم؛ ورود" : "حساب جدید می‌سازم"}
          </button>
        )}
        {challenge && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setChallenge("");
                setError("");
                setNotice("");
              }}
            >
              اصلاح شماره موبایل
            </button>
            <button
              type="button"
              disabled={busy || remaining > 0}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await request();
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {remaining > 0
                ? `ارسال دوباره تا ${remaining} ثانیه`
                : "ارسال دوباره کد"}
            </button>
          </div>
        )}
        <button
          type="button"
          className="text-xs text-slate-500 underline"
          onClick={onPassword}
        >
          ورود با رمز عبور حساب قبلی
        </button>
      </section>
    </main>
  );
}
