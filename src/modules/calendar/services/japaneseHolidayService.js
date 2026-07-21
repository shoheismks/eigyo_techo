const WEEKDAY = {
  SUNDAY: 0,
  MONDAY: 1,
  SATURDAY: 6,
};

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function weekdayOf(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

function nthWeekday(year, month, weekday, nth) {
  const firstWeekday = weekdayOf(year, month, 1);
  return 1 + ((weekday - firstWeekday + 7) % 7) + (nth - 1) * 7;
}

function addDays(baseDateKey, days) {
  const parsed = parseDateKey(baseDateKey);
  if (!parsed) return '';
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() + days);
  return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function vernalEquinoxDay(year) {
  if (year <= 1979) return Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  if (year <= 2099) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return Math.floor(21.851 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnEquinoxDay(year) {
  if (year <= 1979) return Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  if (year <= 2099) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function baseHolidayEntries(year) {
  const entries = [
    [dateKey(year, 1, 1), '元日'],
    [dateKey(year, 2, 11), '建国記念の日'],
    [dateKey(year, 3, vernalEquinoxDay(year)), '春分の日'],
    [dateKey(year, 4, 29), year <= 1988 ? '天皇誕生日' : year <= 2006 ? 'みどりの日' : '昭和の日'],
    [dateKey(year, 5, 3), '憲法記念日'],
    [dateKey(year, 5, 4), year >= 2007 ? 'みどりの日' : '国民の休日'],
    [dateKey(year, 5, 5), 'こどもの日'],
    [dateKey(year, 9, autumnEquinoxDay(year)), '秋分の日'],
    [dateKey(year, 11, 3), '文化の日'],
    [dateKey(year, 11, 23), '勤労感謝の日'],
  ];

  if (year >= 2000) entries.push([dateKey(year, 1, nthWeekday(year, 1, WEEKDAY.MONDAY, 2)), '成人の日']);
  else entries.push([dateKey(year, 1, 15), '成人の日']);

  if (year >= 2020) entries.push([dateKey(year, 2, 23), '天皇誕生日']);
  else if (year >= 1989 && year <= 2018) entries.push([dateKey(year, 12, 23), '天皇誕生日']);

  if (year >= 2016 && year !== 2020 && year !== 2021) entries.push([dateKey(year, 8, 11), '山の日']);

  if (year === 2020) {
    entries.push([dateKey(2020, 7, 23), '海の日']);
    entries.push([dateKey(2020, 7, 24), 'スポーツの日']);
    entries.push([dateKey(2020, 8, 10), '山の日']);
  } else if (year === 2021) {
    entries.push([dateKey(2021, 7, 22), '海の日']);
    entries.push([dateKey(2021, 7, 23), 'スポーツの日']);
    entries.push([dateKey(2021, 8, 8), '山の日']);
  } else {
    if (year >= 2003) entries.push([dateKey(year, 7, nthWeekday(year, 7, WEEKDAY.MONDAY, 3)), '海の日']);
    else if (year >= 1996) entries.push([dateKey(year, 7, 20), '海の日']);

    if (year >= 2020) entries.push([dateKey(year, 10, nthWeekday(year, 10, WEEKDAY.MONDAY, 2)), 'スポーツの日']);
    else if (year >= 2000) entries.push([dateKey(year, 10, nthWeekday(year, 10, WEEKDAY.MONDAY, 2)), '体育の日']);
    else entries.push([dateKey(year, 10, 10), '体育の日']);
  }

  if (year >= 2003) entries.push([dateKey(year, 9, nthWeekday(year, 9, WEEKDAY.MONDAY, 3)), '敬老の日']);
  else entries.push([dateKey(year, 9, 15), '敬老の日']);

  if (year >= 1966) entries.push([dateKey(year, 2, 11), '建国記念の日']);
  if (year >= 1948) entries.push([dateKey(year, 11, 23), '勤労感謝の日']);

  return entries;
}

function buildHolidayMap(year) {
  const holidays = new Map();
  baseHolidayEntries(year)
    .filter(([key]) => {
      const parsed = parseDateKey(key);
      return parsed && parsed.year === year;
    })
    .forEach(([key, name]) => {
      holidays.set(key, name);
    });

  const sortedKeys = [...holidays.keys()].sort();

  sortedKeys.forEach((key) => {
    const parsed = parseDateKey(key);
    if (!parsed || weekdayOf(parsed.year, parsed.month, parsed.day) !== WEEKDAY.SUNDAY) return;
    let substituteKey = addDays(key, 1);
    while (holidays.has(substituteKey)) {
      substituteKey = addDays(substituteKey, 1);
    }
    const substitute = parseDateKey(substituteKey);
    if (substitute?.year === year) {
      holidays.set(substituteKey, '振替休日');
    }
  });

  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 2; day < daysInMonth; day += 1) {
      const current = dateKey(year, month, day);
      const previous = dateKey(year, month, day - 1);
      const next = dateKey(year, month, day + 1);
      if (!holidays.has(current) && holidays.has(previous) && holidays.has(next)) {
        holidays.set(current, '国民の休日');
      }
    }
  }

  return holidays;
}

const holidayCache = new Map();

export function getJapaneseHoliday(dateKeyValue) {
  const parsed = parseDateKey(dateKeyValue);
  if (!parsed) return null;
  if (!holidayCache.has(parsed.year)) {
    holidayCache.set(parsed.year, buildHolidayMap(parsed.year));
  }
  const name = holidayCache.get(parsed.year).get(dateKeyValue);
  return name ? { name } : null;
}

export function getCalendarDateMeta(dateKeyValue) {
  const parsed = parseDateKey(dateKeyValue);
  const holiday = getJapaneseHoliday(dateKeyValue);
  const weekday = parsed ? weekdayOf(parsed.year, parsed.month, parsed.day) : -1;
  return {
    holidayName: holiday?.name || '',
    isHoliday: Boolean(holiday),
    isSunday: weekday === WEEKDAY.SUNDAY,
    isSaturday: weekday === WEEKDAY.SATURDAY,
    weekday,
  };
}
