"use client";

import { useSyncExternalStore } from "react";

const KEY = "luma-theme";
const EVENT = "luma-theme-change";

function read(): string {
  try {
    const v = localStorage.getItem(KEY) ?? "system";
    return v === "paper" ? "light" : v;
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** Site-wide colour theme. "Match my device" follows the system setting. */
export function ThemeSelect({ id }: { id: string }) {
  const value = useSyncExternalStore(subscribe, read, () => "system");
  const change = (v: string) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    if (v === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", v);
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="font-bold text-muted">
        Theme
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => change(e.target.value)}
        className="min-h-11 rounded-lg border-[1.5px] border-line bg-bg px-2 text-fg"
      >
        <option value="system">Match my device</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="contrast">Yellow on black</option>
      </select>
    </div>
  );
}
