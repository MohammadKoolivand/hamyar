"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [change, setChange] = useState(false);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    function consume() {
      const found = /^#token=([a-f0-9]{64})$/.exec(window.location.hash);
      if (found) {
        setToken(found[1]);
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname,
        );
      }
    }
    consume();
    window.addEventListener("hashchange", consume);
    return () => window.removeEventListener("hashchange", consume);
  }, []);
  return (
    <main dir="rtl" className="mx-auto max-w-lg p-5 pt-16">
      <section className="glass-panel grid gap-5 p-6">
        <h1 className="text-xl font-bold">تأیید مالکیت ایمیل</h1>
        <p className="text-sm leading-7 text-slate-600">
          ثبت ایمیل به‌تنهایی مالکیت آن را ثابت نمی‌کند. بازیابی رمز فقط برای
          ایمیل تأییدشده فعال است. ورود آزمایشی بدون تأیید همچنان ممکن است.
        </p>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const result = await api<{ message: string }>(
                token
                  ? "/auth/email-verification/confirm"
                  : change
                    ? "/auth/email/change"
                    : "/auth/email-verification/request",
                token ? { token } : change ? { email, password } : { email },
              );
              setMessage(result.message);
              setToken("");
              setPassword("");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!token && (
            <Field title="ایمیل حساب">
              <input
                className="glass-field w-full p-3"
                type="email"
                dir="ltr"
                required
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          )}
          {!token && change && (
            <Field title="رمز فعلی حساب">
              <input
                className="glass-field w-full p-3"
                type="password"
                autoComplete="current-password"
                minLength={10}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          <Button disabled={busy}>
            {busy
              ? "در حال بررسی…"
              : token
                ? "تأیید ایمیل"
                : "ارسال لینک تأیید"}
          </Button>
        </form>
        {!token && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={change}
              onChange={(e) => setChange(e.target.checked)}
            />
            تغییر یا افزودن ایمیل به حساب واردشده
          </label>
        )}
        {message && (
          <p role="status" className="text-sm leading-7 text-emerald-700">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm leading-7 text-rose-700">
            {error}
          </p>
        )}
        <Link href="/" className="text-sm text-blue-800 underline">
          بازگشت به ورود هدهده
        </Link>
      </section>
    </main>
  );
}
