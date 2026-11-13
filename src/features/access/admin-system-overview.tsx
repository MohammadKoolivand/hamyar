"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, BookOpenText, Database, GraduationCap, HardDrive,
  Layers3, RefreshCw, Search, ShieldCheck, Users, UsersRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { roleLabels, roleSchema, type Role } from "@/lib/access";
import {
  formatStorageBytes, questionTypeLabels, visibilityLabels,
  type AdminSystemOverview, type AdminUserPage,
} from "@/lib/admin-overview";

const number = (value: number) => value.toLocaleString("fa-IR");
const date = (value: string) => new Date(value).toLocaleString("fa-IR", {
  year: "numeric", month: "short", day: "numeric",
  hour: "2-digit", minute: "2-digit",
});

function MetricTile({
  label, value, sub, icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Users;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-3 break-words text-2xl font-bold tabular-nums text-[#17305E]">{value}</p>
        <p className="mt-2 text-xs leading-6 text-slate-500">{sub}</p>
      </div>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#ebf2ff] text-[#3155a4]">
        <Icon size={21} aria-hidden />
      </span>
    </div>
  );
}

function Breakdown({
  title, values,
}: {
  title: string;
  values: { name: string; count: number }[];
}) {
  const max = Math.max(1, ...values.map((item) => item.count));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-5 font-bold text-[#17305E]">{title}</h3>
      {values.length === 0 ? (
        <p className="text-sm text-slate-500">هنوز داده‌ای ثبت نشده است.</p>
      ) : (
        <div className="grid gap-4">
          {values.map((item) => (
            <div key={item.name} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{item.name}</span>
                <span className="font-bold tabular-nums text-[#24488f]">{number(item.count)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div
                  className="h-full rounded-full bg-[#4b79bb]"
                  style={{ width: String((item.count / max) * 100) + "%" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminSystemOverviewScreen() {
  const [summary, setSummary] = useState<AdminSystemOverview | null>(null);
  const [userPage, setUserPage] = useState<AdminUserPage | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [userError, setUserError] = useState("");
  const [summaryBusy, setSummaryBusy] = useState(true);
  const [usersBusy, setUsersBusy] = useState(true);
  const [reload, setReload] = useState(0);
  const [role, setRole] = useState<Role | "all">("all");
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [collectionSearch, setCollectionSearch] = useState("");

  useEffect(() => {
    let active = true;
    void api<AdminSystemOverview>("/admin/system-overview")
      .then((value) => {
        if (active) { setSummary(value); setSummaryError(""); }
      })
      .catch((err: unknown) => {
        if (active) setSummaryError(err instanceof Error ? err.message : "دریافت آمار انجام نشد");
      })
      .finally(() => { if (active) setSummaryBusy(false); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page) });
    if (role !== "all") params.set("role", role);
    if (search) params.set("q", search);
    void api<AdminUserPage>("/admin/system-overview/users?" + params.toString())
      .then((value) => {
        if (active) { setUserPage(value); setUserError(""); }
      })
      .catch((err: unknown) => {
        if (active) setUserError(err instanceof Error ? err.message : "دریافت فهرست انجام نشد");
      })
      .finally(() => { if (active) setUsersBusy(false); });
    return () => { active = false; };
  }, [reload, role, search, page]);

  const visibleCollections = useMemo(() => {
    const q = collectionSearch.trim().toLowerCase();
    return (summary?.collections ?? [])
      .filter((item) => !q || item.name.toLowerCase().includes(q))
      .sort((a, b) =>
        (b.storageBytes ?? b.dataBytes ?? -1) - (a.storageBytes ?? a.dataBytes ?? -1)
        || a.name.localeCompare(b.name),
      );
  }, [summary, collectionSearch]);

  const refreshAll = () => {
    setSummaryBusy(true);
    setUsersBusy(true);
    setReload((value) => value + 1);
  };
  const changeRole = (value: Role | "all") => {
    setRole(value);
    setPage(1);
    setUsersBusy(true);
  };
  const roleName = (value: string) => roleLabels[value as Role] ?? value;

  return (
    <div className="grid min-w-0 gap-6" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-blue-100 bg-gradient-to-l from-[#edf4ff] via-white to-[#f9fcff] p-6 shadow-sm">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-blue-700">
            <ShieldCheck size={16} aria-hidden />
            فقط برای سوپرادمین
          </div>
          <h2 className="text-2xl font-bold text-[#17305E]">مرکز پایش و آمار سامانه</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            آمار واقعی کاربران، معلم‌ها، بانک سؤال و ساختار MongoDB؛ فقط برای مشاهده، بدون امکان حذف داده.
          </p>
          {summary && (
            <p className="mt-2 text-xs text-slate-500">
              آخرین دریافت: {date(summary.generatedAt)}
            </p>
          )}
        </div>
        <Button type="button" variant="outline" onClick={refreshAll}
          disabled={summaryBusy || usersBusy}>
          <RefreshCw size={17} className={summaryBusy ? "animate-spin" : ""} aria-hidden />
          به‌روزرسانی آمار
        </Button>
      </header>

      {summaryError && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {summaryError}
        </div>
      )}
      {!summary && summaryBusy && (
        <p role="status" className="rounded-2xl bg-white p-6 text-slate-600">در حال دریافت آمار سامانه…</p>
      )}

      {summary && (
        <>
          <section aria-label="شاخص‌های اصلی" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="کل کاربران" value={number(summary.totals.users)}
              sub={number(summary.totals.activeUsers) + " حساب فعال"} icon={Users} />
            <MetricTile label="معلم‌ها" value={number(summary.totals.teachers)}
              sub="حساب‌های دارای نقش معلم" icon={GraduationCap} />
            <MetricTile label="سؤال‌های فعلی" value={number(summary.totals.questions)}
              sub={number(summary.totals.questionVersions) + " نسخه شامل تاریخچه ویرایش"} icon={BookOpenText} />
            <MetricTile label="کالکشن‌های دیتابیس" value={number(summary.database.collections)}
              sub="کالکشن‌های قابل مشاهده در این دیتابیس" icon={Layers3} />
            <MetricTile label="دانش‌آموزان" value={number(summary.totals.students)}
              sub={number(summary.totals.parents) + " حساب والدین"} icon={UsersRound} />
            <MetricTile label="سؤال عمومی تأییدشده" value={number(summary.totals.verifiedPublicQuestions)}
              sub="نسخه فعلی و قابل انتشار" icon={Activity} />
            <MetricTile label="درس‌ها و مأموریت‌ها"
              value={number(summary.totals.courses) + " / " + number(summary.totals.assignments)}
              sub="به‌ترتیب تعداد درس‌ها و تکلیف‌ها" icon={BookOpenText} />
            <MetricTile label="حجم ذخیره‌سازی دیتابیس"
              value={formatStorageBytes(summary.database.storageBytes)}
              sub="بدون فضای ایندکس‌ها؛ نه کل دیسک سرور" icon={HardDrive} />
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Breakdown
              title="کاربران به تفکیک نقش"
              values={summary.roles.map((item) => ({ name: roleName(item.role), count: item.count }))}
            />
            <Breakdown title="سؤال‌ها به تفکیک نوع"
              values={summary.questionTypes.map((item) => ({
                name: questionTypeLabels[item.key] ?? item.key, count: item.count,
              }))} />
            <Breakdown title="وضعیت انتشار سؤال‌ها"
              values={summary.questionVisibility.map((item) => ({
                name: visibilityLabels[item.key] ?? item.key, count: item.count,
              }))} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database size={20} className="text-blue-600" aria-hidden />
                <h3 className="font-bold text-[#17305E]">وضعیت دیتابیس</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600" dir="ltr">
                {summary.database.name}
              </span>
            </div>
            <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-slate-500">اندازه منطقی داده‌ها</p><p className="mt-2 font-bold text-slate-800">{formatStorageBytes(summary.database.dataBytes)}</p></div>
              <div><p className="text-slate-500">فضای ذخیره‌سازی</p><p className="mt-2 font-bold text-slate-800">{formatStorageBytes(summary.database.storageBytes)}</p></div>
              <div><p className="text-slate-500">ایندکس‌ها</p><p className="mt-2 font-bold text-slate-800">{formatStorageBytes(summary.database.indexBytes)}</p></div>
              <div><p className="text-slate-500">اسناد تخمینی کل</p><p className="mt-2 font-bold text-slate-800">{summary.database.documents === null ? "در دسترس نیست" : number(summary.database.documents)}</p></div>
            </div>
            {!summary.database.available && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900" role="note">
                دسترسی خواندن آمار حجم MongoDB برای حساب برنامه محدود است؛ مقادیر حدسی نمایش داده نمی‌شوند.
              </p>
            )}
            <p className="mt-4 text-xs leading-6 text-slate-500">
              این اندازه‌ها فقط به دیتابیس متصل مربوط‌اند و شامل فایل‌های نسخه‌های سایت، بکاپ‌ها و فضای آزاد دیسک سرور نیستند.
            </p>
          </section>
        </>
      )}

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-[#17305E]">فهرست کاربران و معلم‌ها</h3>
            <p className="mt-1 text-xs text-slate-500">جست‌وجو، تفکیک نقش و صفحه‌بندی؛ بدون نمایش رمز یا اطلاعات محرمانه حساب</p>
          </div>
          <span className="text-sm text-slate-500">{userPage ? number(userPage.total) + " نتیجه" : "—"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={role === "all" ? "default" : "outline"} onClick={() => changeRole("all")}>
            همه کاربران
          </Button>
          <Button type="button" variant={role === "teacher" ? "default" : "outline"} onClick={() => changeRole("teacher")}>
            فقط معلم‌ها
          </Button>
          <select
            className="glass-field min-h-11 rounded-xl px-3 text-sm"
            aria-label="فیلتر نقش کاربران"
            value={role}
            onChange={(event) => changeRole(event.target.value as Role | "all")}
          >
            <option value="all">تمام نقش‌ها</option>
            {roleSchema.options.map((value) => <option key={value} value={value}>{roleName(value)}</option>)}
          </select>
        </div>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => {
          event.preventDefault();
          setSearch(draftSearch.trim());
          setPage(1);
          setUsersBusy(true);
        }}>
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">جست‌وجوی نام، ایمیل یا شماره تماس</span>
            <Search size={18} className="pointer-events-none absolute right-3 top-3.5 text-slate-400" aria-hidden />
            <input className="glass-field min-h-11 w-full rounded-xl py-2 pl-3 pr-10 text-sm"
              type="search" maxLength={60} placeholder="جست‌وجوی نام، ایمیل یا شماره تماس"
              value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} />
          </label>
          <Button type="submit" variant="outline">جست‌وجو</Button>
          {search && <Button type="button" variant="outline" onClick={() => {
            setDraftSearch(""); setSearch(""); setPage(1); setUsersBusy(true);
          }}>پاک‌کردن</Button>}
        </form>
        {userError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{userError}</p>}
        {usersBusy && <p role="status" className="text-sm text-slate-500">در حال دریافت فهرست…</p>}
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-right text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr><th scope="col" className="p-3">نام</th><th scope="col" className="p-3">نقش</th><th scope="col" className="p-3">راه ارتباطی</th><th scope="col" className="p-3">وضعیت</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userPage?.items.map((user) => (
                <tr key={user._id}>
                  <td className="p-3 font-medium text-[#17305E]">{user.name}</td>
                  <td className="p-3">{roleName(user.role)}</td>
                  <td className="p-3 text-slate-600" dir="ltr">{user.phone ?? user.email ?? "ثبت نشده"}</td>
                  <td className="p-3">
                    <span className={"rounded-full px-2 py-1 text-xs " + (user.disabledAt ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
                      {user.disabledAt ? "غیرفعال" : "فعال"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {userPage && userPage.items.length === 0 && !usersBusy && (
            <p className="py-6 text-center text-sm text-slate-500">کاربری با این فیلتر پیدا نشد.</p>
          )}
        </div>
        {userPage && userPage.totalPages > 1 && (
          <nav aria-label="صفحه‌بندی کاربران" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
            <span>صفحه {number(userPage.page)} از {number(userPage.totalPages)}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={usersBusy || userPage.page <= 1}
                onClick={() => { setPage((value) => value - 1); setUsersBusy(true); }}>
                قبلی
              </Button>
              <Button type="button" variant="outline" disabled={usersBusy || userPage.page >= userPage.totalPages}
                onClick={() => { setPage((value) => value + 1); setUsersBusy(true); }}>
                بعدی
              </Button>
            </div>
          </nav>
        )}
      </section>

      {summary && (
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-[#17305E]">تمام کالکشن‌های MongoDB</h3>
              <p className="mt-1 text-xs text-slate-500">
                نام، تعداد سند و حجم داده / فضای ذخیره / ایندکس‌ها. شمارش اسناد ممکن است تخمینی باشد.
              </p>
            </div>
            <label className="flex items-center gap-2">
              <span className="sr-only">جست‌وجوی کالکشن</span>
              <input type="search" className="glass-field min-h-11 w-56 max-w-full rounded-xl px-3 text-sm"
                placeholder="نام کالکشن…" value={collectionSearch}
                onChange={(event) => setCollectionSearch(event.target.value)} />
            </label>
          </div>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse text-right text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3" scope="col">کالکشن</th>
                  <th className="p-3" scope="col">تعداد سند</th>
                  <th className="p-3" scope="col">حجم داده</th>
                  <th className="p-3" scope="col">فضای ذخیره</th>
                  <th className="p-3" scope="col">ایندکس‌ها</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleCollections.map((item) => (
                  <tr key={item.name}>
                    <td dir="ltr" className="p-3 text-left font-mono text-xs font-semibold text-[#17305E]">{item.name}</td>
                    <td className="p-3 tabular-nums">{item.documents === null ? "—" : number(item.documents)}</td>
                    <td className="p-3">{formatStorageBytes(item.dataBytes)}</td>
                    <td className="p-3">{formatStorageBytes(item.storageBytes)}</td>
                    <td className="p-3">{formatStorageBytes(item.indexBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleCollections.length && <p className="py-6 text-center text-sm text-slate-500">کالکشنی با این نام پیدا نشد.</p>}
          </div>
          <p className="text-xs leading-6 text-slate-500">
            فهرست براساس فضای ذخیره‌سازی مرتب شده است. دسترسی این صفحه صرفاً خواندنی است و هیچ محتوای رکورد، رمز یا کلید امنیتی نمایش داده نمی‌شود.
          </p>
        </section>
      )}
    </div>
  );
}
