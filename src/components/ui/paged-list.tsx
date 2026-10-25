"use client";
import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { fa } from "@/lib/presentation";

export function PagedList<T>({
  items,
  children,
  label,
  pageSize = 10,
  initialPage = 1,
  className = "grid gap-3",
}: {
  items: T[];
  children: (item: T, index: number) => ReactNode;
  label: string;
  pageSize?: number;
  initialPage?: number;
  className?: string;
}) {
  const signature = JSON.stringify(
    items.map((item) =>
      typeof item === "object" && item !== null && "_id" in item
        ? item._id
        : item,
    ),
  );
  const [state, setState] = useState({ signature, page: initialPage });
  if (state.signature !== signature) setState({ signature, page: 1 });
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = state.signature === signature ? Math.min(state.page, pages) : 1;
  const start = (page - 1) * pageSize;
  return (
    <div className="grid min-w-0 gap-4">
      <div className={className}>
        {items
          .slice(start, start + pageSize)
          .map((item, index) => children(item, start + index))}
      </div>
      {items.length > pageSize && (
        <nav
          aria-label={`صفحه‌بندی ${label}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white/60 p-3 text-xs text-slate-600"
        >
          <span aria-live="polite">
            {fa(start + 1)} تا {fa(Math.min(start + pageSize, items.length))} از{" "}
            {fa(items.length)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page === 1}
              onClick={() => setState({ signature, page: page - 1 })}
            >
              صفحه قبل
            </Button>
            <label className="flex items-center gap-2">
              صفحه
              <select
                aria-label={`صفحه ${label}`}
                className="glass-field min-h-11 p-2"
                value={page}
                onChange={(e) =>
                  setState({ signature, page: Number(e.target.value) })
                }
              >
                {Array.from({ length: pages }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {fa(i + 1)}
                  </option>
                ))}
              </select>
              از {fa(pages)}
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={page === pages}
              onClick={() => setState({ signature, page: page + 1 })}
            >
              صفحه بعد
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
