import { z } from "zod";
export const roleSchema = z.enum([
  "student",
  "teacher",
  "parent",
  "super_admin",
  "secretary",
]);
export type Role = z.infer<typeof roleSchema>;
export const roleLabels: Record<Role, string> = {
  student: "دانش‌آموز",
  teacher: "معلم",
  parent: "والدین",
  super_admin: "سوپرادمین",
  secretary: "منشی",
};
export const staffPermissionSchema = z.enum([
  "roster.read",
  "courses.read",
  "invitations.create",
]);
export type StaffPermission = z.infer<typeof staffPermissionSchema>;
export const staffPermissionLabels: Record<StaffPermission, string> = {
  "roster.read": "مشاهده فهرست و اطلاعات تماس دانش‌آموزان",
  "courses.read": "مشاهده درس‌ها و تعداد اعضا",
  "invitations.create": "ایجاد دعوت دانش‌آموز و والدین",
};

const registeredRouteMethods: Readonly<Record<string, readonly string[]>> = {
  GET: [
    "/api/health",
    "/api/auth/me",
    "/api/access/me",
    "/api/admin/users",
    "/api/admin/audit",
    "/api/admin/staff-assignments",
    "/api/staff/workspaces",
    "/api/staff/workspaces/:tid/roster",
    "/api/staff/workspaces/:tid/courses",
    "/api/privacy/consent/status",
    "/api/privacy/children/:studentId/consent/history",
    "/api/privacy/deletion-requests/:requestId",
    "/api/privacy/deletion-requests/:requestId/inventory",
    "/api/children",
    "/api/students",
    "/api/students/:sid/parents",
    "/api/students/:sid/progress",
    "/api/students/:sid/mistakes",
    "/api/students/:sid/remediation-candidates",
    "/api/courses",
    "/api/enrollments",
    "/api/course-requests",
    "/api/enrollment-history",
    "/api/student/dashboard",
    "/api/student/library",
    "/api/missions",
    "/api/assignments",
    "/api/assignments/:aid",
    "/api/assignments/:aid/report",
    "/api/class-groups",
    "/api/group-tasks",
    "/api/group-tasks/:tid/report",
    "/api/question-assets/:assetId",
    "/api/questions/library-publications",
    "/api/curriculum/catalog",
    "/api/curriculum",
    "/api/questions",
    "/api/questions/:vid",
    "/api/question-drafts",
    "/api/settings/authoring",
    "/api/settings/authoring/models",
    "/api/exam-imports",
    "/api/exam-imports/:eid",
    "/api/exam-imports/:eid/files/:kind",
    "/api/exam-imports/:eid/pages/:kind/:page",
  ],
  POST: [
    "/api/auth/email-verification/request",
    "/api/auth/email-verification/confirm",
    "/api/auth/email/change",
    "/api/privacy/guardian-links/:linkId/review",
    "/api/privacy/children/:studentId/consent",
    "/api/privacy/deletion-requests",
    "/api/privacy/deletion-requests/:requestId/execute",
    "/api/privacy/deletion-requests/:requestId/finalize",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/otp/request",
    "/api/auth/otp/verify",
    "/api/auth/password-reset/request",
    "/api/auth/password-reset/confirm",
    "/api/admin/users",
    "/api/admin/users/:uid/access",
    "/api/admin/staff-assignments",
    "/api/admin/staff-assignments/:gid/revoke",
    "/api/staff/workspaces/:tid/invitations",
    "/api/invitations",
    "/api/invitations/accept",
    "/api/invitations/claim",
    "/api/students/:sid/parents/:pid/revoke",
    "/api/students/:sid/mastery/:skillId/override",
    "/api/students/:sid/remediation-missions",
    "/api/courses",
    "/api/courses/:cid/join-code",
    "/api/course-requests",
    "/api/course-requests/:rid/decision",
    "/api/enrollments/:eid/leave",
    "/api/student/library/:qid/start",
    "/api/missions",
    "/api/missions/:mid/publish",
    "/api/missions/:mid/cancel",
    "/api/assignments/:aid/attempts",
    "/api/assignments/:aid/hints",
    "/api/assignments/:aid/hints/:hid/report",
    "/api/assignments/:aid/complete",
    "/api/evaluations/:eid/review",
    "/api/class-groups",
    "/api/class-groups/:gid/members",
    "/api/group-tasks",
    "/api/group-tasks/:tid/publish",
    "/api/questions/:qid/library",
    "/api/curriculum/catalog/import",
    "/api/curriculum/:nodeId/remove",
    "/api/curriculum/:nodeId/update",
    "/api/curriculum",
    "/api/questions/select",
    "/api/questions/difficulty-batch",
    "/api/questions/:vid/revise",
    "/api/questions",
    "/api/question-drafts/generate",
    "/api/question-drafts/:did/approve",
    "/api/question-drafts/:did/reject",
    "/api/settings/authoring",
    "/api/exam-imports",
    "/api/exam-imports/:eid/items/:iid/source-image",
    "/api/exam-imports/:eid/files/:kind",
    "/api/exam-imports/:eid/extract",
    "/api/exam-imports/:eid/manual-review",
    "/api/exam-imports/:eid/retry",
    "/api/exam-imports/:eid/items",
    "/api/exam-imports/:eid/approve-batch",
    "/api/exam-imports/:eid/items/:iid/review",
  ],
  DELETE: [
    "/api/exam-imports/:eid",
    "/api/exam-imports/:eid/files/:kind",
    "/api/exam-imports/:eid/files",
  ],
};

export const registeredAccessRoutes = new Set(
  Object.entries(registeredRouteMethods).flatMap(([method, routes]) =>
    routes.map((route) => `${method} ${route}`),
  ),
);

// Route-level roles are only the first gate; ownership/relationship checks remain mandatory.
export function routeRoles(method: string, route: string): Role[] | null {
  method = method.toUpperCase();
  if (!registeredAccessRoutes.has(`${method} ${route}`)) return [];
  if (
    [
      "/api/health",
      "/api/auth/email-verification/request",
      "/api/auth/email-verification/confirm",
      "/api/auth/login",
      "/api/auth/otp/request",
      "/api/auth/otp/verify",
      "/api/auth/register",
      "/api/auth/password-reset/request",
      "/api/auth/password-reset/confirm",
      "/api/invitations/accept",
    ].includes(route)
  )
    return null;
  if (
    [
      "/api/auth/me",
      "/api/auth/logout",
      "/api/access/me",
      "/api/auth/email/change",
    ].includes(route)
  )
    return [...roleSchema.options];
  if (route === "/api/privacy/guardian-links/:linkId/review" || route === "/api/privacy/deletion-requests/:requestId/execute" || route === "/api/privacy/deletion-requests/:requestId/inventory" || route === "/api/privacy/deletion-requests/:requestId/finalize") return ["super_admin"];
  if (route === "/api/privacy/children/:studentId/consent") return ["parent"];
  if (route === "/api/privacy/consent/status") return ["student"];
  if (route === "/api/privacy/children/:studentId/consent/history") return ["student", "parent", "super_admin"];
  if (route.startsWith("/api/privacy/deletion-requests")) return [...roleSchema.options];
  if (route.startsWith("/api/admin/")) return ["super_admin"];
  if (route.startsWith("/api/staff/")) return ["secretary"];
  if (route === "/api/children") return ["parent"];
  if (route === "/api/invitations/claim") return ["student", "parent"];
  if (route === "/api/enrollments/:eid/leave") return ["teacher", "student"];
  if (/^\/api\/students\/:sid\/(progress|mistakes)$/.test(route))
    return ["teacher", "student", "parent"];
  if (route === "/api/assignments/:aid/report")
    return ["teacher", "student", "parent"];
  if (route.startsWith("/api/assignments/"))
    return method === "GET" ? ["teacher", "student"] : ["student"];
  if (
    route === "/api/assignments" ||
    (route === "/api/missions" && method === "GET") ||
    ([
      "/api/courses",
      "/api/enrollments",
      "/api/course-requests",
      "/api/enrollment-history",
    ].includes(route) &&
      method === "GET")
  )
    return ["teacher", "student"];
  if (
    (route === "/api/course-requests" && method === "POST") ||
    route.startsWith("/api/student/")
  )
    return ["student"];
  if (route.startsWith("/api/question-assets/"))
    return ["teacher", "student", "parent"];
  const teacherPrefixes = [
    "/api/students",
    "/api/curriculum",
    "/api/questions",
    "/api/question-drafts",
    "/api/settings/",
    "/api/exam-imports",
    "/api/class-groups",
    "/api/group-tasks",
    "/api/missions",
    "/api/courses",
    "/api/course-requests/",
    "/api/evaluations/",
    "/api/invitations",
  ];
  if (teacherPrefixes.some((p) => route.startsWith(p))) return ["teacher"];
  return []; // New routes need an explicit policy. Never treat an unknown role as a student.
}
