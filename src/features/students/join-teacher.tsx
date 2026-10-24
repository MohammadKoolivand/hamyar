"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Link2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function StudentJoinTeacher({
  invitationToken,
  onJoined,
}: {
  invitationToken?: string;
  onJoined: () => Promise<void>;
}) {
  const [token, setToken] = useState(invitationToken ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setToken(invitationToken ?? "");
  }, [invitationToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/invitations/claim", { token: token.trim() });
      setNotice("اتصال به معلم انجام شد. مأموریت‌های جدید پس از انتشار معلم نمایش داده می‌شوند.");
      setToken("");
      await onJoined();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="join-teacher" className="glass-panel grid gap-4 p-6 max-[650px]:p-5">
      <div className="flex items-center gap-3">
        <Link2 size={21} color="#2ec8c3" aria-hidden />
        <h2 className="text-lg font-bold">اتصال به معلم</h2>
      </div>
      <p className="text-sm leading-loose text-slate-600">
        حساب شما مستقل است. برای دریافت مأموریت‌های یک معلم، از او لینک یا کد دعوت مخصوص ایمیل همین حساب را بگیرید. اتصال به معلم حساب جدیدی ایجاد نمی‌کند.
      </p>
      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={(e) => void submit(e)}>
        <Field title="کد دعوت معلم">
          <input
            autoComplete="off"
            className="glass-field min-h-[46px] w-full p-3"
            dir="ltr"
            maxLength={100}
            minLength={20}
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="کد دعوت را وارد کنید"
          />
        </Field>
        <Button disabled={busy || !token.trim()} type="submit">
          {busy ? "در حال بررسی..." : "اتصال به معلم"}
        </Button>
      </form>
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    </section>
  );
}
