import { persistentAtom } from "@nanostores/persistent";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

function decodeThemePreference(value: string): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export const $themePreference = persistentAtom<ThemePreference>(
  "theme_preference",
  "system",
  {
    encode: (value) => value,
    decode: decodeThemePreference,
  },
);

function prefersSystemDarkMode(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(DARK_MODE_QUERY).matches
  );
}

export function resolveThemePreference(
  preference: ThemePreference,
): ResolvedTheme {
  if (preference === "system") {
    return prefersSystemDarkMode() ? "dark" : "light";
  }
  return preference;
}

function applyResolvedTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-kb-theme", theme);
}

export function applyThemePreference(preference: ThemePreference) {
  applyResolvedTheme(resolveThemePreference(preference));
}

export function listenForSystemThemeChanges(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const media = window.matchMedia(DARK_MODE_QUERY);
  const listener = () => onChange();

  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
