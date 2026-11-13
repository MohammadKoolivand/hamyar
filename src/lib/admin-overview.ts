export type AdminCount = { key: string; count: number };
export type AdminRoleCount = { role: string; count: number; active: number };

export interface AdminCollectionStat {
  name: string;
  documents: number | null;
  dataBytes: number | null;
  storageBytes: number | null;
  indexBytes: number | null;
}

export interface AdminSystemOverview {
  generatedAt: string;
  database: {
    name: string;
    available: boolean;
    collections: number;
    documents: number | null;
    dataBytes: number | null;
    storageBytes: number | null;
    indexBytes: number | null;
  };
  totals: {
    users: number;
    activeUsers: number;
    teachers: number;
    students: number;
    parents: number;
    questions: number;
    questionVersions: number;
    verifiedPublicQuestions: number;
    courses: number;
    assignments: number;
  };
  roles: AdminRoleCount[];
  questionTypes: AdminCount[];
  questionVisibility: AdminCount[];
  collections: AdminCollectionStat[];
}

export interface AdminUserRow {
  _id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  disabledAt?: string;
}

export interface AdminUserPage {
  items: AdminUserRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const questionTypeLabels: Record<string, string> = {
  choice: "چهارگزینه‌ای",
  numeric: "عددی",
  short: "پاسخ کوتاه",
  essay: "تشریحی",
  symbolic: "نمادین",
  unknown: "نامشخص",
};

export const visibilityLabels: Record<string, string> = {
  verified_public: "عمومیِ تأییدشده",
  unverified_public: "عمومیِ در انتظار تأیید",
  private: "خصوصی",
  unknown: "نامشخص",
};

export function formatStorageBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "در دسترس نیست";
  if (bytes === 0) return "۰ بایت";
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / 1024 ** index).toLocaleString("fa-IR", { maximumFractionDigits: index === 0 ? 0 : 1 }) + " " + units[index];
}
