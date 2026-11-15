"use client";

import { useEffect } from "react";

/**
 * HTML details elements give menus native keyboard toggle semantics.
 * This controller adds the expected application-menu behavior: clicking
 * outside, pressing Escape, or opening another menu closes prior menus.
 */
export function HeaderDropdownController() {
  useEffect(() => {
    const all = () => document.querySelectorAll<HTMLDetailsElement>("details.hy-header-menu");
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      all().forEach((menu) => {
        if (!menu.contains(target)) menu.open = false;
      });
    };
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      all().forEach((menu) => { if (!menu.contains(target)) menu.open = false; });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const opened = Array.from(all()).filter((menu) => menu.open);
      if (!opened.length) return;
      opened.forEach((menu) => { menu.open = false; });
      (opened[opened.length - 1].querySelector("summary") as HTMLElement | null)?.focus();
    };
    const onToggle = (event: Event) => {
      const opened = event.target;
      if (!(opened instanceof HTMLDetailsElement) || !opened.matches("details.hy-header-menu") || !opened.open) return;
      all().forEach((menu) => {
        if (menu !== opened) menu.open = false;
      });
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClickOutside, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClickOutside, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);
  return null;
}
