import { PIPELINE_STATUSES } from '../modules/deals/constants.js';

function isOpenComplaint(complaint) {
  return !['解決', '完了', 'closed', 'resolved'].includes(complaint.status);
}

function isOverdue(dateValue) {
  if (!dateValue) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date < today;
}

export function buildAnalyticsSummary({
  customers = [],
  products = [],
  contacts = [],
  suppliers = [],
  complaints = [],
  quotes = [],
  samples = [],
}) {
  const statusCounts = PIPELINE_STATUSES.map((status) => ({
    status,
    count: customers.filter((customer) => customer.status === status).length,
  }));
  const highRankCount = customers.filter((customer) => ['S', 'A'].includes(customer.customerRank)).length;
  const complaintOpenCount = complaints.filter(isOpenComplaint).length;
  const overdueQuoteCount = quotes.filter((quote) => isOverdue(quote.validUntil)).length;
  const sampleFollowCount = samples.filter((sample) => isOverdue(sample.followUpDate)).length;
  const topCustomers = [...customers]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);

  return {
    statusCounts,
    highRankCount,
    complaintOpenCount,
    overdueQuoteCount,
    sampleFollowCount,
    topCustomers,
    totals: {
      customers: customers.length,
      products: products.length,
      contacts: contacts.length,
      suppliers: suppliers.length,
      quotes: quotes.length,
      samples: samples.length,
    },
  };
}
