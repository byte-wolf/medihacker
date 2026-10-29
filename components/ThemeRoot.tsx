"use client";

import { Theme } from "@carbon/react";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

type ThemeName = "white" | "g100";
const ThemeContext = createContext<{ theme: ThemeName; toggle: () => void }>({ theme: "white", toggle: () => {} });

const KEY = "mh-theme";
const EVENT = "mh-theme-change";

function readTheme(): ThemeName {
  try {
    return localStorage.getItem(KEY) === "g100" ? "g100" : "white";
  } catch {
    return "white";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Carbon theme provider with an optional dark (g100) night-shift theme, remembered per browser. */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "white" as const);
  const toggle = () => {
    try {
      localStorage.setItem(KEY, theme === "white" ? "g100" : "white");
    } catch {
      // storage unavailable: the toggle only lasts until reload
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <ThemeContext value={{ theme, toggle }}>
      <Theme theme={theme} className="theme-root">
        {children}
      </Theme>
    </ThemeContext>
  );
}

export function useThemeToggle() {
  return useContext(ThemeContext);
}
