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
// Route-level roles are only the first gate; ownership/relationship checks remain mandatory.
export function routeRoles(method: string, route: string): Role[] | null {
  if (
    [
      "/api/health",
      "/api/auth/email-verification/request",
      "/api/auth/email-verification/confirm",
      "/api/auth/login",
      "/api/auth/otp/request",
      "/api/auth/otp/verify",
      "/api/auth/logout",
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
