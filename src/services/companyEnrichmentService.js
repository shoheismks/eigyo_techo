const NTA_API_BASE_URL =
  import.meta.env.VITE_NTA_CORPORATE_API_URL ||
  'https://api.houjin-bangou.nta.go.jp/4/name';
const NTA_APP_ID = import.meta.env.VITE_NTA_CORPORATE_APP_ID || '';
const GBIZINFO_API_BASE_URL =
  import.meta.env.VITE_GBIZINFO_API_URL ||
  'https://info.gbiz.go.jp/hojin/v1/hojin';
const GBIZINFO_API_KEY = import.meta.env.VITE_GBIZINFO_API_KEY || '';

const RATE_LIMIT_MS = 900;

export function parseCompanyNames(text) {
  return text
    .split(/\r?\n|,|、/)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index);
}

export async function enrichCompaniesByName(names) {
  const results = [];

  for (const name of names) {
    const ntaResult = await fetchCorporateNumberByName(name);
    const baseCompany = ntaResult.company ?? buildManualCompany(name);

    results.push({
      ...baseCompany,
      source: ntaResult.company ? '国税庁 法人番号API' : 'Manual',
      enrichmentStatus: ntaResult.status,
      enrichmentMessage: ntaResult.message,
      googleSearchUrl: buildGoogleSearchUrl(baseCompany.companyName || name),
      gbizInfoUrl: buildGBizInfoSearchUrl(baseCompany.companyName || name),
    });

    await wait(RATE_LIMIT_MS);
  }

  return results;
}

export async function fetchCorporateNumberByName(companyName) {
  if (!NTA_APP_ID) {
    return {
      status: 'manual',
      message: '国税庁APIのアプリケーションIDが未設定です',
      company: null,
    };
  }

  const url = new URL(NTA_API_BASE_URL);
  url.searchParams.set('id', NTA_APP_ID);
  url.searchParams.set('name', companyName);
  url.searchParams.set('type', '12');
  url.searchParams.set('mode', '2');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`NTA API error: ${response.status}`);
    }

    const text = await response.text();
    const parsedCompany = parseNtaResponse(text, companyName);

    if (!parsedCompany) {
      return {
        status: 'not-found',
        message: '法人番号APIで候補が見つかりませんでした',
        company: null,
      };
    }

    return {
      status: 'matched',
      message: '法人番号APIから取得しました',
      company: parsedCompany,
    };
  } catch {
    return {
      status: 'failed',
      message: '法人番号APIの取得に失敗しました',
      company: null,
    };
  }
}

export async function fetchGBizInfoCompany(corporateNumber) {
  if (!GBIZINFO_API_KEY || !corporateNumber) {
    return {
      status: 'manual',
      message: 'gBizINFO APIキーまたは法人番号が未設定です',
      data: null,
    };
  }

  const url = new URL(GBIZINFO_API_BASE_URL);
  url.searchParams.set('corporate_number', corporateNumber);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'X-hojinInfo-api-token': GBIZINFO_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`gBizINFO API error: ${response.status}`);
    }

    return {
      status: 'matched',
      message: 'gBizINFOから取得しました',
      data: await response.json(),
    };
  } catch {
    return {
      status: 'failed',
      message: 'gBizINFOの取得に失敗しました',
      data: null,
    };
  }
}

export function buildGoogleSearchUrl(companyName) {
  const query = `${companyName} 公式サイト`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function buildGBizInfoSearchUrl(companyName) {
  return `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=&name=${encodeURIComponent(companyName)}`;
}

export function toCustomerFromEnrichedCompany(company) {
  return {
    id: company.id || crypto.randomUUID(),
    placeId: '',
    corporateNumber: company.corporateNumber || '',
    companyName: company.companyName || '',
    industry: company.industry || '',
    area: company.area || '',
    address: company.address || '',
    phone: company.phone || '',
    website: company.website || '',
    email: company.email || '',
    emailType: company.email ? 'public' : '',
    inquiryUrl: company.inquiryUrl || '',
    status: '未接触',
    memo: company.memo || company.enrichmentMessage || '',
    source: company.source || 'Free Enrichment',
    contactStatus: company.email || company.inquiryUrl ? '取得済' : '未取得',
    lastContactDate: '',
    nextFollowDate: '',
    pipelineMemo: '',
    createdAt: new Date().toISOString(),
  };
}

function parseNtaResponse(text, fallbackName) {
  if (!text.trim()) {
    return null;
  }

  if (text.trim().startsWith('<')) {
    return parseNtaXml(text, fallbackName);
  }

  return parseNtaCsv(text, fallbackName);
}

function parseNtaXml(text, fallbackName) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  const corporation = xml.querySelector('corporation');

  if (!corporation) {
    return null;
  }

  const corporateNumber = getXmlText(corporation, 'corporateNumber');
  const companyName = getXmlText(corporation, 'name') || fallbackName;
  const prefectureName = getXmlText(corporation, 'prefectureName');
  const cityName = getXmlText(corporation, 'cityName');
  const streetNumber = getXmlText(corporation, 'streetNumber');
  const address = [prefectureName, cityName, streetNumber].filter(Boolean).join('');

  return buildManualCompany(companyName, {
    corporateNumber,
    area: [prefectureName, cityName].filter(Boolean).join(''),
    address,
  });
}

function parseNtaCsv(text, fallbackName) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstDataLine = lines.find((line) => !line.startsWith('sequenceNumber'));
  if (!firstDataLine) {
    return null;
  }

  const columns = firstDataLine.split(',').map((column) => column.replace(/^"|"$/g, ''));
  const corporateNumber = columns[1] || '';
  const companyName = columns[6] || fallbackName;
  const prefectureName = columns[9] || '';
  const cityName = columns[10] || '';
  const streetNumber = columns[11] || '';

  return buildManualCompany(companyName, {
    corporateNumber,
    area: [prefectureName, cityName].filter(Boolean).join(''),
    address: [prefectureName, cityName, streetNumber].filter(Boolean).join(''),
  });
}

function buildManualCompany(companyName, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    corporateNumber: '',
    companyName,
    industry: '',
    area: '',
    address: '',
    phone: '',
    website: '',
    email: '',
    inquiryUrl: '',
    memo: '',
    ...overrides,
  };
}

function getXmlText(element, selector) {
  return element.querySelector(selector)?.textContent?.trim() ?? '';
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
