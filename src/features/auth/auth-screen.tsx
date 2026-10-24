"use client";
import React from "react";
import { BookOpen, ShieldCheck, ArrowLeft } from "lucide-react";
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
    <main className="mx-auto my-[7vh] max-w-[1020px] p-6">
      <div className="flex items-center gap-3 text-[23px] font-bold text-[#233b8f]">
        <span className="grid size-[46px] shrink-0 place-items-center rounded-[14px] bg-[#233b8f] text-white">
          <BookOpen />
        </span>
        همیار
      </div>
      <div className="grid items-center gap-11 min-[651px]:grid-cols-2 max-[650px]:gap-[15px]">
        <div className="p-10 leading-[2.5] max-[650px]:p-2 [&_h1]:text-[38px] [&_h1]:leading-[1.7] max-[650px]:[&_h1]:text-[27px]">
          <span className="inline-block rounded-full border border-[#19b7ae33] bg-[#19b7ae14] px-3 py-1.5 text-[11px] text-[#096c67]">
            فضایی برای تمرین آگاهانه
          </span>
          <h1 className="text-[28px] font-bold">
            هر تمرین، یک قدم
            <br />
            به یادگیری مستقل.
          </h1>
          <p className="text-xs leading-loose text-slate-500">
            معلم آموزش می‌دهد، همیار تمرین را همراهی می‌کند.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ShieldCheck color="#19B7AE" />
            <small className="text-xs leading-loose text-slate-500">
              مسیر یادگیری زیر نظر معلم شما
            </small>
          </div>
        </div>
        <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
          <h2 className="text-[19px] font-bold">
            {mode === "login"
              ? "خوش آمدید"
              : mode === "register"
                ? "شروع همراهی به‌عنوان معلم"
                : "پذیرش دعوت دانش‌آموز یا اولیا"}
          </h2>
          <p className="text-xs leading-loose text-slate-500">
            برای ادامه مسیر یادگیری وارد حساب خود شوید.
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
            <Field title="ایمیل">
              <input
                required
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
              {mode === "login" ? "ورود به همیار" : "ساخت حساب"}
              <ArrowLeft size={16} />
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() =>
                setMode(mode === "register" ? "login" : "register")
              }
            >
              {mode === "register" ? "ورود" : "ثبت‌نام معلم"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode(mode === "accept" ? "login" : "accept")}
            >
              {mode === "accept" ? "ورود" : "پذیرش دعوت"}
            </Button>
          </div>
          <small className="text-xs leading-loose text-slate-500">
            نسخه توسعه محلی · همیار آزمایشی با راهنمایی تأییدشده معلم
          </small>
        </section>
      </div>
    </main>
  );
}
