"use client";
import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { GraduationCap, Sparkles, ShieldCheck, ArrowLeft } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
export function AuthScreen({
  mode,
  name,
  email,
  password,
  token,
  busy,
  feedback,
  auth,
  setMode,
  setName,
  setEmail,
  setPassword,
  setToken,
}: {
  mode: string;
  name: string;
  email: string;
  password: string;
  token: string;
  busy: boolean;
  feedback: React.ReactNode;
  auth: (e: React.FormEvent) => void;
  setMode: (value: string) => void;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setToken: (value: string) => void;
}) {

  const [resetFlow, setResetFlow] = useState<"none" | "request" | "confirm">("none");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetInfo, setResetInfo] = useState("");
  const [resetError, setResetError] = useState("");

  // URL fragments are not transmitted in HTTP requests or referrer headers.
  useEffect(() => {
    const match = /^#reset=([a-f0-9]{64})$/.exec(window.location.hash);
    if (match) {
      setResetToken(match[1]);
      setResetFlow("confirm");
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
  }, []);

  async function resetSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (resetBusy) return;
    setResetBusy(true);
    setResetError("");
    setResetInfo("");
    try {
      if (resetFlow === "request") {
        const result = await api<{ message: string }>("/auth/password-reset/request", {
          email: resetEmail,
        });
        setResetInfo(result.message);
      } else {
        if (newPassword !== confirmPassword) {
          setResetError("تکرار رمز عبور با رمز جدید یکسان نیست.");
          return;
        }
        const result = await api<{ message: string }>("/auth/password-reset/confirm", {
          token: resetToken, password: newPassword,
        });
        setResetToken("");
        setNewPassword("");
        setConfirmPassword("");
        setPassword("");
        setResetFlow("none");
        setResetInfo(result.message);
      }
    } catch (e) {
      setResetError((e as Error).message);
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <main className="mx-auto my-[5vh] max-w-[1120px] p-5 sm:p-8">
      <div className="mb-7">
        <Brand size="lg" showTagline />
      </div>
      <div className="grid items-stretch gap-6 min-[751px]:grid-cols-[1.05fr_1fr] max-[750px]:gap-5">
        <div className="glass-hero flex min-w-0 flex-col justify-center gap-4 p-8 leading-[2.2] sm:p-11 [&_h1]:text-[37px] [&_h1]:leading-[1.7] max-[650px]:[&_h1]:text-[27px]">
          <span className="glass-kicker inline-block w-fit px-4 py-1.5 text-xs">
            فضایی برای تمرین آگاهانه
          </span>
          <h1 className="font-bold text-[#17305E]">
            هر تمرین، یک قدم
            <br />
            به یادگیری مستقل.
          </h1>
          <p className="text-xs leading-loose text-slate-500">
            معلم آموزش می‌دهد، هدهد تمرین را همراهی می‌کند.
          </p>
          <div className="flex items-center gap-3">
            <span className="hy-icon-container" data-tone="teal">
              <ShieldCheck size={22} aria-hidden />
            </span>
            <small className="text-xs leading-loose text-slate-500">
              مسیر یادگیری زیر نظر معلم شما
            </small>
          </div>
          <div className="mt-3 flex items-center gap-3" aria-hidden>
            <span className="hy-icon-container !size-14" data-tone="purple">
              <GraduationCap size={29} />
            </span>
            <span className="hy-icon-container !size-14" data-tone="gold">
              <Sparkles size={27} />
            </span>
          </div>
        </div>
        <section className="glass-panel min-w-0 p-7 max-[650px]:p-5 grid gap-[18px]">
          <h2 className="text-[19px] font-bold">
            {resetFlow === "request"
              ? "بازیابی رمز عبور"
              : resetFlow === "confirm"
                ? "انتخاب رمز جدید"
                : mode === "login"
                  ? "خوش آمدید"
              : mode === "register"
                ? "ساخت حساب معلم"
                : mode === "register-student"
                  ? "ساخت حساب دانش‌آموز"
                  : "پذیرش دعوت دانش‌آموز یا اولیا"}
          </h2>
          <p className="text-xs leading-loose text-slate-500">
            {mode === "register-student"
              ? "برای ساخت حساب نیازی به کد دعوت معلم نیست. بعداً از پنل خودتان می‌توانید به معلم متصل شوید."
              : mode === "accept"
                ? "با کد دعوت می‌توانید یک حساب جدید بسازید یا حساب موجود را با همان رمز به معلم متصل کنید."
                : "برای ادامه مسیر یادگیری وارد حساب خود شوید."}
          </p>
          {feedback}
          {resetFlow === "none" && <form onSubmit={auth} className="grid gap-[18px]">
            {mode !== "login" && (
              <Field title="نام و نام خانوادگی">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full min-h-[46px] glass-field p-3"
                />
              </Field>
            )}
            <Field
              title={
                mode === "accept"
                  ? "شماره موبایل دعوت‌شده"
                  : mode === "login"
                    ? "ایمیل یا شماره موبایل"
                    : "ایمیل یا شماره موبایل"
              }
            >
              <input
                required
                type={mode === "accept" ? "tel" : "text"}
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete={mode === "accept" ? "tel" : "username"}
                className="w-full min-h-[46px] glass-field p-3"
              />
            </Field>
            <Field title="رمز عبور (حداقل ۱۰ کاراکتر)">
              <input
                required
                type="password"
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className="w-full min-h-[46px] glass-field p-3"
              />
            </Field>
            {mode === "accept" && (
              <Field title="کد دعوت معلم">
                <input
                  required
                  dir="ltr"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full min-h-[46px] glass-field p-3"
                />
              </Field>
            )}
            <Button disabled={busy}>
              {mode === "login" ? "ورود به هدهد" : "ساخت حساب"}
              <ArrowLeft size={16} />
            </Button>
          </form>}
          {resetFlow !== "none" && (
            <form onSubmit={(event) => void resetSubmit(event)} className="grid gap-[18px]">
              {resetFlow === "request" ? (
                <>
                  <p className="text-sm leading-7 text-slate-600">
                    ایمیل ثبت‌شده حساب را وارد کنید. برای حساب‌هایی که فقط شماره موبایل دارند،
                    بازیابی ایمیلی تا زمان ثبت ایمیل امکان‌پذیر نیست.
                  </p>
                  <Field title="ایمیل حساب">
                    <input required type="email" dir="ltr" autoComplete="email"
                      value={resetEmail} onChange={(event) => setResetEmail(event.target.value)}
                      className="w-full min-h-[46px] glass-field p-3" />
                  </Field>
                </>
              ) : (
                <>
                  <Field title="رمز جدید (حداقل ۱۰ کاراکتر)">
                    <input required type="password" minLength={10} maxLength={128}
                      autoComplete="new-password" value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="w-full min-h-[46px] glass-field p-3" />
                  </Field>
                  <Field title="تکرار رمز جدید">
                    <input required type="password" minLength={10} maxLength={128}
                      autoComplete="new-password" value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="w-full min-h-[46px] glass-field p-3" />
                  </Field>
                </>
              )}
              {resetInfo && <p role="status" className="glass-note p-3 text-sm leading-7">{resetInfo}</p>}
              {resetError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{resetError}</p>}
              <Button disabled={resetBusy}>
                {resetBusy ? "لطفاً صبر کنید…" : resetFlow === "request" ? "ارسال لینک بازیابی" : "ذخیره رمز جدید"}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setResetFlow("none"); setResetToken(""); setResetError(""); setResetInfo("");
              }}>بازگشت به ورود</Button>
            </form>
          )}
          {resetFlow === "none" && mode === "login" && (
            <button type="button" onClick={() => {
              setResetEmail(email.includes("@") ? email : "");
              setResetInfo(""); setResetError(""); setResetFlow("request");
            }} className="w-fit text-sm font-medium text-[#17305E] underline-offset-4 hover:underline">
              رمز عبور را فراموش کرده‌اید؟
            </button>
          )}
          {resetFlow === "none" && <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setMode(mode === "register" ? "login" : "register")
              }
            >
              {mode === "register" ? "بازگشت به ورود" : "ثبت‌نام معلم"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setMode(
                  mode === "register-student" ? "login" : "register-student",
                )
              }
            >
              {mode === "register-student"
                ? "بازگشت به ورود"
                : "ثبت‌نام دانش‌آموز"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode(mode === "accept" ? "login" : "accept")}
            >
              {mode === "accept" ? "بازگشت به ورود" : "پذیرش دعوت"}
            </Button>
          </div>}
          <small className="text-xs leading-loose text-slate-500">
            نسخه توسعه محلی · هدهد آزمایشی با راهنمایی تأییدشده معلم
          </small>
        </section>
      </div>
    </main>
  );
}
