const HYPHEN_PATTERN = /[\u2010-\u2015\u2212\uff0d\u30fc]/g;
const SPACE_PATTERN = /\s+/g;

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(HYPHEN_PATTERN, '-')
    .trim()
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
    .replace(SPACE_PATTERN, ' ');
}

export function normalizeSearchCode(value) {
  return normalizeSearchText(value).replace(/[\s-]/g, '');
}

export function compactSearchText(value) {
  return normalizeSearchText(value).replace(/\s/g, '');
}

export function uniqueSearchValues(values = []) {
  const safeValues = Array.isArray(values) ? values : values == null ? [] : [values];
  const seen = new Set();
  return safeValues
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeSearchText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
