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
    <div className="grid min-w-0 max-w-full gap-2 [&>input]:min-w-0 [&>input]:max-w-full [&>select]:min-w-0 [&>select]:max-w-full [&>textarea]:min-w-0 [&>textarea]:max-w-full">
      <label
        htmlFor={fieldId}
        className="flex flex-col gap-2 text-[13px] font-medium text-[#526886]"
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
