// Theme presets: each overrides the accent CSS custom properties set in globals.css.
// "instrument" is the violet/brass lab-bench default; "midnight" is pure black
// with purple text. These are the only two themes.
export interface ThemePreset {
  id: string;
  label: string;
  /** Inline overrides. Themes defined in globals.css leave this empty. */
  vars: Record<string, string>;
  /** Swatch shown in the switcher. */
  swatch?: [string, string];
  /** Black-background themes: the code editor follows. */
  midnight?: boolean;
}

export const THEMES: ThemePreset[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    vars: {},
    swatch: ['#000000', '#c4b5fd'],
    midnight: true,
  },
  {
    id: 'instrument',
    label: 'Instrument (default)',
    vars: {
      '--color-violet': '#7352b8',
      '--color-violet-lit': '#a78bfa',
      '--color-violet-dim': '#2a2142',
      '--color-brass': '#c7a346',
      '--color-brass-lit': '#e8cc80',
      '--color-brass-dim': '#33291163',
    },
  },
];

export const THEME_STORAGE_KEY = 'simulyn.theme';
export const DEFAULT_THEME_ID = 'instrument';

export function isMidnight(themeId: string): boolean {
  return THEMES.find((t) => t.id === themeId)?.midnight === true;
}

/** Maps any stored id (including removed legacy themes) to a valid one. */
export function resolveThemeId(id: string | null | undefined): string {
  if (id === 'midnight-violet') return 'midnight';
  return THEMES.some((t) => t.id === id) ? (id as string) : DEFAULT_THEME_ID;
}

export function applyTheme(themeId: string) {
  const theme = THEMES.find((t) => t.id === resolveThemeId(themeId))!;
  const root = document.documentElement;
  // Clear whatever the previous preset set inline, so nothing leaks between themes.
  for (const preset of THEMES) {
    for (const key of Object.keys(preset.vars)) root.style.removeProperty(key);
  }
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = theme.id;
}
