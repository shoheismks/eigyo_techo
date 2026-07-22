const COMPANY_SUFFIX = '御中';
const CONTACT_SUFFIX = '様';
const COMPANY_SUFFIX_PATTERN = /(御中|様)\s*$/;
const CONTACT_SUFFIX_PATTERN = /(様|御中)\s*$/;

function clean(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function appendSuffix(value, suffix, pattern) {
  const text = clean(value);
  if (!text) return '';
  return pattern.test(text) ? text : `${text} ${suffix}`;
}

export function recipientLinesToText(lines = []) {
  return lines.filter(Boolean).join('\n');
}

export function formatDocumentRecipient({
  companyName = '',
  branchName = '',
  departmentName = '',
  contactName = '',
} = {}) {
  const companyBase = [clean(companyName), clean(branchName)].filter(Boolean).join(' ');
  const contactBase = [clean(departmentName), clean(contactName)].filter(Boolean).join(' ');
  const lines = [];

  if (companyBase) {
    lines.push(appendSuffix(companyBase, COMPANY_SUFFIX, COMPANY_SUFFIX_PATTERN));
  }

  if (contactBase) {
    lines.push(appendSuffix(contactBase, CONTACT_SUFFIX, CONTACT_SUFFIX_PATTERN));
  }

  return {
    companyLine: lines[0] || '',
    contactLine: lines.length > 1 ? lines[1] : (!companyBase ? lines[0] || '' : ''),
    lines,
    text: recipientLinesToText(lines),
  };
}

export function formatRecipientFromCustomerAndContact(customer = {}, contact = {}) {
  return formatDocumentRecipient({
    companyName: customer?.companyName || customer?.name || '',
    branchName: customer?.branchName || '',
    departmentName: contact?.departmentName || contact?.department || '',
    contactName: contact?.name || contact?.contactName || '',
  });
}
