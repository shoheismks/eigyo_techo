const CONTACT_PATH_HINTS = ['contact', 'inquiry', 'toiawase', 'お問い合わせ', '問合せ'];
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RATE_LIMIT_MS = 900;

export async function discoverPublicContactsFromWebsite(websiteUrl) {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);

  if (!normalizedUrl) {
    return {
      status: 'failed',
      message: '公式サイトURLを入力してください',
      email: '',
      inquiryUrl: '',
    };
  }

  await wait(RATE_LIMIT_MS);

  try {
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new Error(`Website fetch error: ${response.status}`);
    }

    const html = await response.text();

    return {
      status: 'matched',
      message: '公式サイトの公開情報から候補を抽出しました',
      email: extractPublicEmail(html),
      inquiryUrl: extractInquiryUrl(html, normalizedUrl),
    };
  } catch {
    return {
      status: 'failed',
      message: '公式サイトの取得に失敗しました。手動確認してください',
      email: '',
      inquiryUrl: buildFallbackContactUrl(normalizedUrl),
    };
  }
}

export function normalizeWebsiteUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function extractPublicEmail(html) {
  const matches = html.match(EMAIL_PATTERN) ?? [];
  const uniqueMatches = [...new Set(matches)].filter(
    (email) => !email.toLowerCase().endsWith('.png') && !email.toLowerCase().endsWith('.jpg'),
  );

  return uniqueMatches[0] ?? '';
}

function extractInquiryUrl(html, baseUrl) {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  const links = [...document.querySelectorAll('a[href]')];
  const contactLink = links.find((link) => {
    const href = link.getAttribute('href') ?? '';
    const label = link.textContent ?? '';
    return CONTACT_PATH_HINTS.some((hint) =>
      `${href} ${label}`.toLowerCase().includes(hint.toLowerCase()),
    );
  });

  if (!contactLink) {
    return buildFallbackContactUrl(baseUrl);
  }

  return new URL(contactLink.getAttribute('href'), baseUrl).toString();
}

function buildFallbackContactUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return `${url.origin}/contact`;
  } catch {
    return '';
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
