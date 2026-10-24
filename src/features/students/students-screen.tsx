"use client";
import { ParentInvitation } from "./parent-invitation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";

import type { User } from "@/lib/types";
import { Plus } from "lucide-react";
export function StudentsScreen({
  students,
  inviteEmail,
  inviteToken,
  busy,
  run,
  refresh,
  setInviteEmail,
  setInviteToken,
}: {
  students: User[];
  inviteEmail: string;
  inviteToken: string;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  setInviteEmail: (v: string) => void;
  setInviteToken: (v: string) => void;
}) {
  return (
    <div className="grid gap-[22px] min-[951px]:grid-cols-2">
      <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
        <h2 className="text-[19px] font-bold">دعوت یک همراه جدید</h2>
        <p className="text-xs leading-loose text-slate-500">
          کد ۷۲ ساعت معتبر است. لینک را خودتان در اختیار دانش‌آموز قرار دهید.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const d = await api<{ token: string }>("/invitations", {
                email: inviteEmail,
              });
              setInviteToken(d.token);
            });
          }}
          className="grid gap-[18px]"
        >
          <Field title="ایمیل دانش‌آموز">
            <input
              required
              type="email"
              dir="ltr"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
            />
          </Field>
          <Button disabled={busy}>
            <Plus size={16} />
            ایجاد دعوت
          </Button>
        </form>
        {inviteToken && (
          <div className="rounded-[14px] bg-indigo-50 text-[#233b8f] p-3.5 leading-[1.9] grid gap-[18px]">
            <small className="text-xs leading-loose text-slate-500">
              لینک دعوت (ارسال ایمیل انجام نمی‌شود)
            </small>
            <p className="[direction:ltr] [overflow-wrap:anywhere] font-mono select-all">
              {location.origin}/?invite={inviteToken}
            </p>
            <small className="text-xs leading-loose text-slate-500">
              کد دعوت
            </small>
            <p
              data-testid="invitation-token"
              className="[direction:ltr] [overflow-wrap:anywhere] font-mono select-all"
            >
              {inviteToken}
            </p>
          </div>
        )}
      </section>
      <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
        <h2 className="text-[19px] font-bold">دانش‌آموزان شما</h2>
        {students.map((s) => (
          <div
            key={s._id}
            className="grid gap-3 rounded-2xl border border-slate-200 p-[18px]"
          >
            <h3 className="text-base font-bold">{s.name}</h3>
            <small dir="ltr" className="text-xs leading-loose text-slate-500">
              {s.email}
            </small>
            <ParentInvitation studentId={s._id} />
          </div>
        ))}
        {!students.length && (
          <p className="p-[30px] text-center leading-loose text-slate-500">
            پس از پذیرش دعوت، دانش‌آموز اینجا ظاهر می‌شود.
          </p>
        )}
        <Button variant="outline" onClick={() => run(() => refresh())}>
          به‌روزرسانی فهرست
        </Button>
      </section>
    </div>
  );
}
