"use client";

import { useThemeMode } from "./theme-provider";

export function ThemeToggleOrb() {
  const { theme, toggleTheme } = useThemeMode();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group relative h-12 w-24 rounded-full border border-white/20 bg-[var(--panel)] p-1 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition"
      aria-label="Toggle theme"
    >
      <span
        className={`absolute inset-y-1 w-10 rounded-full transition-all duration-500 ${
          isDark
            ? "left-1 bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-500"
            : "left-[calc(100%-2.75rem)] bg-gradient-to-br from-amber-200 via-yellow-300 to-orange-400"
        }`}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold tracking-wide text-[var(--text)]">
        <span className={`transition-opacity ${isDark ? "opacity-100" : "opacity-40"}`}>NIGHT</span>
        <span className={`transition-opacity ${isDark ? "opacity-40" : "opacity-100"}`}>DAY</span>
      </span>
      <span className="pointer-events-none absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400/20 via-transparent to-amber-300/20 opacity-0 blur-md transition group-hover:opacity-100" />
    </button>
  );
}
