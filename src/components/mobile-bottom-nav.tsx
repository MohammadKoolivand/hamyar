"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  BookOpenCheck, ChartNoAxesCombined, ClipboardList, Database, FilePlus2,
  FileUp, House, Library, ListChecks, LogIn, Menu, Settings, UsersRound, X,
} from "lucide-react";
import type { User } from "@/lib/types";

type NavigationRole = User["role"] | "guest";
type IconComponent = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
export type MobileNavItem = {
  page: string;
  label: string;
  icon: IconComponent;
  aliases?: string[];
};

export function mobileDestinations(role: NavigationRole): {
  primary: MobileNavItem[];
  additional: MobileNavItem[];
} {
  const publicBank = { page: "public-bank", label: "نمونه‌سؤال", icon: Library };
  if (role === "guest") {
    return {
      primary: [
        { page: "dashboard", label: "تمرین‌ها", icon: Library, aliases: ["public-bank", "student-practice", "student-search"] },
        { page: "courses", label: "درس‌ها", icon: BookOpenCheck },
        { page: "login", label: "ورود", icon: LogIn },
      ],
      additional: [],
    };
  }
  if (role === "parent") {
    return {
      primary: [
        { page: "dashboard", label: "فرزند من", icon: UsersRound },
        publicBank,
      ],
      additional: [],
    };
  }
  if (role === "student") {
    return {
      primary: [
        { page: "dashboard", label: "تمرین‌ها", icon: Library, aliases: ["public-bank", "student-practice"] },
        { page: "courses", label: "درس‌ها", icon: BookOpenCheck, aliases: ["student-course"] },
        { page: "student-missions", label: "تکلیف‌ها", icon: ClipboardList, aliases: ["practice", "report"] },
        { page: "student-progress", label: "پیشرفت", icon: ChartNoAxesCombined },
        { page: "more", label: "بیشتر", icon: Menu },
      ],
      additional: [
        { page: "student-mistakes", label: "مرور اشتباهات", icon: ListChecks },
      ],
    };
  }
  if (role === "secretary") {
    return {
      primary: [
        publicBank,
        { page: "content", label: "بانک سؤال", icon: ListChecks, aliases: ["content-new"] },
        { page: "exam-import", label: "ورود آزمون", icon: FileUp },
        { page: "resources", label: "منابع", icon: BookOpenCheck },
        { page: "more", label: "بیشتر", icon: Menu },
      ],
      additional: [
        { page: "access", label: "دسترسی‌های تفویض‌شده", icon: Settings },
      ],
    };
  }
  return {
    primary: [
      publicBank,
      { page: "dashboard", label: "خانه", icon: House },
      { page: "content", label: "بانک من", icon: ListChecks, aliases: ["content-new"] },
      { page: "missions", label: "مأموریت‌ها", icon: ClipboardList, aliases: ["practice", "report"] },
      { page: "more", label: "بیشتر", icon: Menu },
    ],
    additional: [
      { page: "content-new", label: "افزودن سؤال", icon: FilePlus2 },
      { page: "exam-import", label: "ورود آزمون", icon: FileUp },
      { page: "resources", label: "منابع آموزشی و PDF", icon: BookOpenCheck },
      { page: "courses", label: "درس‌های من", icon: BookOpenCheck },
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
