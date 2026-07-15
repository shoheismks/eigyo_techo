export function normalizeBusinessCode(value) {
  return String(value ?? '').trim();
}

export function isValidBusinessCode(value) {
  const code = normalizeBusinessCode(value);
  return !code || /^[\x21-\x7E]+$/.test(code);
}

export function hasDuplicateBusinessCode(records = [], field, value, currentId = '') {
  const code = normalizeBusinessCode(value).toLowerCase();
  if (!code) return false;

  return records.some((record) => {
    if (currentId && record.id === currentId) return false;
    return normalizeBusinessCode(record[field]).toLowerCase() === code;
  });
}

export function businessCodeFormatMessage(label = 'コード') {
  return `${label}は半角英数字と記号のみ使用できます。日本語、全角文字、空白は使えません。`;
}

export function businessCodeDuplicateMessage(label = 'コード') {
  return `同じ${label}が既に登録されています。別の${label}を入力してください。`;
}
