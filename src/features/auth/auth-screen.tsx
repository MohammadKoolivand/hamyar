"use client";
import React from "react";
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
            {mode === "login"
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
          <form onSubmit={auth} className="grid gap-[18px]">
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
          </form>
          <div className="flex flex-wrap items-center gap-3">
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
          </div>
          <small className="text-xs leading-loose text-slate-500">
            نسخه توسعه محلی · هدهد آزمایشی با راهنمایی تأییدشده معلم
          </small>
        </section>
      </div>
    </main>
  );
}
