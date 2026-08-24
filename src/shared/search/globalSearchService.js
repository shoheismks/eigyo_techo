import {
  compactSearchText,
  normalizeSearchCode,
  normalizeSearchText,
  uniqueSearchValues,
} from './searchNormalization.js';

export const GLOBAL_SEARCH_LIMITS = {
  customer: 5,
  contact: 5,
  product: 5,
  project: 3,
  quote: 3,
  salesOrder: 3,
  shipment: 3,
  inbound: 5,
  supplier: 3,
};

export const GLOBAL_SEARCH_LABELS = {
  customer: '顧客',
  contact: '担当者',
  product: '商品',
  project: '案件',
  quote: '見積',
  salesOrder: '受注',
  shipment: '出荷',
  inbound: '入荷予定',
  supplier: '仕入先',
};

const TYPE_ORDER = {
  customer: 1,
  contact: 2,
  product: 3,
  project: 4,
  quote: 5,
  salesOrder: 6,
  shipment: 7,
  inbound: 8,
  supplier: 9,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function byId(records = []) {
  return new Map(asArray(records).map((record) => [record.id, record]));
}

function customerName(customer) {
  return customer?.companyName || customer?.name || '';
}

function productName(product) {
  return [product?.productCode, product?.name].filter(Boolean).join(' / ') || product?.name || '';
}

function projectTitle(project) {
  return project?.projectName || project?.title || project?.name || project?.subject || '';
}

function quoteLineText(quote, productMap) {
  return asArray(quote.quoteLines || quote.lines).flatMap((line) => {
    const product = productMap.get(line.productId);
    return [
      line.productCode,
      line.productName,
      product?.productCode,
      product?.name,
    ];
  });
}

function orderLineText(order, productMap) {
  return asArray(order.salesOrderLines || order.lines).flatMap((line) => {
    const product = productMap.get(line.productId);
    return [
      line.productCode,
      line.productName,
      product?.productCode,
      product?.name,
    ];
  });
}

function latestTime(record) {
  return new Date(record?.updatedAt || record?.updated_at || record?.createdAt || record?.created_at || 0).getTime() || 0;
}

function entry(value, role = 'aux', label = '') {
  return { value, role, label };
}

function makeItem({ type, id, title, subtitle = '', badge = '', entries = [], routeData = {}, updatedAt = '' }) {
  return {
    key: `${type}:${id}`,
    type,
    id,
    title: title || '(名称未設定)',
    subtitle,
    badge,
    searchEntries: entries
      .filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim())
      .map((item) => ({
        ...item,
        normalized: normalizeSearchText(item.value),
        compact: compactSearchText(item.value),
        code: normalizeSearchCode(item.value),
      })),
    routeData: { type, id, ...routeData },
    updatedAt,
  };
}

export function buildGlobalSearchIndex({
  customers = [],
  contacts = [],
  products = [],
  projects = [],
  quotes = [],
  salesOrders = [],
  shipments = [],
  suppliers = [],
  inboundShipments = [],
  inboundShipmentLines = [],
} = {}) {
  const customerMap = byId(customers);
  const productMap = byId(products);
  const projectMap = byId(projects);
  const quoteMap = byId(quotes);
  const orderMap = byId(salesOrders);
  const inboundShipmentMap = byId(inboundShipments);

  const items = [];

  asArray(customers).forEach((customer) => {
    items.push(makeItem({
      type: 'customer',
      id: customer.id,
      title: customerName(customer),
      subtitle: [customer.customerCode, customer.industry, customer.area].filter(Boolean).join(' / '),
      badge: customer.status || customer.customerRank || customer.rank || '',
      entries: [
        entry(customer.customerCode, 'code', '顧客コード'),
        entry(customer.companyName, 'name', '会社名'),
        entry(customer.branchName, 'name', '支社/店舗'),
        entry(customer.industry, 'aux', '業種'),
        entry(customer.area, 'aux', 'エリア'),
        entry(customer.phone, 'aux', '電話'),
        entry(customer.email, 'aux', 'メール'),
        entry(customer.memo, 'aux', 'メモ'),
        entry(customer.companyNote, 'aux', '会社メモ'),
        ...uniqueSearchValues(customer.tags).map((tag) => entry(tag, 'aux', 'タグ')),
      ],
      routeData: { page: 'CustomerKarte', customerId: customer.id },
      updatedAt: customer.updatedAt,
    }));
  });

  asArray(contacts).forEach((contact) => {
    const customer = customerMap.get(contact.customerId);
    items.push(makeItem({
      type: 'contact',
      id: contact.id,
      title: contact.name || contact.companyName || '担当者',
      subtitle: [customerName(customer) || contact.companyName, contact.department, contact.position || contact.role].filter(Boolean).join(' / '),
      badge: '担当者',
      entries: [
        entry(contact.name, 'name', '担当者名'),
        entry(contact.companyName, 'related', '会社名'),
        entry(customerName(customer), 'related', '顧客'),
        entry(contact.department, 'aux', '部署'),
        entry(contact.position || contact.role, 'aux', '役職'),
        entry(contact.phone, 'aux', '電話'),
        entry(contact.email, 'aux', 'メール'),
        entry(contact.memo, 'aux', 'メモ'),
      ],
      routeData: { page: customer ? 'CustomerKarte' : 'Contacts', customerId: contact.customerId || '', searchText: contact.name || contact.companyName || '' },
      updatedAt: contact.updatedAt,
    }));
  });

  asArray(products).forEach((product) => {
    items.push(makeItem({
      type: 'product',
      id: product.id,
      title: productName(product),
      subtitle: [product.brandName, product.category, product.manufacturerName, product.origin].filter(Boolean).join(' / '),
      badge: product.temperatureZone || '',
      entries: [
        entry(product.productCode, 'code', '商品コード'),
        entry(product.name, 'name', '商品名'),
        entry(product.brandName, 'name', 'ブランド'),
        entry(product.category, 'aux', 'カテゴリ'),
        entry(product.manufacturerName, 'aux', 'メーカー'),
        entry(product.origin, 'aux', '産地'),
        entry(product.memo, 'aux', 'メモ'),
        ...uniqueSearchValues(product.tags).map((tag) => entry(tag, 'aux', 'タグ')),
      ],
      routeData: { page: 'ProductDetail', productId: product.id },
      updatedAt: product.updatedAt,
    }));
  });

  asArray(projects).forEach((project) => {
    const customer = customerMap.get(project.customerId);
    const title = projectTitle(project);
    items.push(makeItem({
      type: 'project',
      id: project.id,
      title: title || '案件',
      subtitle: [customerName(customer), project.status].filter(Boolean).join(' / '),
      badge: project.status || '',
      entries: [
        entry(project.projectCode, 'code', '案件コード'),
        entry(title, 'name', '案件名'),
        entry(project.status, 'aux', 'ステータス'),
        entry(project.memo, 'aux', 'メモ'),
        entry(customerName(customer), 'related', '顧客'),
      ],
      routeData: { page: 'Pipeline', customerId: project.customerId || '', searchText: title || customerName(customer) },
      updatedAt: project.updatedAt,
    }));
  });

  asArray(quotes).forEach((quote) => {
    const customer = customerMap.get(quote.customerId);
    const project = projectMap.get(quote.projectId);
    const title = quote.quoteNumber || quote.projectName || '見積';
    items.push(makeItem({
      type: 'quote',
      id: quote.id,
      title,
      subtitle: [customerName(customer), quote.projectName || projectTitle(project), quote.status].filter(Boolean).join(' / '),
      badge: quote.status || '',
      entries: [
        entry(quote.quoteNumber, 'code', '見積番号'),
        entry(quote.projectName || projectTitle(project), 'name', '案件'),
        entry(quote.status, 'aux', 'ステータス'),
        entry(customerName(customer), 'related', '顧客'),
        ...quoteLineText(quote, productMap).map((value) => entry(value, 'related', '商品')),
      ],
      routeData: { page: 'Quotes', searchText: quote.quoteNumber || quote.projectName || customerName(customer) },
      updatedAt: quote.updatedAt,
    }));
  });

  asArray(salesOrders).forEach((order) => {
    const customer = customerMap.get(order.customerId);
    const project = projectMap.get(order.projectId);
    const sourceQuote = quoteMap.get(order.quoteId || order.sourceQuoteId);
    const title = order.salesOrderNumber || order.subject || order.title || '受注';
    items.push(makeItem({
      type: 'salesOrder',
      id: order.id,
      title,
      subtitle: [customerName(customer), order.subject || order.title, order.status].filter(Boolean).join(' / '),
      badge: order.status || '',
      entries: [
        entry(order.salesOrderNumber, 'code', '受注番号'),
        entry(order.subject || order.title, 'name', '件名'),
        entry(order.status, 'aux', 'ステータス'),
        entry(order.sourceSnapshot?.quoteNumber || sourceQuote?.quoteNumber, 'related', '元見積'),
        entry(customerName(customer), 'related', '顧客'),
        entry(projectTitle(project), 'related', '案件'),
        ...orderLineText(order, productMap).map((value) => entry(value, 'related', '商品')),
      ],
      routeData: { page: 'SalesOrders', searchText: order.salesOrderNumber || order.subject || customerName(customer) },
      updatedAt: order.updatedAt,
    }));
  });

  asArray(shipments).forEach((shipment) => {
    const order = orderMap.get(shipment.salesOrderId);
    const customer = customerMap.get(shipment.customerId || order?.customerId);
    const title = shipment.shipmentNumber || order?.salesOrderNumber || '出荷';
    items.push(makeItem({
      type: 'shipment',
      id: shipment.id,
      title,
      subtitle: [customerName(customer), order?.salesOrderNumber, shipment.status].filter(Boolean).join(' / '),
      badge: shipment.status || '',
      entries: [
        entry(shipment.shipmentNumber, 'code', '出荷番号'),
        entry(order?.salesOrderNumber, 'related', '受注番号'),
        entry(order?.subject || order?.title, 'related', '受注件名'),
        entry(customerName(customer), 'related', '顧客'),
        entry(shipment.carrier, 'aux', '配送会社'),
        entry(shipment.trackingNumber, 'aux', '追跡番号'),
        entry(shipment.status, 'aux', 'ステータス'),
      ],
      routeData: { page: 'Shipments', searchText: shipment.shipmentNumber || order?.salesOrderNumber || customerName(customer) },
      updatedAt: shipment.updatedAt,
    }));
  });

  asArray(inboundShipments).forEach((shipment) => {
    items.push(makeItem({
      type: 'inbound',
      id: shipment.id,
      title: shipment.documentNumber || shipment.sourceFileName || '入荷予定',
      subtitle: [shipment.supplierName, shipment.issuedDate, shipment.status].filter(Boolean).join(' / '),
      badge: 'PDF',
      entries: [
        entry(shipment.documentNumber, 'code', '帳票番号'),
        entry(shipment.sourceFileName, 'name', 'ファイル名'),
        entry(shipment.supplierName, 'name', '仕入先'),
        entry(shipment.status, 'aux', 'ステータス'),
      ],
      routeData: { page: 'Inventory', inventoryAction: { tab: 'arrival', inboundShipmentId: shipment.id } },
      updatedAt: shipment.updatedAt,
    }));
  });

  asArray(inboundShipmentLines).forEach((line) => {
    const shipment = inboundShipmentMap.get(line.inboundShipmentId);
    const product = productMap.get(line.matchedProductId);
    items.push(makeItem({
      type: 'inbound',
      id: line.id,
      title: line.contractNo || line.productNameRaw || '入荷予定明細',
      subtitle: [shipment?.supplierName, line.productNameRaw || product?.name, line.warehouseName].filter(Boolean).join(' / '),
      badge: line.matchStatus || line.status || '',
      entries: [
        entry(line.contractNo, 'code', '契約No'),
        entry(shipment?.documentNumber, 'related', '帳票番号'),
        entry(shipment?.supplierName, 'related', '仕入先'),
        entry(line.brandNameRaw, 'name', 'ブランド'),
        entry(line.productNameRaw, 'name', '商品名'),
        entry(product?.productCode, 'related', '商品コード'),
        entry(product?.name, 'related', '商品マスター'),
        entry(line.warehouseName, 'aux', '倉庫'),
        entry(line.factoryNo, 'aux', '工場No'),
        entry(line.originCountry, 'aux', '原産国'),
      ],
      routeData: {
        page: 'Inventory',
        inventoryAction: {
          tab: 'arrival',
          inboundShipmentId: line.inboundShipmentId,
          inboundShipmentLineId: line.id,
        },
      },
      updatedAt: line.updatedAt,
    }));
  });

  asArray(suppliers).forEach((supplier) => {
    items.push(makeItem({
      type: 'supplier',
      id: supplier.id,
      title: supplier.name || '仕入先',
      subtitle: [supplier.supplierCode, supplier.supplierType, supplier.area || supplier.country].filter(Boolean).join(' / '),
      badge: supplier.supplierType || '',
      entries: [
        entry(supplier.supplierCode, 'code', '仕入先コード'),
        entry(supplier.name, 'name', '仕入先名'),
        entry(supplier.supplierType, 'aux', '種別'),
        entry(supplier.country || supplier.area, 'aux', '国/エリア'),
        entry(supplier.contactPerson, 'aux', '担当者'),
        entry(supplier.email, 'aux', 'メール'),
        entry(supplier.memo, 'aux', 'メモ'),
        ...uniqueSearchValues(supplier.tags).map((tag) => entry(tag, 'aux', 'タグ')),
      ],
      routeData: { page: 'Suppliers', searchText: supplier.name || supplier.supplierCode || '' },
      updatedAt: supplier.updatedAt,
    }));
  });

  return items;
}

function entryScore(entryItem, query) {
  if (!entryItem.normalized) return 0;
  const queryCode = normalizeSearchCode(query.raw);
  const queryCompact = compactSearchText(query.raw);
  const baseByRole = {
    code: 0,
    name: -90,
    related: -260,
    aux: -420,
  };
  const roleOffset = baseByRole[entryItem.role] ?? -420;

  if (entryItem.code && queryCode && entryItem.code === queryCode) return 1000 + roleOffset;
  if (entryItem.compact && queryCompact && entryItem.compact === queryCompact) return 900 + roleOffset;
  if (entryItem.code && queryCode && entryItem.code.startsWith(queryCode)) return 800 + roleOffset;
  if (entryItem.normalized.startsWith(query.normalized)) return 700 + roleOffset;
  if (entryItem.normalized.includes(query.normalized)) return 520 + roleOffset;
  if (entryItem.compact && queryCompact && entryItem.compact.includes(queryCompact)) return 500 + roleOffset;
  return 0;
}

export function scoreSearchResult(item, rawQuery) {
  const normalized = normalizeSearchText(rawQuery);
  if (!normalized) return null;
  const query = { raw: rawQuery, normalized };
  let best = null;

  item.searchEntries.forEach((entryItem) => {
    const score = entryScore(entryItem, query);
    if (score > 0 && (!best || score > best.score)) {
      best = {
        score,
        matchedField: entryItem.label,
        matchedValue: entryItem.value,
      };
    }
  });

  if (!best) return null;
  return {
    ...item,
    score: best.score,
    matchedField: best.matchedField,
    matchedValue: best.matchedValue,
  };
}

export function searchGlobalIndex(index = [], rawQuery = '') {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];

  return index
    .map((item) => scoreSearchResult(item, rawQuery))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const typeDiff = (TYPE_ORDER[a.type] || 99) - (TYPE_ORDER[b.type] || 99);
      if (typeDiff !== 0) return typeDiff;
      return latestTime(b) - latestTime(a);
    });
}

export function groupSearchResults(results = [], limits = GLOBAL_SEARCH_LIMITS) {
  const groups = [];
  const grouped = new Map();

  results.forEach((result) => {
    if (!grouped.has(result.type)) {
      grouped.set(result.type, { type: result.type, label: GLOBAL_SEARCH_LABELS[result.type] || result.type, results: [], total: 0 });
    }
    const group = grouped.get(result.type);
    group.total += 1;
    if (group.results.length < (limits[result.type] || 3)) {
      group.results.push(result);
    }
  });

  Object.keys(TYPE_ORDER).forEach((type) => {
    if (grouped.has(type)) groups.push(grouped.get(type));
  });

  return groups;
}
