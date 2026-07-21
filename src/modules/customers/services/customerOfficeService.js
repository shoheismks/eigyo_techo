export const OFFICE_TYPE_OPTIONS = [
  { value: 'head_office', label: '本社' },
  { value: 'branch', label: '支社' },
  { value: 'sales_office', label: '営業所' },
  { value: 'store', label: '店舗' },
  { value: 'factory', label: '工場' },
  { value: 'warehouse', label: '倉庫' },
  { value: 'other', label: 'その他' },
];

const OFFICE_TYPE_LABELS = Object.fromEntries(
  OFFICE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export function officeTypeLabel(value) {
  return OFFICE_TYPE_LABELS[value] ?? OFFICE_TYPE_LABELS.head_office;
}

export function isHeadOffice(customer = {}) {
  const explicitValue = customer.isHeadOffice ?? customer.is_head_office;
  if (typeof explicitValue === 'boolean') return explicitValue;
  return (customer.officeType ?? customer.office_type ?? 'head_office') === 'head_office' || !(customer.parentCustomerId || customer.parent_customer_id);
}

export function normalizeOfficeFields(customer = {}) {
  const parentCustomerId = customer.parentCustomerId ?? customer.parent_customer_id ?? '';
  const officeType = customer.officeType ?? customer.office_type ?? (parentCustomerId ? 'branch' : 'head_office');
  const normalizedOfficeType = officeType || 'head_office';
  const normalizedIsHeadOffice = normalizedOfficeType === 'head_office';

  return {
    parentCustomerId: normalizedIsHeadOffice ? '' : parentCustomerId,
    officeType: normalizedOfficeType,
    branchName: customer.branchName ?? customer.branch_name ?? '',
    branchCode: customer.branchCode ?? customer.branch_code ?? '',
    isHeadOffice: normalizedIsHeadOffice,
    billingCustomerId: customer.billingCustomerId ?? customer.billing_customer_id ?? '',
    shippingCustomerId: customer.shippingCustomerId ?? customer.shipping_customer_id ?? '',
  };
}

export function displayCustomerOfficeName(customer = {}) {
  const companyName = customer.companyName || customer.company_name || '';
  const branchName = customer.branchName || customer.branch_name || '';
  if (!branchName || isHeadOffice(customer)) return companyName;
  return `${companyName} ${branchName}`;
}

export function getParentCustomer(customer = {}, customers = []) {
  const parentId = customer.parentCustomerId || customer.parent_customer_id;
  return customers.find((item) => item.id === parentId) || null;
}

export function getChildOffices(customer = {}, customers = []) {
  return customers.filter((item) => (item.parentCustomerId || item.parent_customer_id) === customer.id);
}

export function getSiblingOffices(customer = {}, customers = []) {
  const parentId = customer.parentCustomerId || customer.parent_customer_id;
  if (!parentId) return [];
  return customers.filter((item) => item.id !== customer.id && (item.parentCustomerId || item.parent_customer_id) === parentId);
}

export function getCustomerGroupIds(customerId, customers = []) {
  const customer = customers.find((item) => item.id === customerId);
  if (!customer) return [customerId].filter(Boolean);

  const rootId = customer.parentCustomerId || customer.parent_customer_id || customer.id;
  return [
    rootId,
    ...customers
      .filter((item) => (item.parentCustomerId || item.parent_customer_id) === rootId)
      .map((item) => item.id),
  ].filter(Boolean);
}

export function isValidParentCustomer(customerId, parentCustomerId, customers = []) {
  if (!parentCustomerId) return true;
  if (customerId && customerId === parentCustomerId) return false;

  const parent = customers.find((item) => item.id === parentCustomerId);
  if (!parent) return false;

  return isHeadOffice(parent) && !(parent.parentCustomerId || parent.parent_customer_id);
}

export function validateOfficeAssignment(customer, customers = []) {
  const officeType = customer.officeType || 'head_office';
  const parentCustomerId = customer.parentCustomerId || '';

  if (officeType === 'head_office') return '';
  if (!parentCustomerId) return '本社を選択してください。';
  if (!isValidParentCustomer(customer.id, parentCustomerId, customers)) {
    return '親に指定できるのは同一ユーザーの本社のみです。';
  }
  return '';
}

export function buildHierarchicalCustomers(customers = []) {
  const roots = customers.filter((customer) => !customer.parentCustomerId);
  const childrenByParent = customers.reduce((map, customer) => {
    if (!customer.parentCustomerId) return map;
    const children = map.get(customer.parentCustomerId) ?? [];
    children.push(customer);
    map.set(customer.parentCustomerId, children);
    return map;
  }, new Map());
  const emitted = new Set();
  const rows = [];

  roots.forEach((root) => {
    rows.push({ ...root, officeDepth: 0 });
    emitted.add(root.id);
    (childrenByParent.get(root.id) ?? []).forEach((child) => {
      rows.push({ ...child, officeDepth: 1 });
      emitted.add(child.id);
    });
  });

  customers.forEach((customer) => {
    if (!emitted.has(customer.id)) {
      rows.push({ ...customer, officeDepth: customer.parentCustomerId ? 1 : 0 });
    }
  });

  return rows;
}
