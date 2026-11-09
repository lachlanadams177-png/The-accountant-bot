/**
 * Muscle Up Strength & Conditioning — design tokens for JavaScript.
 * Keep in sync with the @theme block in src/index.css (CSS is the source of truth
 * for Tailwind classes; these are for SVG/charts where class names can't be used).
 */
export const theme = {
  black: '#111111',
  white: '#ffffff',
  canvas: '#f3f3f3',
  lightGrey: '#e8e8e8',
  mediumGrey: '#a3a3a3',
  secondaryText: '#666666',
  border: '#e2e2e2',
  gridLine: '#ececec',
} as const

export const BRAND = {
  name: 'Muscle Up Strength & Conditioning',
  short: 'MUSCLE UP',
  tagline: 'STRENGTH & CONDITIONING',
} as const
