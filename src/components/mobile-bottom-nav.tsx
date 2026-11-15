"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  BookOpenCheck, ChartNoAxesCombined, Database, FilePlus2,
  FileUp, House, Library, ListChecks, LogIn, Menu, Settings, UsersRound, X, GraduationCap, NotebookPen, UserRound,
} from "lucide-react";
import type { User } from "@/lib/types";

type NavigationRole = User["role"] | "guest";
type IconComponent = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
export type MobileNavItem = {
  page: string;
  label: string;
  icon: IconComponent;
  aliases?: string[];
  tone?: "mint" | "sky" | "peach" | "violet" | "yellow";
};

export function mobileDestinations(role: NavigationRole): {
  primary: MobileNavItem[];
  additional: MobileNavItem[];
} {
  // The middle destination is consistently the public question-selection home.
  // No role needs to navigate into a separate teacher panel just to find it.
  const home: MobileNavItem = { page: "home", label: "خانه", icon: House, tone: "mint",
    aliases: role === "guest" ? ["dashboard", "public-bank", "student-practice", "student-search"]
      : role === "student" ? ["public-bank"] : ["public-bank"] };
  if (role === "guest") {
    return {
      primary: [
        { page: "courses", label: "درس‌ها", icon: GraduationCap, tone: "sky" },
        home,
        { page: "login", label: "ورود", icon: LogIn, tone: "violet" },
      ],
      additional: [],
    };
  }
  if (role === "parent") {
    return {
      primary: [
        { page: "dashboard", label: "فرزند من", icon: UsersRound, tone: "sky" },
        home,
        { page: "public-bank", label: "بانک سؤال", icon: Library, tone: "peach" },
      ],
      additional: [],
    };
  }
  if (role === "student") {
    return {
      primary: [
        { page: "student-practice", label: "تمرین‌ها", icon: BookOpenCheck, tone: "sky" },
        { page: "student-missions", label: "تکلیف‌ها", icon: NotebookPen, tone: "peach", aliases: ["practice", "report"] },
        home,
        { page: "student-progress", label: "پیشرفت", icon: ChartNoAxesCombined, tone: "violet" },
        { page: "account", label: "حساب", icon: UserRound, tone: "yellow" },
      ],
      additional: [
        { page: "dashboard", label: "نمای کلی یادگیری", icon: ChartNoAxesCombined, tone: "sky" },
        { page: "student-mistakes", label: "مرور اشتباهات", icon: ListChecks, tone: "peach" },
      ],
    };
  }
  if (role === "secretary") {
    return {
      primary: [
        { page: "content", label: "بانک سؤال", icon: Library, tone: "sky", aliases: ["content-new"] },
        { page: "exam-import", label: "ورود آزمون", icon: FileUp, tone: "peach" },
        home,
        { page: "resources", label: "منابع", icon: BookOpenCheck, tone: "violet" },
        { page: "more", label: "بیشتر", icon: Menu, tone: "yellow" },
      ],
      additional: [
        { page: "access", label: "دسترسی‌های تفویض‌شده", icon: Settings },
      ],
    };
  }
  return {
    primary: [
      { page: "classes", label: "کلاس‌ها", icon: UsersRound, tone: "sky" },
      { page: "missions", label: "تکلیف‌ها", icon: NotebookPen, tone: "peach", aliases: ["practice", "report"] },
      home,
      { page: "content", label: "سؤال و PDF", icon: Library, tone: "violet", aliases: ["content-new", "resources"] },
      { page: "account", label: "حساب", icon: UserRound, tone: "yellow" },
    ],
    additional: [
      { page: "content-new", label: "افزودن سؤال", icon: FilePlus2 },
      { page: "exam-import", label: "ورود آزمون", icon: FileUp },
      { page: "resources", label: "منابع آموزشی و PDF", icon: BookOpenCheck },
      { page: "courses", label: "درس‌های من", icon: GraduationCap },
      { page: "students", label: "دانش‌آموزان", icon: UsersRound },
      { page: "classes", label: "کلاس‌های گروهی", icon: UsersRound },
      { page: "learning", label: "یادگیری و مرور", icon: ChartNoAxesCombined },
      ...(role === "super_admin"
        ? [
            { page: "admin-overview", label: "آمار سامانه", icon: Database },
            { page: "access", label: "مدیریت دسترسی‌ها", icon: Settings },
          ]
        : []),
    ],
  };
}

export function MobileBottomNav({
  role, page, onNavigate,
}: {
  role: NavigationRole;
  page: string;
  onNavigate: (page: string) => void;
}) {
  const { primary, additional } = mobileDestinations(role);
  const [moreOpen, setMoreOpen] = useState(false);
  const firstLink = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMoreOpen(false); }, [page]);
  useEffect(() => {
    if (!moreOpen) return;
    firstLink.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);
  const activeOn = (item: MobileNavItem) =>
    item.page === page || item.aliases?.includes(page) === true;
  const moreIsActive = !primary.some((item) => item.page !== "more" && activeOn(item)) && additional.some(activeOn);

  const navigate = (nextPage: string) => {
    setMoreOpen(false);
    onNavigate(nextPage);
  };

  return (
    <>
      {moreOpen && additional.length > 0 && (
        <div className="hy-mobile-sheet-layer md:hidden">
          <button
            type="button"
            className="hy-mobile-sheet-backdrop"
            aria-label="بستن منوی بیشتر"
            onClick={() => setMoreOpen(false)}
          />
          <section role="dialog" aria-modal="true" aria-label="سایر بخش‌ها" className="hy-mobile-sheet" dir="rtl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">سایر بخش‌ها</h2>
                <p className="mt-1 text-xs text-slate-500">امکانات متناسب با حساب شما</p>
              </div>
              <button type="button" className="hy-mobile-sheet-close" onClick={() => setMoreOpen(false)} aria-label="بستن">
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="grid gap-1.5">
              {additional.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    ref={index === 0 ? firstLink : undefined}
                    key={item.page}
                    onClick={() => navigate(item.page)}
                    aria-current={activeOn(item) ? "page" : undefined}
                    className="hy-mobile-sheet-item"
                  >
                    <span className="hy-mobile-sheet-icon"><Icon size={20} aria-hidden /></span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
      <nav className="hy-mobile-bottom-nav md:hidden" dir="rtl" aria-label="ناوبری پایین صفحه">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = item.page === "more" ? moreOpen || moreIsActive : activeOn(item);
          return (
            <button
              type="button"
              key={item.page}
              className="hy-mobile-bottom-item"
              aria-label={item.label}
              aria-current={active && item.page !== "more" ? "page" : undefined}
              aria-expanded={item.page === "more" ? moreOpen : undefined}
              data-active={active}
              data-tone={item.tone ?? "mint"}
              data-home={item.page === "home"}
              onClick={() => item.page === "more" ? setMoreOpen((old) => !old) : navigate(item.page)}
            >
              <span className="hy-mobile-bottom-icon"><Icon size={21} aria-hidden /></span>
              <span className="hy-mobile-bottom-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
