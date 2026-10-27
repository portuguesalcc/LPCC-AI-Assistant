"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

// Light is the default; dark only applies once someone switches to it.
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

const SunIcon = () => (
  <svg className="sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg className="moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

/** "Modo" switch between light and dark; the choice is remembered on this device. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("lpcc-theme", next);
    } catch {
      // Storage can be blocked (private mode); the toggle still works for this visit.
    }
    setTheme(next);
  }

  return (
    <button
      className="theme-toggle"
      role="switch"
      aria-checked={theme === "dark"}
      aria-label="Modo escuro"
      title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
      onClick={toggle}
    >
      <span aria-hidden="true">Modo</span>
      <span className="theme-track">
        <span className="theme-knob" />
        <SunIcon />
        <MoonIcon />
      </span>
    </button>
  );
}
