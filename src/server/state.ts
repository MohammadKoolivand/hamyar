export type AssignmentState =
  "published" | "in_progress" | "submitted" | "completed" | "cancelled";
const transitions: Record<string, readonly string[]> = {
  draft: ["published", "cancelled"],
  published: ["in_progress", "cancelled"],
  in_progress: ["submitted", "completed", "cancelled"],
  submitted: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
export function transition(from: string, to: string) {
  if (from === to) return;
  if (!transitions[from]?.includes(to))
    throw Object.assign(new Error("تغییر وضعیت مأموریت مجاز نیست"), {
      statusCode: 409,
    });
}
export function assertOpen(state: string) {
  if (!["published", "in_progress"].includes(state))
    throw Object.assign(
      new Error("مأموریت برای ثبت پاسخ یا راهنمایی باز نیست"),
      { statusCode: 409 },
    );
}
