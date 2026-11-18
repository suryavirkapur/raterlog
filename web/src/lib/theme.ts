import { Classes } from "@blueprintjs/core";

export type ThemeMode = "dark" | "light";
const KEY = "rl-theme";

export function getTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "dark";
}

export function applyTheme(mode: ThemeMode) {
  document.body.classList.toggle(Classes.DARK, mode === "dark");
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
}
