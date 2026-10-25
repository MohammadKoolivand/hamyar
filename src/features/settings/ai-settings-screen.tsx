"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
type Settings = { provider: string; model: string; keyConfigured: boolean };
type Model = { id: string; owner: string };
export function AiSettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<Model[]>([]),
    [model, setModel] = useState("");
  const [owner, setOwner] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function loadModels() {
    setBusy(true);
    setError("");
    try {
      setModels(
        (await api<{ models: Model[] }>("/settings/authoring/models")).models,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    api<Settings>("/settings/authoring")
      .then((s) => {
        setSettings(s);
        setModel(s.model);
      })
      .catch((e) => setError(e.message));
    void loadModels();
  }, []);
  const activeOwner = owner || models.find((m) => m.id === model)?.owner || "";
  const owners = [...new Set(models.map((m) => m.owner))].sort();
  const filtered = models.filter((m) => m.owner === activeOwner);
  return (
    <section className="glass-panel mx-auto grid w-full max-w-3xl gap-6 p-5 sm:p-7">
      <header className="space-y-3 border-b border-slate-200 pb-5">
        <h2 className="text-xl font-bold text-[#233B8F]">تنظیمات هوش مصنوعی</h2>
        <p className="text-sm leading-7 text-slate-600">
          سرویس تولید سؤال و انتخاب راهنمای تمرین AvvalAI است. مدل دلخواه را
          انتخاب کنید؛ انتخاب شما برای حساب خودتان ذخیره می‌شود و روی
          پیش‌نویس‌های بعدی اثر دارد.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800"
        >
          {notice}
        </p>
      )}
      {settings && (
        <p
          className={`rounded-xl p-4 text-sm leading-7 ${settings.keyConfigured ? "bg-slate-50 text-slate-600" : "bg-amber-50 text-amber-900"}`}
        >
          {settings.keyConfigured
            ? "کلید AvvalAI روی سرور تنظیم شده است؛ دسترسی به مدل و اعتبار حساب هنگام تولید بررسی می‌شود."
            : "کلید AvvalAI هنوز روی سرور تنظیم نشده است. می‌توانید مدل را ذخیره کنید؛ تولید سؤال پس از تنظیم کلید فعال می‌شود."}
        </p>
      )}
      <form
        className="grid gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setNotice("");
          try {
            const saved = await api<Settings>("/settings/authoring", { model });
            setSettings(saved);
            setNotice("مدل تولید سؤال و راهنمای تمرین ذخیره شد.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field title="ارائه‌دهنده مدل AvvalAI">
          <select
            className="glass-field min-h-11 w-full p-3"
            value={activeOwner}
            disabled={busy || !models.length}
            onChange={(e) => {
              setOwner(e.target.value);
              setModel("");
              setNotice("");
            }}
          >
            <option value="">۱. انتخاب ارائه‌دهنده</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field title="مدل تولید سؤال و راهنمای AvvalAI">
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setNotice("");
            }}
            disabled={busy || !models.length || !activeOwner}
            className="glass-field min-h-11 w-full p-3"
            dir="ltr"
            required
          >
            <option value="">۲. انتخاب مدل</option>
            {model && !filtered.some((m) => m.id === model) && (
              <option value={model}>
                {model}
                {models.some((m) => m.id === model)
                  ? ""
                  : " — خارج از فهرست فعلی"}
              </option>
            )}
            {filtered.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} · {m.owner}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs leading-6 text-slate-500">
          فهرست مدل‌های متنی از API رسمی AvvalAI دریافت می‌شود. هزینه و دسترسی
          مدل‌ها تابع حساب AvvalAI است. صحت سؤال و پاسخ همچنان باید توسط معلم
          تأیید شود.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || !settings || !models.some((m) => m.id === model)}
          >
            {busy ? "در حال انجام…" : "ذخیره مدل هوش مصنوعی"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void loadModels()}
          >
            دریافت دوباره مدل‌ها
          </Button>
        </div>
      </form>
      <a
        href="/content"
        className="text-sm text-[#233B8F] underline underline-offset-4"
      >
        بازگشت به بانک سؤال و محتوا
      </a>
    </section>
  );
}
