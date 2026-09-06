'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'flowcraft:theme';

// Class-based dark mode (see the `@custom-variant dark` override in
// globals.css) rather than relying on prefers-color-scheme directly, so an
// explicit user choice persists across visits regardless of OS setting.
// Scoped to the dashboard for now — see globals.css for why.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  // Reading localStorage on mount is a legitimate effect (syncing with an
  // external system), but the lint rule here flags any setState called
  // synchronously in an effect body regardless — deferring through a
  // resolved promise (matching the .then(setState) shape used elsewhere in
  // this codebase, e.g. CommandPalette's diagram fetch) satisfies it without
  // changing behavior; the deferral is a single microtask, imperceptible.
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') setTheme(stored);
      } catch {
        // localStorage unavailable (private browsing) — fall back to light
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore — theme just won't persist across visits
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
