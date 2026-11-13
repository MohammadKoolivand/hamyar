"use client";
import { useEffect, useState } from "react";
import { Pencil, Plus, SlidersHorizontal, Archive } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PagedList } from "@/components/ui/paged-list";
import { taxonomyKeys } from "@/lib/public-bank";
import {
  type DiscoveryKey,
  type DiscoveryOption,
  type DiscoverySettings,
} from "@/lib/discovery-settings";

const style =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";
const blank = (): Omit<DiscoveryOption, "id"> & { id?: string } => ({
  value: "",
  label: "",
  parents: {},
  order: 0,
  active: true,
});
export function DiscoveryFiltersEditor() {
  const [settings, setSettings] = useState<DiscoverySettings | null>(null),
    [key, setKey] = useState<DiscoveryKey>("level");
  const [option, setOption] = useState(blank),
    [title, setTitle] = useState(""),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    api<DiscoverySettings>("/admin/discovery-filters")
      .then(setSettings)
      .catch((error) => setError((error as Error).message));
  }, []);
  const field = settings?.fields.find((field) => field.key === key);
  async function save(body: object) {
    if (!settings) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await api<DiscoverySettings>("/admin/discovery-filters", {
        revision: settings.revision,
        key,
        ...body,
      });
      setSettings(next);
      setOption(blank());
      setNotice("تنظیمات ذخیره شد؛ در صفحه‌ی عمومی با تازه‌سازی دیده می‌شود.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const choices = (field?.options ?? []).filter((option) =>
    `${option.label} ${Object.values(option.parents).join(" ")}`.includes(
      query,
    ),
  );
  return (
    <details
      className="rounded-2xl border border-slate-200 bg-white p-5"
      onToggle={(e) => {
        if (e.currentTarget.open && field) setTitle(field.label);
      }}
    >
      <summary className="flex cursor-pointer items-center gap-2 font-bold text-slate-700">
        <SlidersHorizontal size={19} />
        مدیریت فیلترهای صفحه‌ی عمومی
      </summary>
      <div className="mt-5 grid gap-5">
        <p className="text-sm leading-7 text-slate-500">
          مقطع، پایه، درس، فصل، مبحث، نوع آزمون و سختی در دیتابیس نگهداری
          می‌شوند. تغییر عنوان نمایشی، ارتباط سؤال‌ها را تغییر نمی‌دهد. حذف
          گزینه، غیرفعال‌سازی قابل بازگشت است.
        </p>
        {error && (
          <p role="alert" className="text-rose-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-emerald-700">
            {notice}
          </p>
        )}
        <label>
          فیلتر
          <select
            className={style}
            value={key}
            onChange={(e) => {
              const next = e.target.value as DiscoveryKey;
              setKey(next);
              setTitle(
                settings?.fields.find((field) => field.key === next)?.label ??
                  "",
              );
              setOption(blank());
              setQuery("");
            }}
          >
            {settings?.fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </label>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ action: "label", label: title });
          }}
        >
          <label className="grow">
            عنوان فیلتر
            <input
              className={style}
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <Button disabled={busy || !title}>ذخیره‌ی عنوان</Button>
        </form>
        <form
          className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ action: "save", option });
          }}
        >
          <label>
            مقدار اصلی
            <input
              className={style}
              required
              maxLength={200}
              disabled={!!option.id}
              value={option.value}
              onChange={(e) =>
                setOption({
                  ...option,
                  value: e.target.value,
                  label:
                    !option.label || option.label === option.value
                      ? e.target.value
                      : option.label,
                })
              }
            />
          </label>
          <label>
            عنوان نمایشی
            <input
              className={style}
              required
              maxLength={200}
              value={option.label}
              onChange={(e) => setOption({ ...option, label: e.target.value })}
            />
          </label>
          {!option.id &&
            taxonomyKeys
              .slice(
                0,
                taxonomyKeys.indexOf(key as (typeof taxonomyKeys)[number]),
              )
              .filter(() => key !== "category" && key !== "difficulty")
              .map((parent) => (
                <label key={parent}>
                  {
                    settings?.fields.find((field) => field.key === parent)
                      ?.label
                  }
                  <select
                    className={style}
                    value={option.parents[parent] ?? ""}
                    onChange={(e) => {
                      const parents = { ...option.parents };
                      if (e.target.value) parents[parent] = e.target.value;
                      else delete parents[parent];
                      setOption({ ...option, parents });
                    }}
                  >
                    <option value="">بدون محدودیت</option>
                    {[
                      ...new Map(
                        (
                          settings?.fields.find((field) => field.key === parent)
                            ?.options ?? []
                        )
                          .filter((candidate) => candidate.active)
                          .map((candidate) => [candidate.value, candidate]),
                      ).values(),
                    ].map((candidate) => (
                      <option key={candidate.id} value={candidate.value}>
                        {candidate.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
          <label>
            ترتیب نمایش
            <input
              type="number"
              min={0}
              max={100000}
              className={style}
              value={option.order}
              onChange={(e) =>
                setOption({ ...option, order: Number(e.target.value) })
              }
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={option.active}
              onChange={(e) =>
                setOption({ ...option, active: e.target.checked })
              }
            />
            فعال
          </label>
          <Button disabled={busy || !settings}>
            <Plus size={16} />
            {option.id ? "ذخیره‌ی گزینه" : "افزودن گزینه"}
          </Button>
          {option.id && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setOption(blank())}
            >
              گزینه‌ی جدید
            </Button>
          )}
        </form>
        <label>
          جست‌وجوی گزینه‌ها
          <input
            className={style}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <PagedList items={choices} label="گزینه‌های فیلتر">
          {(item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <span className="text-sm">
                  {item.label}
                  {!item.active && " · غیرفعال"}
                </span>
                <p className="mt-1 text-xs text-slate-400">
                  {Object.values(item.parents).join(" / ")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOption({ ...item })}
                  aria-label={`ویرایش ${item.label}`}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !item.active}
                  onClick={() => void save({ action: "archive", id: item.id })}
                  aria-label={`غیرفعال‌کردن ${item.label}`}
                >
                  <Archive size={15} />
                </Button>
              </div>
            </div>
          )}
        </PagedList>
      </div>
    </details>
  );
}
