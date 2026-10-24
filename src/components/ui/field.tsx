"use client";
import React from "react";
export function Field({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const fieldId = React.useId();
  return (
    <div className="grid gap-2">
      <label
        htmlFor={fieldId}
        className="flex flex-col gap-2 text-[13px] text-slate-600"
      >
        {title}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, {
            id: fieldId,
          })
        : children}
    </div>
  );
}
