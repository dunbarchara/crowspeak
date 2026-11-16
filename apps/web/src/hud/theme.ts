export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'crowspeak:theme';

/** The saved choice. Storage can be blocked (private windows), so every access is guarded. */
export function loadTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage unavailable: follow the system.
  }
  return 'system';
}

/** `system` removes the override so the CSS follows `prefers-color-scheme`. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Not persisted; the choice still applies for this visit.
  }
}

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return choice === 'system' ? 'light' : choice === 'light' ? 'dark' : 'system';
}
