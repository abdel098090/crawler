// Themes. "Dark lab" is a dark navy theme with neon cyan, pink, blue and yellow.
// The default setting, "Dark lab while crawling", switches to Dark lab while the
// spider walks, and back to the system theme when it stops.

export type ThemeSetting = 'lab-crawl' | 'lab' | 'auto' | 'light' | 'dark';
export type AppliedTheme = 'lab' | 'light' | 'dark' | null; // null = follow the system

export function resolveTheme(setting: ThemeSetting, crawling: boolean): AppliedTheme {
  switch (setting) {
    case 'lab-crawl':
      return crawling ? 'lab' : null;
    case 'lab':
      return 'lab';
    case 'light':
      return 'light';
    case 'dark':
      return 'dark';
    default:
      return null;
  }
}

export function applyTheme(theme: AppliedTheme): void {
  const root = document.documentElement;
  if (theme === null) delete root.dataset.theme;
  else if (root.dataset.theme !== theme) root.dataset.theme = theme;
}
