"use client";
import type { ComponentProps } from "react";
// Match the app shell's history navigation while retaining normal link behavior
// for new tabs, downloads and browser context menus.
export function AppLink({ href, onClick, ...props }: ComponentProps<"a">) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          !href ||
          props.target ||
          props.download
        )
          return;
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        event.preventDefault();
        window.history.pushState(
          window.history.state,
          "",
          url.pathname + url.search + url.hash,
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
    />
  );
}
