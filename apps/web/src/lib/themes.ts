// Theme presets: each overrides the accent CSS custom properties set in globals.css.
// "instrument" is the existing violet/brass lab-bench default; the rest are
// user-selectable palettes for the theme customizer.
export interface ThemePreset {
  id: string;
  label: string;
  vars: Record<string, string>;
}

export const THEMES: ThemePreset[] = [
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
  {
    id: 'purple-gold',
    label: 'Purple / Gold',
    vars: {
      '--color-violet': '#5b3fa6',
      '--color-violet-lit': '#b57bff',
      '--color-violet-dim': '#1a0d3d',
      '--color-brass': '#c7a346',
      '--color-brass-lit': '#f5e4b0',
      '--color-brass-dim': '#33291163',
    },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    vars: {
      '--color-violet': '#5a6478',
      '--color-violet-lit': '#a9b4c9',
      '--color-violet-dim': '#22262f',
      '--color-brass': '#8f8f8f',
      '--color-brass-lit': '#d4d4d4',
      '--color-brass-dim': '#2a2a2a63',
    },
  },
  {
    id: 'emerald',
    label: 'Emerald / Brass',
    vars: {
      '--color-violet': '#2f8f6b',
      '--color-violet-lit': '#5eead4',
      '--color-violet-dim': '#123028',
      '--color-brass': '#c7a346',
      '--color-brass-lit': '#e8cc80',
      '--color-brass-dim': '#33291163',
    },
  },
];

export const THEME_STORAGE_KEY = 'simulyn.theme';
export const DEFAULT_THEME_ID = THEMES[0].id;

export function applyTheme(themeId: string) {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = theme.id;
}
