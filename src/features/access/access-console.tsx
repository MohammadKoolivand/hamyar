"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PagedList } from "@/components/ui/paged-list";
import {
  roleLabels,
  roleSchema,
  staffPermissionLabels,
  type Role,
  type StaffPermission,
} from "@/lib/access";
import type { User } from "@/lib/types";
type Account = User & { disabledAt?: string };
type Grant = {
  _id: string;
  secretaryId: string;
  teacherId: string;
  permissions: StaffPermission[];
};
type Workspace = { _id: string; name: string; permissions: StaffPermission[] };
type Course = { _id: string; title: string; subject: string; enrolled: number };
const style = "glass-field min-h-11 w-full p-3";
export function AccessConsole({
  me,
  onLogout,
}: {
  me: User;
  onLogout: () => void;
}) {
  const admin = me.role === "super_admin";
  const [users, setUsers] = useState<Account[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [secretaryId, setSecretaryId] = useState("");
  const [permissions, setPermissions] = useState<StaffPermission[]>([
    "roster.read",
    "courses.read",
  ]);
  const [roster, setRoster] = useState<Account[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("secretary");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<"student" | "parent">("student");
  const [studentId, setStudentId] = useState("");
  const [token, setToken] = useState("");
  const [audit, setAudit] = useState<
    { _id: string; actorId: string; action: string; createdAt: string }[]
  >([]);
  async function reload() {
    if (admin) {
      const [u, g, a] = await Promise.all([
        api<Account[]>("/admin/users"),
        api<Grant[]>("/admin/staff-assignments"),
        api<typeof audit>("/admin/audit"),
      ]);
      setUsers(u);
      setGrants(g);
      setAudit(a);
    } else setWorkspaces(await api<Workspace[]>("/staff/workspaces"));
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات انجام نشد");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void reload().catch((e) => setError(e.message));
  }, [admin]);
  useEffect(() => {
    let alive = true;
    setRoster([]);
    setCourses([]);
    setToken("");
    if (!admin && teacherId) {
      const workspace = workspaces.find((w) => w._id === teacherId);
      if (workspace?.permissions.includes("roster.read"))
        void api<Account[]>(`/staff/workspaces/${teacherId}/roster`)
          .then((v) => {
            if (alive) setRoster(v);
          })
          .catch((e) => {
            if (alive) setError(e.message);
          });
      if (workspace?.permissions.includes("courses.read"))
        void api<Course[]>(`/staff/workspaces/${teacherId}/courses`)
          .then((v) => {
            if (alive) setCourses(v);
          })
          .catch((e) => {
            if (alive) setError(e.message);
          });
    }
    return () => {
      alive = false;
    };
  }, [teacherId, admin, workspaces]);
  return (
    <main
      dir="rtl"
      className="mx-auto grid max-w-6xl gap-5 p-4 text-[#1F2937] sm:p-8"
    >
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="text-xl font-bold text-[#233B8F]">
            {admin ? "مدیریت سامانه و دسترسی‌ها" : "امور اجرایی"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {me.name} · {roleLabels[me.role]}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void run(reload)}
        >
          به‌روزرسانی
        </Button>
        <Button type="button" variant="outline" onClick={onLogout}>
          خروج
        </Button>
      </header>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="glass-note p-4">
          {notice}
        </p>
      )}
      {admin ? (
        <>
          <section className="glass-panel grid gap-4 p-5">
            <h2 className="font-bold">ساخت حساب کاربر</h2>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api("/admin/users", { name, phone, role });
                  setPhone("");
                  setName("");
                  await reload();
                  setNotice(
                    "حساب ساخته شد؛ صاحب حساب با شماره موبایل و کد تأیید وارد می‌شود.",
                  );
                });
              }}
            >
              <Field title="نام کاربر">
                <input
                  required
                  minLength={2}
                  className={style}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field title="شماره موبایل کاربر">
                <input
                  required
                  type="tel"
                  dir="ltr"
                  className={style}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field title="نقش حساب">
                <select
                  className={style}
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {roleSchema.options.map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Button disabled={busy}>ایجاد حساب</Button>
            </form>
          </section>
          <section className="glass-panel grid gap-4 p-5">
            <h2 className="font-bold">کاربران و سطح دسترسی</h2>
            <Field title="جست‌وجوی کاربران">
              <input
                className={style}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <PagedList
              items={users.filter((u) =>
                `${u.name} ${u.phone ?? "شماره ثبت نشده"} ${roleLabels[u.role]}`.includes(
                  search,
                ),
              )}
              label="کاربران"
            >
              {(u) => (
                <AccountRow
                  key={`${u._id}-${u.role}-${u.disabledAt}`}
                  user={u}
                  disabled={busy || u._id === me._id}
                  save={(role, disabled) =>
                    run(async () => {
                      await api(`/admin/users/${u._id}/access`, {
                        role,
                        disabled,
                      });
                      await reload();
                      setNotice(
                        "دسترسی به‌روزرسانی و نشست‌های قبلی کاربر باطل شدند.",
                      );
                    })
                  }
                />
              )}
            </PagedList>
          </section>
          <section className="glass-panel grid gap-4 p-5">
            <h2 className="font-bold">واگذاری دسترسی محدود به منشی</h2>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api("/admin/staff-assignments", {
                    teacherId,
                    secretaryId,
                    permissions,
                  });
                  await reload();
                  setNotice("دسترسی اجرایی واگذار شد.");
                });
              }}
            >
              <Field title="منشی">
                <select
                  required
                  className={style}
                  value={secretaryId}
                  onChange={(e) => setSecretaryId(e.target.value)}
                >
                  <option value="">انتخاب منشی</option>
                  {users
                    .filter((u) => u.role === "secretary" && !u.disabledAt)
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field title="معلم مسئول">
                <select
                  required
                  className={style}
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                >
                  <option value="">انتخاب معلم</option>
                  {users
                    .filter((u) => u.role === "teacher" && !u.disabledAt)
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </Field>
              {Object.entries(staffPermissionLabels).map(([p, label]) => (
                <label key={p} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p as StaffPermission)}
                    onChange={(e) =>
                      setPermissions((old) =>
                        e.target.checked
                          ? [...old, p as StaffPermission]
                          : old.filter((v) => v !== p),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
              <Button disabled={busy || !permissions.length}>
                ذخیره دسترسی منشی
              </Button>
            </form>
            <PagedList items={grants} label="مجوزهای منشی">
              {(g) => (
                <div key={g._id} className="glass-option grid gap-3 p-4">
                  <p>
                    {users.find((u) => u._id === g.secretaryId)?.name} ←{" "}
                    {users.find((u) => u._id === g.teacherId)?.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {g.permissions
                      .map((p) => staffPermissionLabels[p])
                      .join(" · ")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `/admin/staff-assignments/${g._id}/revoke`,
                          {},
                        );
                        await reload();
                      })
                    }
                  >
                    لغو دسترسی
                  </Button>
                </div>
              )}
            </PagedList>
          </section>
          <section className="glass-panel grid gap-3 p-5">
            <h2 className="font-bold">رویدادهای مدیریتی و امنیتی</h2>
            <PagedList items={audit} label="رویدادها">
              {(a) => (
                <div key={a._id} className="glass-option p-3 text-xs">
                  <p>
                    {(
                      {
                        admin_create_user: "ساخت حساب کاربر",
                        admin_update_access: "تغییر سطح دسترسی",
                        grant_secretary_scope: "واگذاری دسترسی منشی",
                        revoke_secretary_scope: "لغو دسترسی منشی",
                        secretary_create_invitation: "ساخت دعوت توسط منشی",
                        operator_bootstrap_superadmin:
                          "راه‌اندازی نخستین سوپرادمین",
                        register: "ثبت‌نام کاربر",
                        invite: "ایجاد دعوت",
                      } as Record<string, string>
                    )[a.action] ?? "رویداد سامانه"}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer">
                      شناسه فنی رویداد
                    </summary>
                    <code>{a.action}</code>
                  </details>
                  <p className="mt-2 text-slate-500">
                    {users.find((u) => u._id === a.actorId)?.name ?? "کاربر"} ·{" "}
                    {new Date(a.createdAt).toLocaleString("fa-IR")}
                  </p>
                </div>
              )}
            </PagedList>
            <p className="text-xs text-slate-500">
              ۲۰۰ رویداد اخیر؛ پاسخ‌ها، رمزها و متن خصوصی سؤال در این فهرست
              نمایش داده نمی‌شوند.
            </p>
          </section>
        </>
      ) : (
        <>
          <section className="glass-panel grid gap-4 p-5">
            <h2 className="font-bold">حوزه کاری واگذارشده</h2>
            <p className="text-sm leading-7 text-slate-500">
              فقط عملیات اجرایی واگذارشده فعال است؛ ارزیابی، پاسخ مرجع، گزارش
              یادگیری و تنظیمات هوش مصنوعی در دسترس منشی نیست.
            </p>
            <Field title="انتخاب حوزه معلم">
              <select
                className={style}
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              >
                <option value="">انتخاب معلم</option>
                {workspaces.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            {!workspaces.length && (
              <p className="text-sm">
                هنوز دسترسی اجرایی از سوی سوپرادمین واگذار نشده است.
              </p>
            )}
          </section>
          {workspaces
            .find((w) => w._id === teacherId)
            ?.permissions.includes("roster.read") && (
            <section className="glass-panel grid gap-3 p-5">
              <h2 className="font-bold">فهرست دانش‌آموزان</h2>
              <PagedList items={roster} label="دانش‌آموزان حوزه">
                {(u) => (
                  <div key={u._id} className="glass-option p-3">
                    <p>{u.name}</p>
                    <p className="text-xs text-slate-500" dir="ltr">
                      {u.phone ?? "شماره ثبت نشده"}
                    </p>
                  </div>
                )}
              </PagedList>
            </section>
          )}
          {workspaces
            .find((w) => w._id === teacherId)
            ?.permissions.includes("courses.read") && (
            <section className="glass-panel grid gap-3 p-5">
              <h2 className="font-bold">درس‌ها و عضویت‌ها</h2>
              <PagedList items={courses} label="درس‌های حوزه">
                {(c) => (
                  <p key={c._id} className="glass-option p-3 text-sm">
                    {c.title} · {c.subject} ·{" "}
                    {c.enrolled.toLocaleString("fa-IR")} عضو
                  </p>
                )}
              </PagedList>
            </section>
          )}
          {workspaces
            .find((w) => w._id === teacherId)
            ?.permissions.includes("invitations.create") && (
            <section className="glass-panel grid gap-3 p-5">
              <h2 className="font-bold">ایجاد دعوت</h2>
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const result = await api<{ token: string }>(
                      `/staff/workspaces/${teacherId}/invitations`,
                      {
                        phone: invitePhone,
                        role: inviteRole,
                        ...(inviteRole === "parent" ? { studentId } : {}),
                      },
                    );
                    setToken(result.token);
                  });
                }}
              >
                <Field title="شماره موبایل دعوت">
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    autoComplete="tel"
                    placeholder="09123456789"
                    className={style}
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                  />
                </Field>
                <Field title="نوع دعوت">
                  <select
                    className={style}
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "student" | "parent")
                    }
                  >
                    <option value="student">دانش‌آموز</option>
                    {workspaces
                      .find((w) => w._id === teacherId)
                      ?.permissions.includes("roster.read") && (
                      <option value="parent">والدین دانش‌آموز مرتبط</option>
                    )}
                  </select>
                </Field>
                {inviteRole === "parent" && (
                  <Field title="فرزند">
                    <select
                      required
                      className={style}
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                    >
                      <option value="">انتخاب دانش‌آموز</option>
                      {roster.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Button disabled={busy}>ساخت دعوت</Button>
              </form>
              {token && (
                <p
                  className="break-all rounded-xl bg-blue-50 p-3 text-sm"
                  dir="ltr"
                >
                  {location.origin}/?invite={token}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
function AccountRow({
  user,
  disabled,
  save,
}: {
  user: Account;
  disabled: boolean;
  save: (role: Role, disabled: boolean) => Promise<void>;
}) {
  const [role, setRole] = useState(user.role);
  const [blocked, setBlocked] = useState(!!user.disabledAt);
  return (
    <div className="glass-option grid gap-3 p-4 sm:grid-cols-2">
      <div>
        <p className="font-bold">{user.name}</p>
        <p dir="ltr" className="text-xs text-slate-500">
          {user.phone ?? "شماره ثبت نشده"}
        </p>
      </div>
      <Field title={`نقش ${user.name}`}>
        <select
          disabled={disabled}
          className={style}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {roleSchema.options.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          disabled={disabled}
          checked={blocked}
          onChange={(e) => setBlocked(e.target.checked)}
        />
        حساب مسدود
      </label>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => void save(role, blocked)}
      >
        اعمال دسترسی
      </Button>
    </div>
  );
}
