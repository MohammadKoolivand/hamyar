"use client";
import { PagedList } from "@/components/ui/paged-list";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
export function ParentInvitation({ studentId }: { studentId: string }) {
  const [email, setEmail] = useState(""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [parents, setParents] = useState<
      { _id: string; name: string; email?: string; phone?: string }[]
    >([]);
  const refresh = () =>
    api<typeof parents>(`/students/${studentId}/parents`).then(setParents);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [studentId]); // selected student owns this component
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="grid gap-3 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer font-medium">دسترسی اولیا</summary>
      <p className="my-3 text-xs leading-loose text-slate-500">
        هویت و اختیار سرپرست را خارج از برنامه احراز کنید. این دعوت صرفاً اتصال
        فنی حساب است و جایگزین رضایت قانونی یا احراز سرپرستی نیست.
      </p>
      {error && <p role="alert">{error}</p>}
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const d = await api<{ token: string }>("/invitations", {
              phone: email,
              role: "parent",
              studentId,
            });
            setToken(d.token);
          });
        }}
      >
        <Field title="شماره موبایل ولی دانش‌آموز">
          <input
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09123456789"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 rounded-xl border border-slate-300 p-3"
          />
        </Field>
        <Button disabled={busy}>ایجاد دعوت اولیا</Button>
      </form>
      {token && (
        <p
          data-testid="parent-invitation-token"
          className="mt-3 break-all glass-note p-3 [direction:ltr]"
        >
          {location.origin}/?invite={token}
        </p>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void run(refresh)}
      >
        به‌روزرسانی اولیا
      </Button>
      <PagedList items={parents} label="اولیای مرتبط">
        {(p) => (
          <div key={p._id} className="mt-3 grid gap-2 rounded-xl border p-3">
            <p>{p.name}</p>
            <p dir="ltr" className="break-all text-xs">
              {p.phone ?? "شماره ثبت نشده"}
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api(
                    `/students/${studentId}/parents/${p._id}/revoke`,
                    {},
                  );
                  await refresh();
                })
              }
            >
              لغو دسترسی این ولی
            </Button>
          </div>
        )}
      </PagedList>
    </details>
  );
}
