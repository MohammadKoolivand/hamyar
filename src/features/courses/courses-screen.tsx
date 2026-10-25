"use client";
import { PagedList } from "@/components/ui/paged-list";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BookOpen, Plus, UserCheck, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import type {
  Course,
  Enrollment,
  Assignment,
  User,
  CourseMembershipRequest,
  EnrollmentHistory,
} from "@/lib/types";

const labels: Record<string, string> = {
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  declined: "ردشده",
  active: "عضو فعال",
  revoked: "عضویت پایان‌یافته",
};

export function CoursesScreen({
  teacher,
  courses,
  enrollments,
  assignments,
  students,
  refresh,
}: {
  teacher: boolean;
  courses: Course[];
  enrollments: Enrollment[];
  assignments: Assignment[];
  students: User[];
  refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [code, setCode] = useState("");
  const [issuedCodes, setIssuedCodes] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<CourseMembershipRequest[]>([]);
  const [history, setHistory] = useState<EnrollmentHistory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [nextRequests, nextHistory] = await Promise.all([
      api<CourseMembershipRequest[]>("/course-requests"),
      api<EnrollmentHistory[]>("/enrollment-history"),
    ]);
    setRequests(nextRequests);
    setHistory(nextHistory);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<CourseMembershipRequest[]>("/course-requests"),
      api<EnrollmentHistory[]>("/enrollment-history"),
    ])
      .then(([r, h]) => {
        if (active) {
          setRequests(r);
          setHistory(h);
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  async function action(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      await Promise.all([refresh(), load()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createCourse(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      await api("/courses", { title: title.trim(), subject: subject.trim() });
      setTitle("");
      setSubject("");
      setNotice("درس جدید ایجاد شد.");
    });
  }

  async function requestCourse(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      await api("/course-requests", { code: code.trim().toLowerCase() });
      setCode("");
      setNotice("درخواست ثبت شد؛ منتظر تأیید معلم باشید.");
    });
  }

  async function generateCode(courseId: string) {
    await action(async () => {
      const result = await api<{ code: string; expiresAt: string }>(
        "/courses/" + courseId + "/join-code",
        {},
      );
      setIssuedCodes((previous) => ({ ...previous, [courseId]: result.code }));
      setNotice("کد قبلی این درس باطل شد؛ کد جدید ۷۲ ساعت معتبر است.");
    });
  }

  async function decide(requestId: string, decision: "approve" | "decline") {
    await action(async () => {
      await api("/course-requests/" + requestId + "/decision", { decision });
      setNotice(decision === "approve" ? "عضویت تأیید شد." : "درخواست رد شد.");
    });
  }

  async function leave(enrollmentId: string) {
    if (
      !window.confirm(
        "با پایان عضویت، تمرین‌های ناتمام این درس لغو می‌شوند. پاسخ‌های قبلی محفوظ می‌مانند. ادامه می‌دهید؟",
      )
    )
      return;
    await action(async () => {
      await api("/enrollments/" + enrollmentId + "/leave", {});
      setNotice("عضویت پایان یافت و تاریخچه محفوظ ماند.");
    });
  }

  const pending = requests.filter((r) => r.status === "pending");
  const ended = history.filter((h) => h.status === "revoked");

  return (
    <div className="grid gap-5">
      {teacher ? (
        <section className="glass-panel grid gap-4 p-6">
          <h2 className="text-lg font-bold">ایجاد درس آموزشی</h2>
          <p className="text-sm text-slate-600">
            برای درس کد درخواست صادر کنید؛ دانش‌آموز ابتدا درخواست می‌دهد و فقط
            پس از تأیید شما عضو خواهد شد. دعوت با شماره موبایل نیز فعال است.
          </p>
          <form
            onSubmit={(event) => void createCourse(event)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field title="نام درس">
              <input
                className="glass-field min-h-11 w-full p-3"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                minLength={2}
                maxLength={100}
                required
                placeholder="ریاضی"
              />
            </Field>
            <Field title="عنوان دوره">
              <input
                className="glass-field min-h-11 w-full p-3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={2}
                maxLength={120}
                required
                placeholder="ریاضی پایه دهم"
              />
            </Field>
            <Button disabled={busy} type="submit">
              <Plus size={16} /> ایجاد درس
            </Button>
          </form>
        </section>
      ) : (
        <section className="glass-panel grid gap-3 p-6">
          <h2 className="text-lg font-bold">درخواست عضویت در درس</h2>
          <p className="text-sm leading-loose text-slate-600">
            کد ۴۸ کاراکتری را از معلم بگیرید. ارسال درخواست به معنی عضویت فوری
            نیست؛ تأیید معلم لازم است.
          </p>
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            onSubmit={(e) => void requestCourse(e)}
          >
            <Field title="کد درخواست عضویت">
              <input
                dir="ltr"
                className="glass-field min-h-11 w-full p-3"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                minLength={48}
                maxLength={48}
                autoComplete="off"
              />
            </Field>
            <Button disabled={busy} type="submit">
              ارسال درخواست
            </Button>
          </form>
          {!!requests.length && (
            <div className="grid gap-2">
              <h3 className="font-medium">وضعیت درخواست‌های من</h3>
              <PagedList items={requests} label="درخواست‌ها">
                {(request) => (
                  <p key={request._id} className="glass-note p-3 text-sm">
                    {request.courseTitle} ·{" "}
                    {labels[request.status] ?? request.status}
                  </p>
                )}
              </PagedList>
            </div>
          )}
        </section>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="glass-note p-3 text-sm">
          {notice}
        </p>
      )}
      {teacher && !!pending.length && (
        <section className="glass-panel grid gap-3 p-6">
          <h2 className="text-lg font-bold">درخواست‌های منتظر تأیید</h2>
          <PagedList items={pending} label="درخواست‌های در انتظار">
            {(request) => (
              <div key={request._id} className="glass-option grid gap-3 p-4">
                <div>
                  <strong>{request.studentName}</strong>
                  <p className="text-xs text-slate-500" dir="ltr">
                    {request.studentEmail}
                  </p>
                  <p className="text-sm text-slate-600">
                    {request.courseTitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={() => void decide(request._id, "approve")}
                  >
                    <UserCheck size={16} aria-hidden /> تأیید عضویت
                  </Button>
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => void decide(request._id, "decline")}
                  >
                    رد درخواست
                  </Button>
                </div>
              </div>
            )}
          </PagedList>
        </section>
      )}
      <section className="grid gap-4">
        <h2 className="text-lg font-bold">
          {teacher ? "درس‌های تحت تدریس" : "درس‌های من"}
        </h2>
        {!courses.length && (
          <div className="glass-panel p-6 text-sm leading-loose text-slate-600">
            {teacher
              ? "هنوز درسی تعریف نکرده‌اید."
              : "هنوز عضو هیچ درسی نیستید. از معلم کد درخواست مخصوص آن درس را بگیرید."}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <PagedList items={courses} label="درس‌ها">
            {(course) => {
              const enrolled = enrollments.filter(
                (e) => e.courseId === course._id,
              );
              const count = assignments.filter(
                (a) => a.courseId === course._id,
              ).length;
              const own = enrolled[0];
              return (
                <article className="glass-card grid gap-3 p-5" key={course._id}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#2EC8C315] text-[#08746f]">
                      <BookOpen size={20} />
                    </span>
                    <div>
                      <p className="text-xs text-slate-500">{course.subject}</p>
                      <h3 className="font-bold">{course.title}</h3>
                    </div>
                  </div>
                  {teacher ? (
                    <>
                      <p className="text-sm text-slate-600">
                        {enrolled.length} دانش‌آموز عضو · {count} مأموریت
                      </p>
                      <Button
                        disabled={busy}
                        variant="outline"
                        onClick={() => void generateCode(course._id)}
                      >
                        صدور / تغییر کد درخواست
                      </Button>
                      {issuedCodes[course._id] && (
                        <div className="glass-note grid gap-1 p-3">
                          <p className="text-xs">
                            کد جدید (فقط در همین صفحه نمایش داده می‌شود):
                          </p>
                          <p
                            data-testid="course-join-code"
                            dir="ltr"
                            className="break-all select-all font-mono text-xs"
                          >
                            {issuedCodes[course._id]}
                          </p>
                        </div>
                      )}
                      <PagedList items={enrolled} label="اعضای درس">
                        {(member) => (
                          <div
                            key={member._id}
                            className="glass-option flex flex-wrap items-center justify-between gap-2 p-3"
                          >
                            <span className="text-sm">
                              {students.find((s) => s._id === member.studentId)
                                ?.name ?? "دانش‌آموز"}
                            </span>
                            <Button
                              disabled={busy}
                              variant="outline"
                              onClick={() => void leave(member._id)}
                            >
                              <UserMinus size={15} aria-hidden /> لغو عضویت
                            </Button>
                          </div>
                        )}
                      </PagedList>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600">
                        معلم: {own?.teacherName ?? "معلم"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {count} مأموریت این درس
                      </p>
                      {own && (
                        <Button
                          disabled={busy}
                          variant="outline"
                          onClick={() => void leave(own._id)}
                        >
                          خروج از درس
                        </Button>
                      )}
                    </>
                  )}
                </article>
              );
            }}
          </PagedList>
        </div>
      </section>
      {!!ended.length && (
        <section className="glass-panel grid gap-3 p-5">
          <h2 className="text-lg font-bold">تاریخچه عضویت‌های پایان‌یافته</h2>
          <PagedList items={ended} label="درس‌های پایان‌یافته">
            {(item) => (
              <div
                key={item._id}
                className="glass-option grid gap-1 p-3 text-sm"
              >
                <strong>{item.courseTitle}</strong>
                <span className="text-slate-600">
                  عضویت پایان‌یافته · {item.history.length} رویداد ثبت‌شده
                </span>
                <p className="text-xs text-slate-500">
                  مأموریت‌ها و شواهد قبلی حذف نشده‌اند.
                </p>
              </div>
            )}
          </PagedList>
        </section>
      )}
    </div>
  );
}
