"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const fieldClass = "glass-field w-full min-w-0 rounded-xl p-3 text-sm";
export function JsonDraftImport() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function importJson() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("ساختار فایل JSON معتبر نیست.");
      }
      if (!payload || typeof payload !== "object" ||
          !("questions" in payload) || !Array.isArray(payload.questions) ||
          payload.questions.length < 1 || payload.questions.length > 100)
        throw new Error("JSON باید شامل آرایه questions با ۱ تا ۱۰۰ سؤال باشد.");
      const result = await api<{ imported: number }>("/question-drafts/import-json", payload);
      setNotice(`${result.imported} سؤال در پیش‌نویس‌ها ثبت شد؛ برای انتشار نیاز به بازبینی دارد.`);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="ورود JSON به پیش‌نویس‌ها">
      <h3 className="font-bold text-[#17305e]">ورود JSON به پیش‌نویس‌ها</h3>
      <p className="text-sm leading-7 text-slate-600">
        فایل استخراج‌شده از PDF سؤال و پاسخ را بارگذاری کنید یا JSON را بچسبانید.
        برای سؤال مبحثی، topicId باید شناسه معتبر مبحث شما باشد. بدون مبحث،
        classification را free بگذارید. در تستی، reference باید متن گزینه صحیح باشد.
        سؤال‌ها فقط در پیش‌نویس‌ها ذخیره می‌شوند و خودکار منتشر نمی‌شوند.
      </p>
      <label className="grid gap-1 text-sm font-medium">
        انتخاب فایل JSON
        <input type="file" accept=".json,application/json" disabled={busy}
          className={fieldClass}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 1024 * 1024) {
              setError("حجم فایل نباید بیش از یک مگابایت باشد.");
              return;
            }
            void file.text().then((value) => {
              setText(value);
              setError("");
            }).catch(() => setError("خواندن فایل انجام نشد."));
          }}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        متن JSON
        <textarea dir="ltr" rows={7} className={fieldClass} disabled={busy}
          value={text} onChange={(event) => setText(event.target.value)}
          placeholder={'{"questions":[{"classification":"free","statement":"صورت سؤال","type":"choice","options":["الف","ب"],"reference":"الف","hints":[],"skillIds":[]}]}'}
        />
      </label>
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="text-sm text-teal-800">{notice}</p>}
      <Button type="button" disabled={busy || !text.trim()} onClick={() => void importJson()}>
        {busy ? "در حال ثبت…" : "ورود JSON به پیش‌نویس‌ها"}
      </Button>
    </section>
  );
}
