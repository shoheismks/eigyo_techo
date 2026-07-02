export async function discoverContactInfo(company) {
  if (!company?.website) {
    throw new Error('Website is required to discover contact info.');
  }

  // Future replacement point:
  // - fetch website HTML through a backend endpoint
  // - parse public mailto links and contact page candidates
  // - call a dedicated enrichment API
  await wait(600);

  const website = normalizeWebsite(company.website);
  const domain = new URL(website).hostname.replace(/^www\./, '');

  return {
    email: `info@${domain}`,
    emailType: 'public',
    inquiryUrl: buildContactUrl(website),
    contactStatus: '取得済',
  };
}

function normalizeWebsite(website) {
  if (/^https?:\/\//i.test(website)) {
    return website;
  }

  return `https://${website}`;
}

function buildContactUrl(website) {
  return `${website.replace(/\/$/, '')}/contact`;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
