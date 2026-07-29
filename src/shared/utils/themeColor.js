export const DEFAULT_THEME_COLOR = '#2878ff';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hexColor) {
  const color = sanitizeThemeColor(hexColor);
  return {
    r: parseInt(color.slice(1, 3), 16),
    g: parseInt(color.slice(3, 5), 16),
    b: parseInt(color.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => clampChannel(value).toString(16).padStart(2, '0')).join('')}`;
}

function mixColor(hexColor, targetHexColor, weight = 0.5) {
  const source = hexToRgb(hexColor);
  const target = hexToRgb(targetHexColor);
  return rgbToHex({
    r: source.r * (1 - weight) + target.r * weight,
    g: source.g * (1 - weight) + target.g * weight,
    b: source.b * (1 - weight) + target.b * weight,
  });
}

export function sanitizeThemeColor(value) {
  const normalized = String(value || '').trim();
  return HEX_COLOR_PATTERN.test(normalized) ? normalized.toLowerCase() : DEFAULT_THEME_COLOR;
}

export function isValidThemeColor(value) {
  const normalized = String(value || '').trim();
  return normalized === '' || HEX_COLOR_PATTERN.test(normalized);
}

export function createThemeStyle(themeColor = DEFAULT_THEME_COLOR) {
  const accent = sanitizeThemeColor(themeColor);
  const rgb = hexToRgb(accent);
  const strong = mixColor(accent, '#ffffff', 0.36);

  return {
    '--blue': accent,
    '--blue-strong': strong,
    '--theme-accent': accent,
    '--theme-accent-strong': strong,
    '--theme-accent-soft': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`,
    '--theme-accent-muted': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
    '--theme-accent-border': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.48)`,
    '--theme-accent-border-strong': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.72)`,
    '--theme-accent-shadow': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.32)`,
    '--theme-accent-glow': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
  };
}
