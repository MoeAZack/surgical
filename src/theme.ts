// Mirrors the --brand-* custom property values defined per theme in index.css.
// Used to apply the active theme as direct inline styles (in addition to the
// theme-* class) so switching themes repaints immediately and reliably —
// class-based custom property changes on elements behind backdrop-filter
// (used throughout this app's cards/sidebar) can be slow to repaint in some
// browsers; an imperative style.setProperty() mutation does not have that
// problem.
export type ThemeColor = "emerald" | "teal" | "indigo" | "rose" | "violet" | "amber" | "slate" | "blue";

export const THEME_VARS: Record<ThemeColor, Record<string, string>> = {
  emerald: {
    "--brand-bg": "#0A2E2A",
    "--brand-primary": "#10b981",
    "--brand-primary-hover": "#059669",
    "--brand-primary-light": "#34d399",
    "--brand-primary-glow": "rgba(16, 185, 129, 0.15)",
    "--brand-secondary": "#14b8a6",
    "--brand-secondary-light": "#2dd4bf"
  },
  teal: {
    "--brand-bg": "#042528",
    "--brand-primary": "#0d9488",
    "--brand-primary-hover": "#0f766e",
    "--brand-primary-light": "#2dd4bf",
    "--brand-primary-glow": "rgba(13, 148, 136, 0.15)",
    "--brand-secondary": "#06b6d4",
    "--brand-secondary-light": "#22d3ee"
  },
  indigo: {
    "--brand-bg": "#0a1128",
    "--brand-primary": "#6366f1",
    "--brand-primary-hover": "#4f46e5",
    "--brand-primary-light": "#818cf8",
    "--brand-primary-glow": "rgba(99, 102, 241, 0.15)",
    "--brand-secondary": "#3b82f6",
    "--brand-secondary-light": "#60a5fa"
  },
  rose: {
    "--brand-bg": "#1e090f",
    "--brand-primary": "#f43f5e",
    "--brand-primary-hover": "#e11d48",
    "--brand-primary-light": "#fb7185",
    "--brand-primary-glow": "rgba(244, 63, 94, 0.15)",
    "--brand-secondary": "#ec4899",
    "--brand-secondary-light": "#f472b6"
  },
  violet: {
    "--brand-bg": "#110920",
    "--brand-primary": "#8b5cf6",
    "--brand-primary-hover": "#7c3aed",
    "--brand-primary-light": "#a78bfa",
    "--brand-primary-glow": "rgba(139, 92, 246, 0.15)",
    "--brand-secondary": "#d946ef",
    "--brand-secondary-light": "#f5d0fe"
  },
  amber: {
    "--brand-bg": "#1f1103",
    "--brand-primary": "#f59e0b",
    "--brand-primary-hover": "#d97706",
    "--brand-primary-light": "#fcd34d",
    "--brand-primary-glow": "rgba(245, 158, 11, 0.15)",
    "--brand-secondary": "#f97316",
    "--brand-secondary-light": "#ffedd5"
  },
  slate: {
    "--brand-bg": "#18181b",
    "--brand-primary": "#a1a1aa",
    "--brand-primary-hover": "#71717a",
    "--brand-primary-light": "#e4e4e7",
    "--brand-primary-glow": "rgba(161, 161, 170, 0.15)",
    "--brand-secondary": "#d4d4d8",
    "--brand-secondary-light": "#f4f4f5"
  },
  blue: {
    "--brand-bg": "#031424",
    "--brand-primary": "#3b82f6",
    "--brand-primary-hover": "#2563eb",
    "--brand-primary-light": "#60a5fa",
    "--brand-primary-glow": "rgba(59, 130, 246, 0.15)",
    "--brand-secondary": "#06b6d4",
    "--brand-secondary-light": "#67e8f9"
  }
};

/** Applies a theme's CSS variables as inline styles on the given element and
 *  on <html>, guaranteeing an immediate, reliable repaint. */
export function applyTheme(el: HTMLElement | null, theme: ThemeColor): void {
  const vars = THEME_VARS[theme];
  const targets = [document.documentElement, el].filter((x): x is HTMLElement => !!x);
  for (const target of targets) {
    for (const [prop, value] of Object.entries(vars)) {
      target.style.setProperty(prop, value);
    }
  }
}
