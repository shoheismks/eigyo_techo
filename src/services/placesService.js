const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

const mockPlaces = [
  {
    id: 'mock-aoyama-cloud',
    placeId: 'mock_place_aoyama_cloud',
    companyName: '青山クラウド会計',
    industry: '会計・バックオフィス',
    area: '東京都港区',
    address: '東京都港区南青山2-14-8',
    phone: '03-4400-1280',
    website: 'https://aoyama-cloud.example',
    email: 'contact@aoyama-cloud.example',
    emailType: 'mock',
    inquiryUrl: 'https://aoyama-cloud.example/contact',
    status: '未接触',
    memo: '',
    source: 'Mock',
    contactStatus: '取得済',
    createdAt: '',
  },
  {
    id: 'mock-yokohama-logi',
    placeId: 'mock_place_yokohama_logi',
    companyName: '横浜物流ソリューションズ',
    industry: '物流・倉庫',
    area: '神奈川県横浜市',
    address: '神奈川県横浜市中区海岸通3-9',
    phone: '045-330-2214',
    website: 'https://yokohama-logi.example',
    email: 'sales@yokohama-logi.example',
    emailType: 'mock',
    inquiryUrl: 'https://yokohama-logi.example/inquiry',
    status: '未接触',
    memo: '',
    source: 'Mock',
    contactStatus: '取得済',
    createdAt: '',
  },
  {
    id: 'mock-kitasenju-care',
    placeId: 'mock_place_kitasenju_care',
    companyName: '北千住メディカルケア',
    industry: '医療・介護',
    area: '東京都足立区',
    address: '東京都足立区千住1-22-5',
    phone: '03-5600-9022',
    website: 'https://kitasenju-care.example',
    email: '',
    emailType: '',
    inquiryUrl: 'https://kitasenju-care.example/contact',
    status: '未接触',
    memo: '',
    source: 'Mock',
    contactStatus: '未取得',
    createdAt: '',
  },
  {
    id: 'mock-saitama-dx',
    placeId: 'mock_place_saitama_dx',
    companyName: 'さいたまDX工房',
    industry: '製造業',
    area: '埼玉県さいたま市',
    address: '埼玉県さいたま市大宮区桜木町4-201',
    phone: '048-700-1888',
    website: 'https://saitama-dx.example',
    email: '',
    emailType: '',
    inquiryUrl: '',
    status: '未接触',
    memo: '',
    source: 'Mock',
    contactStatus: '未取得',
    createdAt: '',
  },
  {
    id: 'mock-shinjuku-hr',
    placeId: 'mock_place_shinjuku_hr',
    companyName: '新宿HRパートナーズ',
    industry: '人材・採用支援',
    area: '東京都新宿区',
    address: '東京都新宿区西新宿6-12-1',
    phone: '03-5900-7300',
    website: 'https://shinjuku-hr.example',
    email: 'partners@shinjuku-hr.example',
    emailType: 'mock',
    inquiryUrl: 'https://shinjuku-hr.example/inquiry',
    status: '未接触',
    memo: '',
    source: 'Mock',
    contactStatus: '取得済',
    createdAt: '',
  },
];

export function getFallbackAreas() {
  return ['すべて', ...new Set(mockPlaces.map((place) => place.area))];
}

export async function searchPlaces({ query = '', area = 'すべて' } = {}) {
  const trimmedQuery = query.trim();

  if (!GOOGLE_PLACES_API_KEY) {
    return {
      results: searchMockPlaces({ query: trimmedQuery, area }),
      source: 'Mock',
      usingFallback: true,
    };
  }

  try {
    const results = await searchGooglePlaces({ query: trimmedQuery, area });
    return {
      results,
      source: 'Google Places',
      usingFallback: false,
    };
  } catch (error) {
    return {
      results: searchMockPlaces({ query: trimmedQuery, area }),
      source: 'Mock',
      usingFallback: true,
      error,
    };
  }
}

function searchMockPlaces({ query, area }) {
  const normalizedQuery = query.toLowerCase();

  return mockPlaces.filter((place) => {
    const matchesArea = area === 'すべて' || place.area === area;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [place.companyName, place.industry, place.address, place.area]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesArea && matchesQuery;
  });
}

async function searchGooglePlaces({ query, area }) {
  const textQuery = [query || '会社', area !== 'すべて' ? area : ''].filter(Boolean).join(' ');

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.types',
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'ja',
      regionCode: 'JP',
      maxResultCount: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Places request failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.places ?? []).map(mapGooglePlace);
}

function mapGooglePlace(place) {
  const website = place.websiteUri ?? '';

  return {
    id: place.id || crypto.randomUUID(),
    placeId: place.id ?? '',
    companyName: place.displayName?.text ?? '名称未取得',
    industry: mapIndustry(place.types),
    area: extractArea(place.formattedAddress ?? ''),
    address: place.formattedAddress ?? '',
    phone: place.nationalPhoneNumber ?? '',
    website,
    email: '',
    emailType: '',
    inquiryUrl: '',
    status: '未接触',
    memo: '',
    source: 'Google Places',
    contactStatus: '未取得',
    createdAt: '',
  };
}

function mapIndustry(types = []) {
  const typeText = types.join(' ');

  if (typeText.includes('restaurant') || typeText.includes('food')) return '飲食';
  if (typeText.includes('health') || typeText.includes('doctor')) return '医療・ヘルスケア';
  if (typeText.includes('store')) return '小売';
  if (typeText.includes('finance') || typeText.includes('accounting')) return '金融・会計';

  return '業種未取得';
}

function extractArea(address) {
  const prefectureMatch = address.match(/(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/);
  if (!prefectureMatch) return 'エリア未取得';

  const start = prefectureMatch.index ?? 0;
  const cityMatch = address.slice(start).match(/^(.+?[市区町村])/);
  return cityMatch?.[1] ?? prefectureMatch[1];
}
