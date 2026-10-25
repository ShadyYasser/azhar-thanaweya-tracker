export type Theme = 'light' | 'dark';

const KEY = 'theme';

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function currentTheme(): Theme {
  return stored() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyStoredTheme(): void {
  const t = stored();
  if (t) document.documentElement.dataset.theme = t;
}

export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}
