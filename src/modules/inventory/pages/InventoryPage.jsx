import { useEffect, useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { formatPrice, productDisplayName } from '../../products/hooks/useProducts.js';
import {
  INVENTORY_INBOUND_REASONS,
  INVENTORY_OUTBOUND_REASONS,
  INVENTORY_STATUSES,
  INVENTORY_TYPES,
  INVENTORY_UNITS,
  appendInventoryMovement,
  emptyInventory,
  inventoryAvailableQuantity,
  isValidInventoryCode,
  normalizeInventory,
  normalizeInventoryCode,
} from '../hooks/useInventory.js';
import {
  buildPlannedInventoryRows,
  formatPlannedQuantity,
} from '../services/plannedInventoryService.js';
import { buildInboundAnalysis } from '../services/inboundAnalysisService.js';
import { matchInboundPreview, productMatchStatusLabel } from '../services/inboundProductMatcher.js';
import InboundProductCreateDialog from '../components/InboundProductCreateDialog.jsx';
import InboundProductAliasDialog from '../components/InboundProductAliasDialog.jsx';
import InboundPlanList from '../components/InboundPlanList.jsx';
import '../components/inbound-ui.css';

const TABS = [
  { key: 'list', label: '在庫一覧' },
  { key: 'arrival', label: '入荷予定' },
  { key: 'analysis', label: '入荷分析' },
  { key: 'inbound', label: '入庫' },
  { key: 'outbound', label: '出庫' },
  { key: 'stocktake', label: '棚卸' },
  { key: 'history', label: '入出庫履歴' },
];

const ALL = 'all';
const INBOUND_VIEWS = new Set(['list', 'import', 'detail']);

function inboundViewFromUrl() {
  if (typeof window === 'undefined') return { view: 'list', shipmentId: '' };
  const params = new URLSearchParams(window.location.search);
  const view = INBOUND_VIEWS.has(params.get('view')) ? params.get('view') : 'list';
  return { view, shipmentId: view === 'detail' ? params.get('id') || '' : '' };
}

function initialInventoryTab() {
  if (typeof window !== 'undefined') {
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some((tab) => tab.key === urlTab)) return urlTab;
  }
  return localStorage.getItem('eigyo-techo-inventory-tab') || 'list';
}

function writeInboundViewUrl(view, shipmentId = '', { replace = false } = {}) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('tab', 'arrival');
  if (view === 'list') {
    url.searchParams.delete('view');
    url.searchParams.delete('id');
  } else {
    url.searchParams.set('view', view);
    if (view === 'detail' && shipmentId) url.searchParams.set('id', shipmentId);
    else url.searchParams.delete('id');
  }
  window.history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
}
const ADJUSTMENT_REASONS = ['棚卸差異', '破損', '廃棄', 'サンプル使用', '入力ミス修正', 'その他'];
const SCHEDULE_CHANGE_REASONS = ['通関遅延', '船便遅延', '書類不備', '検査', '倉庫都合', '仕入先都合', 'その他'];
const SCHEDULE_CHANGE_ALLOWED_STATUSES = new Set(['pending', 'partially_received']);
const INBOUND_ANALYSIS_TOLERANCE_DAYS = 1;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysString(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyToNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function numberInputValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function formatQuantity(value, unit = '') {
  const numberValue = emptyToNumber(value);
  if (numberValue === null) return '-';
  return `${formatPrice(numberValue)}${unit ? ` ${unit}` : ''}`;
}

function lineRemainingWeight(line) {
  if (line?.remainingWeight !== null && line?.remainingWeight !== undefined) return Number(line.remainingWeight) || 0;
  return Math.max(parseNumber(line?.plannedWeight ?? line?.weight) - parseNumber(line?.receivedWeightTotal), 0);
}

function lineRemainingPieces(line) {
  if (line?.remainingPieces !== null && line?.remainingPieces !== undefined) return Number(line.remainingPieces) || 0;
  return Math.max(parseNumber(line?.plannedPieces ?? line?.quantityPieces) - parseNumber(line?.receivedPiecesTotal), 0);
}

function canReceiveInboundLine(line) {
  return Boolean(
    line &&
    line.matchedProductId &&
    ['matched', 'manual'].includes(line.matchStatus) &&
    !['excluded', 'skipped', 'cancelled', 'deleted', 'received'].includes(line.status),
  );
}

function canChangeInboundSchedule(line) {
  return Boolean(
    line &&
    SCHEDULE_CHANGE_ALLOWED_STATUSES.has(line.status || 'pending') &&
    !line.cancelledAt &&
    !line.deletedAt,
  );
}

function dateDiffDays(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function scheduleOriginalDate(line) {
  return line?.originalCustomsClearancePlannedDate || line?.customsClearancePlannedDate || '';
}

function scheduleCurrentDate(line) {
  return line?.customsClearancePlannedDate || '';
}

function scheduleDelayDays(line) {
  return dateDiffDays(scheduleOriginalDate(line), scheduleCurrentDate(line));
}

function scheduleDelayLabel(days) {
  if (days > 0) return `${days}日遅延`;
  if (days < 0) return `${Math.abs(days)}日前倒し`;
  return '予定通り';
}

function scheduleDelayBadgeClass(days) {
  if (days > 0) return 'warning';
  if (days < 0) return 'ready';
  return 'muted';
}

function varianceDayLabel(days) {
  if (days === null || days === undefined) return '-';
  if (days > 0) return `+${days}日`;
  return `${days}日`;
}

function inboundAnalysisStatusLabel(row) {
  if (row.completed) return '入荷完了';
  if (row.overdueDays > 0) return '遅延中';
  return inboundLineStatusLabel(row.status);
}

function inboundAnalysisStatusClass(row) {
  if (row.overdueDays > 0 || row.delayed) return 'danger';
  if (row.completed && row.onTime) return 'ready';
  if (row.completed) return 'warning';
  return 'muted';
}

function formatPercent(value) {
  return `${(Number(value) || 0).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}%`;
}

function buildScheduleForm(line) {
  return {
    inboundShipmentLineId: line?.id || '',
    newDate: scheduleCurrentDate(line),
    reason: SCHEDULE_CHANGE_REASONS[0],
    memo: '',
  };
}

function defaultReceiptLine(line) {
  const remainingWeight = lineRemainingWeight(line);
  const remainingPieces = lineRemainingPieces(line);
  return {
    inboundShipmentLineId: line.id,
    enabled: canReceiveInboundLine(line) && (remainingWeight > 0 || remainingPieces > 0),
    receivedPieces: remainingPieces > 0 ? String(remainingPieces) : '',
    receivedWeight: remainingWeight > 0 ? String(remainingWeight) : '',
    purchaseUnitCost: numberInputValue(line.unitPrice),
    expiryDate: line.expiryDate || '',
    warehouseName: line.warehouseName || '',
  };
}

function buildReceiptForm(shipment) {
  return {
    receivedAt: new Date().toISOString().slice(0, 16),
    warehouseName: shipment?.lines?.find((line) => line.warehouseName)?.warehouseName || '',
    memo: '',
    lines: (shipment?.lines || []).map(defaultReceiptLine),
  };
}

function textIncludes(value, keyword) {
  return String(value ?? '').toLowerCase().includes(keyword);
}

function expiryState(inventory) {
  if (!inventory.expiryDate) return '';
  const today = todayString();
  const soon = addDaysString(30);
  if (inventory.expiryDate < today) return 'expired';
  if (inventory.expiryDate <= soon) return 'expiring';
  return '';
}

function inventoryAlertClass(inventory) {
  const quantity = parseNumber(inventory.quantity);
  const safetyStock = parseNumber(inventory.safetyStock);
  const expiry = expiryState(inventory);
  if (quantity <= 0 || expiry === 'expired') return 'inventory-danger';
  if (safetyStock > 0 && quantity <= safetyStock) return 'inventory-warning';
  if (expiry === 'expiring') return 'inventory-expiring';
  return '';
}

function buildHistory(inventories, products, suppliers) {
  return inventories
    .flatMap((inventory) => {
      const product = products.find((item) => item.id === inventory.productId);
      const supplier = suppliers.find((item) => item.id === inventory.supplierId);
      const history = Array.isArray(inventory.movementHistory) ? inventory.movementHistory : [];

      if (history.length === 0) {
        return [{
          id: `created-${inventory.id}`,
          date: inventory.receivedDate || inventory.createdAt || inventory.updatedAt,
          type: '登録',
          quantity: inventory.quantity,
          unit: inventory.unit,
          reason: inventory.inventoryStatus,
          handlerName: inventory.handlerName || inventory.createdByName,
          memo: inventory.memo,
          productName: productDisplayName(product, '商品未設定'),
          supplierName: supplier?.name || supplier?.companyName || '',
          lot: inventory.lot,
          inventoryCode: inventory.inventoryCode,
          projectId: '',
          quoteId: '',
          invoiceId: '',
        }];
      }

      return history.map((movement) => ({
        ...movement,
        id: movement.id || `${inventory.id}-${movement.createdAt}`,
        productName: productDisplayName(product, '商品未設定'),
        supplierName: supplier?.name || supplier?.companyName || '',
        lot: inventory.lot,
        inventoryCode: inventory.inventoryCode,
      }));
    })
    .sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
}

function emptyMovementForm(initial = {}, user = null) {
  return {
    productId: initial.productId || '',
    inventoryId: initial.inventoryId || '',
    inventoryCode: '',
    supplierId: '',
    quantity: '',
    unit: 'kg',
    lot: '',
    expiryDate: '',
    manufactureDate: '',
    receivedDate: todayString(),
    location: '',
    cost: '',
    stockType: '現物',
    inventoryStatus: 'フリー',
    voucherNumber: '',
    handlerName: user?.email || '',
    reason: initial.reason || '仕入',
    memo: '',
  };
}

function emptyAdjustmentForm(inventory = null, user = null) {
  return {
    mode: 'absolute',
    quantity: inventory?.quantity ?? '',
    reason: '棚卸差異',
    memo: '',
    handlerName: user?.email || '',
  };
}

export default function InventoryPage({
  inventories = [],
  products = [],
  suppliers = [],
  projects = [],
  quotes = [],
  invoices = [],
  inboundShipments = [],
  inboundReceipts = [],
  inboundReceiptLines = [],
  inboundScheduleChanges = [],
  supplierProductAliases = [],
  productAliases = [],
  addProductAlias,
  saveInboundShipmentPreview,
  updateInboundShipmentLine,
  addSupplierProductAlias,
  confirmInboundReceipt,
  reverseInboundReceipt,
  updateInboundSchedule,
  addProduct,
  inboundShipmentSyncState = '',
  inboundShipmentSyncError = '',
  reloadInventory,
  addInventory,
  updateInventory,
  removeInventory,
  initialAction = null,
  onInitialHandled,
  onOpenProductDetail,
  onCreateQuote,
  user = null,
  userId = '',
}) {
  const [activeTab, setActiveTab] = useState(initialInventoryTab);
  const [keyword, setKeyword] = useState(() => localStorage.getItem('eigyo-techo-inventory-keyword') || '');
  const [filter, setFilter] = useState(() => localStorage.getItem('eigyo-techo-inventory-filter') || ALL);
  const [form, setForm] = useState(() => emptyMovementForm(initialAction || {}, user));
  const [adjustmentInventoryId, setAdjustmentInventoryId] = useState('');
  const [adjustmentForm, setAdjustmentForm] = useState(() => emptyAdjustmentForm(null, user));
  const [deliveryNoticePreview, setDeliveryNoticePreview] = useState(null);
  const [deliveryNoticeParsing, setDeliveryNoticeParsing] = useState(false);
  const [deliveryNoticeSaving, setDeliveryNoticeSaving] = useState(false);
  const [deliveryNoticeError, setDeliveryNoticeError] = useState('');
  const [inboundProductLine, setInboundProductLine] = useState(null);
  const [inboundAliasSelection, setInboundAliasSelection] = useState(null);
  const [previewAddedProducts, setPreviewAddedProducts] = useState([]);
  const [previewAddedAliases, setPreviewAddedAliases] = useState([]);
  const initialInboundLocation = useMemo(() => inboundViewFromUrl(), []);
  const [inboundView, setInboundView] = useState(initialInboundLocation.view);
  const [selectedInboundShipmentId, setSelectedInboundShipmentId] = useState(initialInboundLocation.shipmentId);
  const [receiptShipmentId, setReceiptShipmentId] = useState('');
  const [receiptForm, setReceiptForm] = useState(() => buildReceiptForm(null));
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [reverseReceiptId, setReverseReceiptId] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [reverseSaving, setReverseSaving] = useState(false);
  const [scheduleLineId, setScheduleLineId] = useState('');
  const [scheduleForm, setScheduleForm] = useState(() => buildScheduleForm(null));
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [analysisFilters, setAnalysisFilters] = useState({
    from: '',
    to: '',
    supplierName: ALL,
    productId: ALL,
    status: ALL,
    completion: ALL,
    delay: ALL,
  });
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem('eigyo-techo-inventory-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('eigyo-techo-inventory-keyword', keyword);
  }, [keyword]);

  useEffect(() => {
    localStorage.setItem('eigyo-techo-inventory-filter', filter);
  }, [filter]);

  const previewProducts = useMemo(() => {
    const productIds = new Set(products.map((product) => product.id));
    return [...products, ...previewAddedProducts.filter((product) => !productIds.has(product.id))];
  }, [previewAddedProducts, products]);

  const previewProductAliases = useMemo(() => {
    const aliasIds = new Set(productAliases.map((alias) => alias.id));
    return [...productAliases, ...previewAddedAliases.filter((alias) => !aliasIds.has(alias.id))];
  }, [previewAddedAliases, productAliases]);

  const matchedDeliveryNoticePreview = useMemo(
    () => matchInboundPreview(deliveryNoticePreview, previewProducts, { productAliases: previewProductAliases, suppliers }),
    [deliveryNoticePreview, previewProductAliases, previewProducts, suppliers],
  );

  useEffect(() => {
    if (!initialAction) return;
    setActiveTab(initialAction.tab || 'inbound');
    if (initialAction.inboundShipmentId) {
      setSelectedInboundShipmentId(initialAction.inboundShipmentId);
      setInboundView('detail');
      writeInboundViewUrl('detail', initialAction.inboundShipmentId, { replace: true });
    }
    setForm(emptyMovementForm(initialAction, user));
    onInitialHandled?.();
  }, [initialAction, onInitialHandled, user]);

  useEffect(() => {
    const handlePopState = () => {
      const next = inboundViewFromUrl();
      setInboundView(next.view);
      setSelectedInboundShipmentId(next.shipmentId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const selectedProduct = products.find((product) => product.id === form.productId);
  const selectedInventory = inventories.find((inventory) => inventory.id === form.inventoryId);
  const adjustmentInventory = inventories.find((inventory) => inventory.id === adjustmentInventoryId);
  const selectedInboundShipment = inboundShipments.find((shipment) => shipment.id === selectedInboundShipmentId) || null;
  const receiptShipment = inboundShipments.find((shipment) => shipment.id === receiptShipmentId);
  const reverseReceipt = inboundReceipts.find((receipt) => receipt.id === reverseReceiptId);
  const reverseReceiptLines = inboundReceiptLines.filter((line) => line.inboundReceiptId === reverseReceiptId);
  const scheduleLine = (selectedInboundShipment?.lines || []).find((line) => line.id === scheduleLineId);
  const historyRows = useMemo(
    () => buildHistory(inventories, products, suppliers),
    [inventories, products, suppliers],
  );

  const summary = useMemo(() => {
    const today = todayString();
    const soon = addDaysString(30);
    return {
      outOfStock: inventories.filter((item) => parseNumber(item.quantity) <= 0).length,
      belowSafety: inventories.filter((item) => parseNumber(item.safetyStock) > 0 && parseNumber(item.quantity) <= parseNumber(item.safetyStock)).length,
      expiringSoon: inventories.filter((item) => item.expiryDate && item.expiryDate >= today && item.expiryDate <= soon).length,
      expired: inventories.filter((item) => item.expiryDate && item.expiryDate < today).length,
      inboundToday: historyRows.filter((item) => item.type === '入庫' && String(item.date).slice(0, 10) === today).length,
      outboundToday: historyRows.filter((item) => item.type === '出庫' && String(item.date).slice(0, 10) === today).length,
    };
  }, [historyRows, inventories]);

  const filteredInventories = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const today = todayString();
    const soon = addDaysString(30);

    return inventories.filter((inventory) => {
      const product = products.find((item) => item.id === inventory.productId);
      const supplier = suppliers.find((item) => item.id === inventory.supplierId);
      const matchesKeyword =
        !normalizedKeyword ||
        [
          product?.name,
          product?.productCode,
          product?.category,
          inventory.inventoryCode,
          inventory.lot,
          inventory.location,
          inventory.owner,
          inventory.memo,
          supplier?.name,
          supplier?.companyName,
        ].some((value) => textIncludes(value, normalizedKeyword));
      const quantity = parseNumber(inventory.quantity);
      const matchesFilter =
        filter === ALL ||
        (filter === 'in-stock' && quantity > 0) ||
        (filter === 'out-of-stock' && quantity <= 0) ||
        (filter === 'expiring' && inventory.expiryDate && inventory.expiryDate >= today && inventory.expiryDate <= soon) ||
        (filter === 'expired' && inventory.expiryDate && inventory.expiryDate < today) ||
        (filter === 'has-lot' && Boolean(inventory.lot));

      return matchesKeyword && matchesFilter;
    });
  }, [filter, inventories, keyword, products, suppliers]);

  const plannedInventoryRows = useMemo(
    () => buildPlannedInventoryRows({ products, inventories, inboundShipments }),
    [inboundShipments, inventories, products],
  );

  const plannedInventoryByProduct = useMemo(
    () => new Map(plannedInventoryRows.map((row) => [row.productId, row])),
    [plannedInventoryRows],
  );

  const inboundAnalysis = useMemo(
    () => buildInboundAnalysis({
      inboundShipments,
      inboundReceipts,
      inboundReceiptLines,
      inboundScheduleChanges,
      products,
      filters: analysisFilters,
      toleranceDays: INBOUND_ANALYSIS_TOLERANCE_DAYS,
    }),
    [analysisFilters, inboundReceiptLines, inboundReceipts, inboundScheduleChanges, inboundShipments, products],
  );

  const filteredHistory = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return historyRows.filter((row) =>
      !normalizedKeyword ||
      [row.productName, row.inventoryCode, row.lot, row.type, row.reason, row.handlerName, row.memo]
        .some((value) => textIncludes(value, normalizedKeyword)),
    );
  }, [historyRows, keyword]);

  function setField(field, value) {
    setError('');
    setToast('');
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'productId') {
        const product = products.find((item) => item.id === value);
        next.unit = product?.costUnit || product?.sellingPriceUnit || current.unit || 'kg';
        next.cost = product?.costPrice || current.cost || '';
      }
      if (field === 'inventoryId') {
        const inventory = inventories.find((item) => item.id === value);
        if (inventory) {
          next.productId = inventory.productId;
          next.unit = inventory.unit || 'kg';
          next.lot = inventory.lot || '';
          next.expiryDate = inventory.expiryDate || '';
          next.location = inventory.location || '';
        }
      }
      return next;
    });
  }

  function openAdjustmentDialog(inventory) {
    setError('');
    setToast('');
    setAdjustmentInventoryId(inventory.id);
    setAdjustmentForm(emptyAdjustmentForm(inventory, user));
  }

  function closeAdjustmentDialog() {
    setAdjustmentInventoryId('');
    setAdjustmentForm(emptyAdjustmentForm(null, user));
  }

  function setAdjustmentField(field, value) {
    setError('');
    setToast('');
    setAdjustmentForm((current) => ({ ...current, [field]: value }));
  }

  function handleAdjustmentSubmit(event) {
    event.preventDefault();
    if (!adjustmentInventory) {
      setError('調整する在庫を選択してください。');
      return;
    }

    const currentQuantity = parseNumber(adjustmentInventory.quantity);
    const inputQuantity = parseNumber(adjustmentForm.quantity);
    const nextQuantity = adjustmentForm.mode === 'delta'
      ? currentQuantity + inputQuantity
      : inputQuantity;
    const difference = nextQuantity - currentQuantity;
    const reservedQuantity = parseNumber(adjustmentInventory.reservedQuantity);

    if (!Number.isFinite(nextQuantity) || adjustmentForm.quantity === '') {
      setError('調整数量を入力してください。');
      return;
    }
    if (nextQuantity < 0) {
      setError('調整後数量は0以上で入力してください。');
      return;
    }
    if (nextQuantity < reservedQuantity) {
      setError('調整後数量は引当済数量を下回れません。');
      return;
    }

    updateInventory?.(adjustmentInventory.id, {
      quantity: nextQuantity,
      movementHistory: appendInventoryMovement(adjustmentInventory, {
        type: '棚卸',
        quantity: difference,
        unit: adjustmentInventory.unit,
        reason: adjustmentForm.reason,
        date: todayString(),
        handlerName: adjustmentForm.handlerName,
        memo: adjustmentForm.memo,
      }),
    });
    setToast('在庫調整を保存しました。');
    closeAdjustmentDialog();
  }

  function validateCommon() {
    if (!form.productId) {
      setError('商品を選択してください。');
      return false;
    }
    if (parseNumber(form.quantity) <= 0 && activeTab !== 'stocktake') {
      setError('数量を入力してください。');
      return false;
    }
    const inventoryCode = normalizeInventoryCode(form.inventoryCode);
    if (!isValidInventoryCode(inventoryCode)) {
      setError('在庫コードは半角英数字と記号のみ使用できます。空欄も可能です。');
      return false;
    }
    if (
      inventoryCode &&
      inventories.some((inventory) =>
        inventory.id !== form.inventoryId &&
        normalizeInventoryCode(inventory.inventoryCode).toLowerCase() === inventoryCode.toLowerCase())
    ) {
      setError('同じ在庫コードが既に登録されています。');
      return false;
    }
    return true;
  }

  function handleInbound(event) {
    event.preventDefault();
    if (!validateCommon()) return;

    const inventoryId = addInventory?.(normalizeInventory({
      ...emptyInventory,
      ...form,
      inventoryCode: normalizeInventoryCode(form.inventoryCode),
      userId,
      createdBy: userId,
      createdByName: user?.email || '',
      movementHistory: appendInventoryMovement({}, {
        type: '入庫',
        quantity: form.quantity,
        unit: form.unit,
        reason: form.reason,
        date: form.receivedDate || todayString(),
        handlerName: form.handlerName,
        memo: form.memo,
      }),
    }, userId));

    setToast('在庫を登録しました。');
    setActiveTab('list');
    setForm(emptyMovementForm({ inventoryId }, user));
  }

  function handleOutbound(event) {
    event.preventDefault();
    if (!form.inventoryId) {
      setError('出庫するロットを選択してください。');
      return;
    }
    if (parseNumber(form.quantity) <= 0) {
      setError('出庫数量を入力してください。');
      return;
    }
    const inventory = selectedInventory;
    const nextQuantity = parseNumber(inventory.quantity) - parseNumber(form.quantity);
    if (nextQuantity < 0) {
      setError('現在庫を超えて出庫できません。');
      return;
    }

    updateInventory?.(inventory.id, {
      quantity: nextQuantity,
      inventoryStatus: nextQuantity <= 0 ? '欠品' : inventory.inventoryStatus,
      movementHistory: appendInventoryMovement(inventory, {
        type: '出庫',
        quantity: form.quantity,
        unit: form.unit,
        reason: form.reason,
        date: form.receivedDate || todayString(),
        handlerName: form.handlerName,
        memo: form.memo,
      }),
    });
    setToast('出庫を記録しました。');
    setActiveTab('list');
    setForm(emptyMovementForm({}, user));
  }

  function handleStocktake(event) {
    event.preventDefault();
    if (!form.inventoryId) {
      setError('棚卸する在庫を選択してください。');
      return;
    }
    const inventory = selectedInventory;
    const theoretical = parseNumber(inventory.quantity);
    const actual = parseNumber(form.quantity);
    const difference = actual - theoretical;
    updateInventory?.(inventory.id, {
      quantity: actual,
      movementHistory: appendInventoryMovement(inventory, {
        type: '棚卸',
        quantity: difference,
        unit: form.unit,
        reason: form.reason || '棚卸差異',
        date: form.receivedDate || todayString(),
        handlerName: form.handlerName,
        memo: form.memo,
      }),
    });
    setToast('棚卸結果を保存しました。');
    setActiveTab('list');
    setForm(emptyMovementForm({}, user));
  }

  async function handleDeliveryNoticeUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.type && file.type !== 'application/pdf') {
      setDeliveryNoticeError('PDFファイルを選択してください。');
      setDeliveryNoticePreview(null);
      return;
    }

    setDeliveryNoticeParsing(true);
    setDeliveryNoticeError('');
    setToast('');
    setError('');

    try {
      const { parseInboundDocumentFile } = await import('../services/inboundDocuments/inboundDocumentParser.js');
      const result = await parseInboundDocumentFile(file);
      const preview = result.preview || {
        documentType: result.classification.documentType,
        classification: result.classification,
        normalizedDocument: result.normalizedDocument,
        fileName: file.name,
        fileHash: result.normalizedDocument.fileHash,
        pageCount: result.normalizedDocument.pageCount,
        issueDate: '',
        documentNumber: '',
        supplier: '',
        lines: [],
        warnings: result.normalizedDocument.warnings,
      };
      setDeliveryNoticePreview(preview);
      setToast('入荷関連PDFを解析しました。在庫にはまだ反映していません。');
    } catch (parseError) {
      setDeliveryNoticePreview(null);
      setDeliveryNoticeError(parseError.message || 'PDF解析に失敗しました。');
    } finally {
      setDeliveryNoticeParsing(false);
    }
  }

  async function handleStandardExcelUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!/\.xlsx$/i.test(file.name || '')) {
      setDeliveryNoticeError('.xlsxファイルを選択してください。');
      setDeliveryNoticePreview(null);
      return;
    }

    setDeliveryNoticeParsing(true);
    setDeliveryNoticeError('');
    setToast('');
    setError('');

    try {
      const { parseStandardInboundExcelFile } = await import('../services/inboundDocuments/standardInboundExcelParser.js');
      const result = await parseStandardInboundExcelFile(file);
      setDeliveryNoticePreview(result.preview);
      setToast('標準Excelを解析しました。在庫にはまだ反映していません。');
    } catch (parseError) {
      setDeliveryNoticePreview(null);
      setDeliveryNoticeError(parseError.message || '標準Excelの解析に失敗しました。');
    } finally {
      setDeliveryNoticeParsing(false);
    }
  }

  async function handleSaveDeliveryNoticePreview() {
    if (!matchedDeliveryNoticePreview) return;
    if (!['delivery_notice', 'standard_excel_import'].includes(matchedDeliveryNoticePreview.documentType)) {
      setDeliveryNoticeError('この書類は確認専用です。入荷予定としては保存できません。');
      return;
    }
    setDeliveryNoticeSaving(true);
    setDeliveryNoticeError('');
    setToast('');
    setError('');

    try {
      const result = await saveInboundShipmentPreview?.(matchedDeliveryNoticePreview);
      const shipmentId = result?.shipmentId || '';
      if (result?.status === 'duplicate') {
        setSelectedInboundShipmentId(shipmentId);
        setToast('このPDFはすでに取り込み済みです。既存の入荷予定を表示しました。');
      } else {
        setSelectedInboundShipmentId(shipmentId);
        setToast('入荷予定として保存しました。まだ在庫数量には反映していません。');
      }
      if (shipmentId) {
        setInboundView('detail');
        writeInboundViewUrl('detail', shipmentId);
      }
    } catch (saveError) {
      setDeliveryNoticeError(saveError.message || '入荷予定の保存に失敗しました。');
    } finally {
      setDeliveryNoticeSaving(false);
    }
  }

  function openInboundList({ replace = false } = {}) {
    setInboundView('list');
    setSelectedInboundShipmentId('');
    setDeliveryNoticePreview(null);
    setDeliveryNoticeError('');
    writeInboundViewUrl('list', '', { replace });
  }

  function openInboundImport() {
    setInboundView('import');
    setSelectedInboundShipmentId('');
    setDeliveryNoticePreview(null);
    setDeliveryNoticeError('');
    writeInboundViewUrl('import');
  }

  function openInboundDetail(shipmentId) {
    if (!shipmentId) return;
    setInboundView('detail');
    setSelectedInboundShipmentId(shipmentId);
    setDeliveryNoticePreview(null);
    setDeliveryNoticeError('');
    writeInboundViewUrl('detail', shipmentId);
  }

  async function handleInboundProductCreated(createdProduct) {
    setPreviewAddedProducts((current) => [...current.filter((product) => product.id !== createdProduct.id), createdProduct]);
    setInboundProductLine(null);
    setToast('商品マスタへ登録し、取込明細を再照合しました。');
  }

  async function handleInboundAliasCreated(aliasInput) {
    const createdAlias = await addProductAlias?.(aliasInput);
    if (!createdAlias) throw new Error('Aliasを登録できませんでした。');
    setPreviewAddedAliases((current) => [
      ...current.filter((alias) => alias.id !== createdAlias.id),
      createdAlias,
    ]);
    setInboundAliasSelection(null);
    setToast('商品Aliasを登録し、取込明細を再照合しました。');
  }

  async function handleInboundLineChange(line, updates) {
    try {
      await updateInboundShipmentLine?.(line.id, updates);
      setToast('入荷予定明細を保存しました。');
    } catch (lineError) {
      setError(lineError.message || '入荷予定明細の保存に失敗しました。');
    }
  }

  async function handleSaveInboundAlias(line) {
    const shipment = inboundShipments.find((item) => item.id === line.inboundShipmentId);
    if (!line.matchedProductId) {
      setError('商品を選択してから別名を保存してください。');
      return;
    }

    try {
      await addSupplierProductAlias?.({
        supplierName: shipment?.supplierName || '',
        productId: line.matchedProductId,
        aliasName: line.productNameRaw,
        brandName: line.brandNameRaw,
        factoryNo: line.factoryNo,
        originCountry: line.originCountry,
      });
      setToast('仕入先商品別名を保存しました。次回以降の自動照合候補に使われます。');
    } catch (aliasError) {
      setError(aliasError.message || '仕入先商品別名の保存に失敗しました。');
    }
  }

  function openInboundReceiptDialog(shipment) {
    setError('');
    setToast('');
    setReceiptShipmentId(shipment.id);
    setReceiptForm(buildReceiptForm(shipment));
  }

  function closeInboundReceiptDialog() {
    setReceiptShipmentId('');
    setReceiptForm(buildReceiptForm(null));
  }

  function openReverseReceiptDialog(receipt) {
    setError('');
    setToast('');
    setReverseReceiptId(receipt?.id || '');
    setReverseReason('');
  }

  function closeReverseReceiptDialog() {
    if (reverseSaving) return;
    setReverseReceiptId('');
    setReverseReason('');
  }

  function openScheduleChangeDialog(line) {
    setError('');
    setToast('');
    setScheduleLineId(line?.id || '');
    setScheduleForm(buildScheduleForm(line));
  }

  function closeScheduleChangeDialog() {
    if (scheduleSaving) return;
    setScheduleLineId('');
    setScheduleForm(buildScheduleForm(null));
  }

  function setScheduleField(field, value) {
    setError('');
    setToast('');
    setScheduleForm((current) => ({ ...current, [field]: value }));
  }

  function setAnalysisFilter(field, value) {
    setAnalysisFilters((current) => ({ ...current, [field]: value }));
  }

  function resetAnalysisFilters() {
    setAnalysisFilters({
      from: '',
      to: '',
      supplierName: ALL,
      productId: ALL,
      status: ALL,
      completion: ALL,
      delay: ALL,
    });
  }

  function setReceiptField(field, value) {
    setError('');
    setToast('');
    setReceiptForm((current) => ({ ...current, [field]: value }));
  }

  function setReceiptLineField(lineId, field, value) {
    setError('');
    setToast('');
    setReceiptForm((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.inboundShipmentLineId === lineId ? { ...line, [field]: value } : line,
      ),
    }));
  }

  async function handleConfirmInboundReceipt(event) {
    event.preventDefault();
    if (!receiptShipment) {
      setError('入荷確定する入荷予定を選択してください。');
      return;
    }

    const enabledLines = receiptForm.lines.filter((line) => line.enabled);
    if (enabledLines.length === 0) {
      setError('入荷対象の明細を選択してください。');
      return;
    }

    const invalidLine = enabledLines.find((line) =>
      parseNumber(line.receivedPieces) <= 0 && parseNumber(line.receivedWeight) <= 0,
    );
    if (invalidLine) {
      setError('実入荷個数または実入荷重量を入力してください。');
      return;
    }

    const exceededLine = enabledLines.find((line) => {
      const sourceLine = receiptShipment.lines.find((item) => item.id === line.inboundShipmentLineId);
      return (
        emptyToNumber(line.receivedWeight) !== null &&
        emptyToNumber(sourceLine?.plannedWeight ?? sourceLine?.weight) !== null &&
        parseNumber(line.receivedWeight) > lineRemainingWeight(sourceLine)
      ) || (
        emptyToNumber(line.receivedPieces) !== null &&
        emptyToNumber(sourceLine?.plannedPieces ?? sourceLine?.quantityPieces) !== null &&
        parseNumber(line.receivedPieces) > lineRemainingPieces(sourceLine)
      );
    });
    if (exceededLine) {
      setError('残数量を超える入荷はできません。');
      return;
    }

    if (!window.confirm('選択した明細を入荷確定し、在庫へ反映します。よろしいですか？')) {
      return;
    }

    setReceiptSaving(true);
    setError('');
    setToast('');
    try {
      const receiptId = await confirmInboundReceipt?.({
        inboundShipmentId: receiptShipment.id,
        receivedAt: receiptForm.receivedAt ? new Date(receiptForm.receivedAt).toISOString() : new Date().toISOString(),
        warehouseName: receiptForm.warehouseName,
        memo: receiptForm.memo,
        lines: enabledLines,
      });
      await reloadInventory?.();
      setToast(`入荷確定しました。Receipt ID: ${receiptId}`);
      closeInboundReceiptDialog();
    } catch (confirmError) {
      setError(confirmError.message || '入荷確定に失敗しました。在庫は更新されていません。');
    } finally {
      setReceiptSaving(false);
    }
  }

  async function handleReverseInboundReceipt(event) {
    event.preventDefault();
    if (!reverseReceipt) {
      setError('取消対象の入荷実績が見つかりません。');
      return;
    }
    if (!reverseReason.trim()) {
      setError('取消理由を入力してください。');
      return;
    }
    if (!window.confirm('この入荷実績を取り消し、在庫へ逆仕訳を記録します。よろしいですか？')) {
      return;
    }

    setReverseSaving(true);
    setError('');
    setToast('');
    try {
      await reverseInboundReceipt?.(reverseReceipt.id, reverseReason);
      await reloadInventory?.();
      setToast('入荷実績を取り消しました。');
      closeReverseReceiptDialog();
    } catch (reverseError) {
      setError(reverseError.message || '入荷取消に失敗しました。');
    } finally {
      setReverseSaving(false);
    }
  }

  async function handleUpdateInboundSchedule(event) {
    event.preventDefault();
    if (!scheduleLine) {
      setError('予定変更する入荷予定明細が見つかりません。');
      return;
    }
    if (!canChangeInboundSchedule(scheduleLine)) {
      setError('この明細は予定変更できません。');
      return;
    }
    if (!scheduleForm.newDate) {
      setError('新しい通関予定日を入力してください。');
      return;
    }
    if (!String(scheduleForm.reason || '').trim()) {
      setError('予定変更理由を入力してください。');
      return;
    }

    setScheduleSaving(true);
    setError('');
    setToast('');
    try {
      const result = await updateInboundSchedule?.({
        inboundShipmentLineId: scheduleLine.id,
        newDate: scheduleForm.newDate,
        reason: scheduleForm.reason,
        memo: scheduleForm.memo,
      });
      setToast(result?.status === 'unchanged' ? '通関予定は変更されていません。' : '通関予定を変更しました。');
      closeScheduleChangeDialog();
    } catch (scheduleError) {
      setError(scheduleError.message || '通関予定の変更に失敗しました。');
    } finally {
      setScheduleSaving(false);
    }
  }

  const listColumns = [
    {
      key: 'image',
      label: '画像',
      width: '72px',
      render: (inventory) => {
        const product = products.find((item) => item.id === inventory.productId);
        return product?.imageFile?.url
          ? <img className="inventory-thumb" src={product.imageFile.url} alt={product.name} loading="lazy" />
          : <span className="inventory-thumb placeholder">No</span>;
      },
    },
    { key: 'productName', label: '商品名', minWidth: '220px', render: (inventory) => productDisplayName(products.find((item) => item.id === inventory.productId), '商品未設定') },
    { key: 'sku', label: 'SKU', minWidth: '120px', render: (inventory) => inventory.inventoryCode || products.find((item) => item.id === inventory.productId)?.productCode || '-' },
    { key: 'category', label: 'カテゴリ', minWidth: '110px', render: (inventory) => products.find((item) => item.id === inventory.productId)?.category || '-' },
    { key: 'quantity', label: '現在庫', width: '90px', render: (inventory) => `${formatPrice(inventory.quantity) || 0}` },
    { key: 'reserved', label: '引当', width: '90px', render: (inventory) => formatPrice(inventory.reservedQuantity) || 0 },
    { key: 'available', label: '使用可能', width: '100px', render: (inventory) => inventoryAvailableQuantity(inventory).toLocaleString('ja-JP') },
    {
      key: 'plannedInbound',
      label: '入荷予定',
      width: '120px',
      render: (inventory) => {
        const row = plannedInventoryByProduct.get(inventory.productId);
        return row ? formatPlannedQuantity(row.plannedInbound, row.unit) : '-';
      },
    },
    {
      key: 'projectedStock',
      label: '入荷後見込',
      width: '130px',
      render: (inventory) => {
        const row = plannedInventoryByProduct.get(inventory.productId);
        return row ? formatPlannedQuantity(row.projectedStock, row.unit) : '-';
      },
    },
    { key: 'unit', label: '単位', width: '80px', render: (inventory) => inventory.unit || '-' },
    { key: 'location', label: '保管場所', minWidth: '140px', render: (inventory) => inventory.location || '-' },
    { key: 'lot', label: 'LOT', minWidth: '130px', render: (inventory) => inventory.lot || '-' },
    { key: 'expiry', label: '最短賞味期限', minWidth: '130px', render: (inventory) => inventory.expiryDate || '-' },
    { key: 'supplier', label: '仕入先', minWidth: '160px', render: (inventory) => suppliers.find((item) => item.id === inventory.supplierId)?.name || suppliers.find((item) => item.id === inventory.supplierId)?.companyName || '-' },
    { key: 'updated', label: '最終更新', minWidth: '120px', render: (inventory) => String(inventory.updatedAt || '').slice(0, 10) || '-' },
  ];

  const historyColumns = [
    { key: 'date', label: '日時', minWidth: '120px', render: (row) => String(row.date || row.createdAt || '').slice(0, 10) || '-' },
    { key: 'product', label: '商品', minWidth: '220px', render: (row) => row.productName },
    { key: 'lot', label: 'LOT', minWidth: '120px', render: (row) => row.lot || '-' },
    { key: 'type', label: '区分', minWidth: '90px', render: (row) => row.type },
    { key: 'quantity', label: '数量', minWidth: '90px', render: (row) => `${row.quantity || 0} ${row.unit || ''}` },
    { key: 'handler', label: '担当者', minWidth: '140px', render: (row) => row.handlerName || '-' },
    { key: 'reason', label: '理由', minWidth: '140px', render: (row) => row.reason || '-' },
    { key: 'project', label: '関連案件', minWidth: '140px', render: (row) => projects.find((item) => item.id === row.projectId)?.title || '-' },
    { key: 'quote', label: '関連見積', minWidth: '140px', render: (row) => quotes.find((item) => item.id === row.quoteId)?.quoteNumber || '-' },
    { key: 'invoice', label: '関連請求', minWidth: '140px', render: (row) => invoices.find((item) => item.id === row.invoiceId)?.invoiceNumber || '-' },
  ];

  return (
    <main className="page inventory-page">
      <section className="page-header inventory-hero">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1>在庫管理</h1>
          <p>在庫登録、入庫、出庫、棚卸、入出庫履歴をここから操作できます。</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setActiveTab('inbound');
            setForm(emptyMovementForm({}, user));
          }}
        >
          ＋ 在庫登録
        </button>
      </section>

      {(toast || error) && (
        <section className="detail-section compact-feedback">
          {toast && <p className="notice-text">{toast}</p>}
          {error && <p className="error-text">{error}</p>}
        </section>
      )}

      <section className="dashboard-metrics inventory-metrics">
        <button type="button" className="metric-card red" onClick={() => setFilter('out-of-stock')}>
          <span>在庫切れ</span><strong>{summary.outOfStock}</strong>
        </button>
        <button type="button" className="metric-card orange" onClick={() => setFilter('in-stock')}>
          <span>安全在庫以下</span><strong>{summary.belowSafety}</strong>
        </button>
        <button type="button" className="metric-card gold" onClick={() => setFilter('expiring')}>
          <span>賞味期限30日以内</span><strong>{summary.expiringSoon}</strong>
        </button>
        <button type="button" className="metric-card red" onClick={() => setFilter('expired')}>
          <span>賞味期限切れ</span><strong>{summary.expired}</strong>
        </button>
        <button type="button" className="metric-card blue" onClick={() => setActiveTab('history')}>
          <span>本日入庫</span><strong>{summary.inboundToday}</strong>
        </button>
        <button type="button" className="metric-card blue" onClick={() => setActiveTab('history')}>
          <span>本日出庫</span><strong>{summary.outboundToday}</strong>
        </button>
      </section>

      <section className="inventory-tabs" aria-label="在庫管理タブ">
        {TABS.map((tab) => (
          <button
            type="button"
            className={activeTab === tab.key ? 'active' : ''}
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setError('');
              setToast('');
              if (tab.key === 'arrival') openInboundList({ replace: true });
            }}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {(activeTab === 'list' || activeTab === 'history') && (
        <section className="search-panel desktop-filter-panel inventory-filter-panel">
          <label className="field-label filter-search">
            検索
            <input
              value={keyword}
              placeholder="商品名、SKU、カテゴリ、仕入先、保管場所、LOTで検索"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          {activeTab === 'list' && (
            <label className="field-label">
              フィルタ
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value={ALL}>すべて</option>
                <option value="in-stock">在庫あり</option>
                <option value="out-of-stock">在庫なし</option>
                <option value="expiring">賞味期限30日以内</option>
                <option value="expired">賞味期限切れ</option>
                <option value="has-lot">ロットあり</option>
              </select>
            </label>
          )}
        </section>
      )}

      {activeTab === 'list' && (
        <section className="result-stack inventory-list-section">
          <div className="section-heading">
            <h2>在庫一覧</h2>
            <span>{filteredInventories.length}件</span>
          </div>
          <PlannedInventoryOverview rows={plannedInventoryRows} onOpenProductDetail={onOpenProductDetail} />
          <DesktopTable
            actionWidth="300px"
            actions={(inventory) => (
              <>
                <button type="button" className="ghost-button" onClick={() => { setActiveTab('inbound'); setForm(emptyMovementForm({ productId: inventory.productId }, user)); }}>入庫</button>
                <button type="button" className="ghost-button" onClick={() => { setActiveTab('outbound'); setForm(emptyMovementForm({ inventoryId: inventory.id, productId: inventory.productId, reason: '販売' }, user)); }}>出庫</button>
                <button type="button" className="ghost-button" onClick={() => { setActiveTab('stocktake'); setForm(emptyMovementForm({ inventoryId: inventory.id, productId: inventory.productId, reason: '棚卸差異' }, user)); }}>棚卸</button>
                <button type="button" className="ghost-button" onClick={() => openAdjustmentDialog(inventory)}>在庫調整</button>
              </>
            )}
            className="inventory-common-table"
            columns={listColumns}
            minWidth={1840}
            rowClassName={inventoryAlertClass}
            rows={filteredInventories}
          />
          <div className="card-list-mobile inventory-card-list">
            {filteredInventories.map((inventory) => {
              const product = products.find((item) => item.id === inventory.productId);
              const supplier = suppliers.find((item) => item.id === inventory.supplierId);
              return (
                <article className={`product-card inventory-card ${inventoryAlertClass(inventory)}`} key={inventory.id}>
                  <div className="product-card-main">
                    {product?.imageFile?.url ? <img className="product-thumb" src={product.imageFile.url} alt={product.name} loading="lazy" /> : <div className="product-thumb placeholder">No Image</div>}
                    <div className="company-heading">
                      <h3>{productDisplayName(product, '商品未設定')}</h3>
                      <p>{inventory.inventoryCode || product?.productCode || 'SKU未設定'} / LOT {inventory.lot || '-'}</p>
                    </div>
                  </div>
                  <dl className="company-details">
                    <div><dt>現在庫</dt><dd>{formatPrice(inventory.quantity) || 0} {inventory.unit}</dd></div>
                    <div><dt>使用可能</dt><dd>{inventoryAvailableQuantity(inventory).toLocaleString('ja-JP')} {inventory.unit}</dd></div>
                    <div><dt>入荷予定</dt><dd>{formatPlannedQuantity(plannedInventoryByProduct.get(inventory.productId)?.plannedInbound || 0, plannedInventoryByProduct.get(inventory.productId)?.unit || inventory.unit)}</dd></div>
                    <div><dt>入荷後見込</dt><dd>{formatPlannedQuantity(plannedInventoryByProduct.get(inventory.productId)?.projectedStock || inventory.quantity || 0, plannedInventoryByProduct.get(inventory.productId)?.unit || inventory.unit)}</dd></div>
                    <div><dt>保管場所</dt><dd>{inventory.location || '-'}</dd></div>
                    <div><dt>賞味期限</dt><dd>{inventory.expiryDate || '-'}</dd></div>
                    <div><dt>仕入先</dt><dd>{supplier?.name || supplier?.companyName || '-'}</dd></div>
                  </dl>
                  <div className="card-actions">
                    <button type="button" className="ghost-button" onClick={() => { setActiveTab('inbound'); setForm(emptyMovementForm({ productId: inventory.productId }, user)); }}>入庫</button>
                    <button type="button" className="ghost-button" onClick={() => { setActiveTab('outbound'); setForm(emptyMovementForm({ inventoryId: inventory.id, productId: inventory.productId, reason: '販売' }, user)); }}>出庫</button>
                    <button type="button" className="ghost-button" onClick={() => { setActiveTab('stocktake'); setForm(emptyMovementForm({ inventoryId: inventory.id, productId: inventory.productId, reason: '棚卸差異' }, user)); }}>棚卸</button>
                    <button type="button" className="ghost-button" onClick={() => openAdjustmentDialog(inventory)}>在庫調整</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'inbound' && (
        <InventoryInboundForm
          form={form}
          products={products}
          suppliers={suppliers}
          setField={setField}
          onSubmit={handleInbound}
        />
      )}

      {activeTab === 'arrival' && (
        <DeliveryNoticeImportPanel
          view={inboundView}
          onUpload={handleDeliveryNoticeUpload}
          onExcelUpload={handleStandardExcelUpload}
          onSavePreview={handleSaveDeliveryNoticePreview}
          saving={deliveryNoticeSaving}
          parsing={deliveryNoticeParsing}
          preview={matchedDeliveryNoticePreview}
          error={deliveryNoticeError}
          inboundShipments={inboundShipments}
          inboundReceipts={inboundReceipts}
          inboundReceiptLines={inboundReceiptLines}
          inboundScheduleChanges={inboundScheduleChanges}
          selectedInboundShipment={selectedInboundShipment}
          onOpenImport={openInboundImport}
          onBackToList={openInboundList}
          onSelectInboundShipment={openInboundDetail}
          products={previewProducts}
          aliases={supplierProductAliases}
          onLineChange={handleInboundLineChange}
          onSaveAlias={handleSaveInboundAlias}
          onAddProduct={setInboundProductLine}
          onLinkAlias={(line, product = null) => setInboundAliasSelection({ line, product })}
          onOpenReceipt={openInboundReceiptDialog}
          onOpenReverseReceipt={openReverseReceiptDialog}
          onOpenScheduleChange={openScheduleChangeDialog}
          syncState={inboundShipmentSyncState}
          syncError={inboundShipmentSyncError}
        />
      )}

      {activeTab === 'analysis' && (
        <InboundAnalysisDashboard
          analysis={inboundAnalysis}
          filters={analysisFilters}
          onFilterChange={setAnalysisFilter}
          onResetFilters={resetAnalysisFilters}
        />
      )}

      {activeTab === 'outbound' && (
        <InventoryOutboundForm
          form={form}
          inventories={inventories}
          products={products}
          selectedInventory={selectedInventory}
          setField={setField}
          onSubmit={handleOutbound}
        />
      )}

      {activeTab === 'stocktake' && (
        <InventoryStocktakeForm
          form={form}
          inventories={inventories}
          products={products}
          selectedInventory={selectedInventory}
          setField={setField}
          onSubmit={handleStocktake}
        />
      )}

      {activeTab === 'history' && (
        <section className="result-stack inventory-list-section">
          <div className="section-heading">
            <h2>入出庫履歴</h2>
            <span>{filteredHistory.length}件</span>
          </div>
          <DesktopTable
            className="inventory-common-table inventory-history-table"
            columns={historyColumns}
            rows={filteredHistory}
            getRowKey={(row) => row.id}
            minWidth={1300}
          />
          <div className="card-list-mobile inventory-card-list">
            {filteredHistory.map((row) => (
              <article className="product-card inventory-card" key={row.id}>
                <div className="history-meta">
                  <span>{row.type}</span>
                  <small>{String(row.date || '').slice(0, 10)}</small>
                </div>
                <h3>{row.productName}</h3>
                <dl className="company-details">
                  <div><dt>LOT</dt><dd>{row.lot || '-'}</dd></div>
                  <div><dt>数量</dt><dd>{row.quantity || 0} {row.unit}</dd></div>
                  <div><dt>担当者</dt><dd>{row.handlerName || '-'}</dd></div>
                  <div><dt>理由</dt><dd>{row.reason || '-'}</dd></div>
                </dl>
                {row.memo && <p className="inline-helper">{row.memo}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {adjustmentInventory && (
        <InventoryAdjustmentDialog
          form={adjustmentForm}
          inventory={adjustmentInventory}
          onChange={setAdjustmentField}
          onClose={closeAdjustmentDialog}
          onSubmit={handleAdjustmentSubmit}
        />
      )}

      {receiptShipment && (
        <InboundReceiptDialog
          form={receiptForm}
          products={products}
          saving={receiptSaving}
          shipment={receiptShipment}
          onChange={setReceiptField}
          onLineChange={setReceiptLineField}
          onClose={closeInboundReceiptDialog}
          onSubmit={handleConfirmInboundReceipt}
        />
      )}

      {reverseReceipt && (
        <ReverseInboundReceiptDialog
          receipt={reverseReceipt}
          receiptLines={reverseReceiptLines}
          inboundShipmentLines={selectedInboundShipment?.lines || []}
          products={products}
          reason={reverseReason}
          saving={reverseSaving}
          onReasonChange={setReverseReason}
          onClose={closeReverseReceiptDialog}
          onSubmit={handleReverseInboundReceipt}
        />
      )}

      {scheduleLine && (
        <InboundScheduleChangeDialog
          line={scheduleLine}
          form={scheduleForm}
          saving={scheduleSaving}
          onChange={setScheduleField}
          onClose={closeScheduleChangeDialog}
          onSubmit={handleUpdateInboundSchedule}
        />
      )}

      {inboundProductLine && (
        <InboundProductCreateDialog
          line={inboundProductLine}
          products={previewProducts}
          addProduct={addProduct}
          userId={userId}
          onClose={() => setInboundProductLine(null)}
          onCreated={handleInboundProductCreated}
        />
      )}


      {inboundAliasSelection && (
        <InboundProductAliasDialog
          line={inboundAliasSelection.line}
          initialProduct={inboundAliasSelection.product}
          products={previewProducts}
          productAliases={previewProductAliases}
          suppliers={suppliers}
          preview={matchedDeliveryNoticePreview}
          userId={userId}
          onClose={() => setInboundAliasSelection(null)}
          onConfirm={handleInboundAliasCreated}
        />
      )}
    </main>
  );
}

function PlannedInventoryOverview({ rows = [], onOpenProductDetail }) {
  const visibleRows = rows.filter((row) => row.currentStock > 0 || row.plannedInbound > 0 || row.reserved > 0);
  const columns = [
    { key: 'product', label: '商品名', minWidth: '220px', render: (row) => row.productName },
    { key: 'code', label: '商品コード', minWidth: '130px', render: (row) => row.productCode || '-' },
    { key: 'current', label: '現在庫', width: '120px', render: (row) => formatPlannedQuantity(row.currentStock, row.unit) },
    { key: 'reserved', label: '引当済', width: '110px', render: (row) => formatPlannedQuantity(row.reserved, row.unit) },
    { key: 'available', label: '使用可能', width: '120px', render: (row) => formatPlannedQuantity(row.available, row.unit) },
    { key: 'planned', label: '入荷予定', width: '120px', render: (row) => formatPlannedQuantity(row.plannedInbound, row.unit) },
    { key: 'projected', label: '入荷後見込', width: '130px', render: (row) => formatPlannedQuantity(row.projectedStock, row.unit) },
    { key: 'nextCustoms', label: '次回通関予定', width: '130px', render: (row) => row.nextCustomsDate || '-' },
    { key: 'count', label: '予定件数', width: '90px', render: (row) => row.inboundCount },
    { key: 'warning', label: '確認事項', minWidth: '200px', render: (row) => row.warnings.length ? row.warnings.join(' / ') : 'なし' },
  ];

  return (
    <section className="planned-inventory-overview" aria-label="予定在庫">
      <div className="section-heading">
        <div>
          <h3>予定在庫</h3>
          <p className="inline-helper">現在庫 + 未入荷の入荷予定数量を商品単位で表示します。日付は通関予定です。</p>
        </div>
        <span className="info-badge muted">{visibleRows.length}商品</span>
      </div>

      {visibleRows.length === 0 ? (
        <div className="empty-state compact-empty">
          <h3>予定在庫はありません</h3>
          <p>未入荷の入荷予定が保存されると、ここに商品別の入荷後見込が表示されます。</p>
        </div>
      ) : (
        <>
          <DesktopTable
            className="inventory-common-table planned-inventory-table"
            columns={columns}
            rows={visibleRows}
            getRowKey={(row) => row.productId}
            minWidth={1280}
            actions={(row) => (
              <button type="button" className="ghost-button" onClick={() => onOpenProductDetail?.(row.productId)}>
                商品詳細
              </button>
            )}
          />

          <div className="card-list-mobile planned-inventory-card-list">
            {visibleRows.map((row) => (
              <article className="product-card planned-inventory-card" key={row.productId}>
                <button type="button" className="planned-inventory-title" onClick={() => onOpenProductDetail?.(row.productId)}>
                  <span>{row.productCode || '商品コード未設定'}</span>
                  <strong>{row.productName}</strong>
                </button>
                <dl className="company-details">
                  <div><dt>現在庫</dt><dd>{formatPlannedQuantity(row.currentStock, row.unit)}</dd></div>
                  <div><dt>引当済</dt><dd>{formatPlannedQuantity(row.reserved, row.unit)}</dd></div>
                  <div><dt>使用可能</dt><dd>{formatPlannedQuantity(row.available, row.unit)}</dd></div>
                  <div><dt>入荷予定</dt><dd>{formatPlannedQuantity(row.plannedInbound, row.unit)}</dd></div>
                  <div><dt>入荷後見込</dt><dd>{formatPlannedQuantity(row.projectedStock, row.unit)}</dd></div>
                  <div><dt>次回通関予定</dt><dd>{row.nextCustomsDate || '-'}</dd></div>
                </dl>
                {row.timeline.length > 0 && (
                  <div className="planned-inventory-timeline">
                    {row.timeline.slice(0, 3).map((item) => (
                      <div className="planned-inventory-timeline-row" key={item.id}>
                        <time>{item.customsDate || '通関予定未定'}</time>
                        <strong>+{formatPlannedQuantity(item.quantity, item.unit)}</strong>
                        <span>{item.contractNo || '契約No未設定'} / {item.warehouseName || '-'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {row.warnings.length > 0 && (
                  <div className="delivery-notice-line-warnings">
                    {row.warnings.map((warning) => <span className="info-badge warning" key={warning}>{warning}</span>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function InboundAnalysisDashboard({ analysis, filters, onFilterChange, onResetFilters }) {
  const columns = [
    { key: 'supplier', label: '仕入先', minWidth: '150px', render: (row) => row.supplierName || '-' },
    { key: 'product', label: '商品', minWidth: '220px', render: (row) => row.productName || '-' },
    { key: 'contract', label: '契約No', minWidth: '120px', render: (row) => row.contractNo || '-' },
    { key: 'original', label: '当初通関予定', minWidth: '120px', render: (row) => row.originalCustomsDate || '-' },
    { key: 'final', label: '最終通関予定', minWidth: '120px', render: (row) => row.finalCustomsDate || '-' },
    { key: 'actual', label: '実入荷日', minWidth: '110px', render: (row) => row.finalReceiptDate || '-' },
    { key: 'changeDays', label: '予定変更日数', width: '110px', render: (row) => varianceDayLabel(row.scheduleChangeDays) },
    { key: 'actualDiff', label: '実績差異日数', width: '110px', render: (row) => varianceDayLabel(row.finalVarianceDays) },
    { key: 'plannedWeight', label: '予定重量', width: '100px', render: (row) => formatPlannedQuantity(row.plannedWeight, 'kg') },
    { key: 'actualWeight', label: '実入荷重量', width: '110px', render: (row) => formatPlannedQuantity(row.actualWeight, 'kg') },
    { key: 'variance', label: '重量差異', width: '100px', render: (row) => formatPlannedQuantity(row.weightVariance, 'kg') },
    { key: 'changes', label: '変更回数', width: '90px', render: (row) => row.scheduleChangeCount },
    { key: 'reasons', label: '遅延理由', minWidth: '150px', render: (row) => row.scheduleReasons.join(' / ') || '-' },
    { key: 'status', label: 'Status', width: '110px', render: (row) => <span className={`info-badge ${inboundAnalysisStatusClass(row)}`}>{inboundAnalysisStatusLabel(row)}</span> },
  ];

  return (
    <section className="result-stack inbound-analysis-dashboard">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Inbound analytics</p>
          <h2>入荷分析</h2>
          <p className="inline-helper">当初通関予定・最終通関予定・実入荷日を比較します。予定遵守率は最終通関予定の±{analysis.toleranceDays}日以内を予定内として計算します。</p>
        </div>
        <span className="info-badge muted">{analysis.rows.length}明細</span>
      </div>

      <InboundAnalysisFilters
        analysis={analysis}
        filters={filters}
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
      />

      <section className="dashboard-metrics inbound-analysis-kpis">
        <div className="metric-card blue"><span>入荷予定件数</span><strong>{analysis.kpis.plannedCount}</strong></div>
        <div className="metric-card green"><span>入荷完了件数</span><strong>{analysis.kpis.completedCount}</strong></div>
        <div className="metric-card orange"><span>平均遅延日数</span><strong>{varianceDayLabel(analysis.kpis.averageDelayDays)}</strong></div>
        <div className="metric-card green"><span>予定遵守率</span><strong>{formatPercent(analysis.kpis.complianceRate)}</strong></div>
        <div className="metric-card gold"><span>平均予定変更日数</span><strong>{varianceDayLabel(analysis.kpis.averageScheduleChangeDays)}</strong></div>
        <div className="metric-card red"><span>遅延発生件数</span><strong>{analysis.kpis.delayedCount}</strong></div>
        <div className="metric-card purple"><span>入荷重量差異</span><strong>{formatPlannedQuantity(analysis.kpis.weightVariance, 'kg')}</strong></div>
      </section>

      <section className="analytics-chart-grid inbound-analysis-chart-grid">
        <InboundAnalysisPanel title="月別平均遅延日数" subtitle="実入荷日 - 最終通関予定">
          <InboundVerticalBars rows={analysis.monthly} labelKey="month" valueKey="averageDelayDays" unit="日" />
        </InboundAnalysisPanel>
        <InboundAnalysisPanel title="予定遵守率" subtitle={`最終通関予定の±${analysis.toleranceDays}日以内`}>
          <InboundVerticalBars rows={analysis.monthly} labelKey="month" valueKey="complianceRate" unit="%" />
        </InboundAnalysisPanel>
        <InboundAnalysisPanel title="遅延理由内訳" subtitle="予定変更履歴の理由件数">
          <InboundReasonDonut rows={analysis.byReason} />
        </InboundAnalysisPanel>
        <InboundAnalysisPanel title="商品別入荷重量差異" subtitle="実入荷重量 - 予定重量">
          <InboundHorizontalBars rows={analysis.byProduct.slice(0, 10)} labelKey="productName" valueKey="weightVariance" unit="kg" />
        </InboundAnalysisPanel>
      </section>

      <section className="analytics-chart-grid inbound-analysis-chart-grid compact">
        <InboundAnalysisPanel title="仕入先別サマリー" subtitle="予定重量・実入荷重量・遅延件数">
          <InboundSummaryBars rows={analysis.bySupplier.slice(0, 8)} labelKey="supplierName" />
        </InboundAnalysisPanel>
        <InboundAnalysisPanel title="商品別サマリー" subtitle="予定重量・実入荷重量・重量差異">
          <InboundSummaryBars rows={analysis.byProduct.slice(0, 8)} labelKey="productName" />
        </InboundAnalysisPanel>
      </section>

      <section className="result-stack inbound-analysis-detail">
        <div className="section-heading">
          <h3>入荷分析明細</h3>
          <span>{analysis.rows.length}件</span>
        </div>
        {analysis.rows.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>分析対象がありません</h3>
            <p>入荷予定または入荷実績が保存されると、予定差異と入荷差異を確認できます。</p>
          </div>
        ) : (
          <>
            <DesktopTable
              className="inventory-common-table inbound-analysis-table"
              columns={columns}
              rows={analysis.rows}
              getRowKey={(row) => row.id}
              minWidth={1760}
            />
            <div className="card-list-mobile inbound-analysis-card-list">
              {analysis.rows.map((row) => (
                <article className="product-card inbound-analysis-card" key={row.id}>
                  <div className="company-heading">
                    <p>{row.supplierName || '仕入先未設定'} / {row.contractNo || '契約No未設定'}</p>
                    <h3>{row.productName}</h3>
                    <span className={`info-badge ${inboundAnalysisStatusClass(row)}`}>{inboundAnalysisStatusLabel(row)}</span>
                  </div>
                  <dl className="company-details">
                    <div><dt>当初通関予定</dt><dd>{row.originalCustomsDate || '-'}</dd></div>
                    <div><dt>最終通関予定</dt><dd>{row.finalCustomsDate || '-'}</dd></div>
                    <div><dt>実入荷日</dt><dd>{row.finalReceiptDate || '-'}</dd></div>
                    <div><dt>予定変更日数</dt><dd>{varianceDayLabel(row.scheduleChangeDays)}</dd></div>
                    <div><dt>実績差異日数</dt><dd>{varianceDayLabel(row.finalVarianceDays)}</dd></div>
                    <div><dt>予定重量</dt><dd>{formatPlannedQuantity(row.plannedWeight, 'kg')}</dd></div>
                    <div><dt>実入荷重量</dt><dd>{formatPlannedQuantity(row.actualWeight, 'kg')}</dd></div>
                    <div><dt>重量差異</dt><dd>{formatPlannedQuantity(row.weightVariance, 'kg')}</dd></div>
                    <div><dt>変更回数</dt><dd>{row.scheduleChangeCount}</dd></div>
                    <div><dt>部分入荷回数</dt><dd>{row.receiptCount}</dd></div>
                    <div><dt>遅延理由</dt><dd>{row.scheduleReasons.join(' / ') || '-'}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  );
}

function InboundAnalysisFilters({ analysis, filters, onFilterChange, onResetFilters }) {
  return (
    <section className="search-panel desktop-filter-panel inbound-analysis-filters">
      <label className="field-label">
        期間From
        <input type="date" value={filters.from || ''} onChange={(event) => onFilterChange('from', event.target.value)} />
      </label>
      <label className="field-label">
        期間To
        <input type="date" value={filters.to || ''} onChange={(event) => onFilterChange('to', event.target.value)} />
      </label>
      <label className="field-label">
        仕入先
        <select value={filters.supplierName || ALL} onChange={(event) => onFilterChange('supplierName', event.target.value)}>
          <option value={ALL}>すべて</option>
          {analysis.filterOptions.suppliers.map((supplier) => <option value={supplier} key={supplier}>{supplier}</option>)}
        </select>
      </label>
      <label className="field-label">
        商品
        <select value={filters.productId || ALL} onChange={(event) => onFilterChange('productId', event.target.value)}>
          <option value={ALL}>すべて</option>
          {analysis.filterOptions.products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
        </select>
      </label>
      <label className="field-label">
        Status
        <select value={filters.status || ALL} onChange={(event) => onFilterChange('status', event.target.value)}>
          <option value={ALL}>すべて</option>
          {analysis.filterOptions.statuses.map((status) => <option value={status} key={status}>{inboundLineStatusLabel(status)}</option>)}
        </select>
      </label>
      <label className="field-label">
        完了
        <select value={filters.completion || ALL} onChange={(event) => onFilterChange('completion', event.target.value)}>
          <option value={ALL}>すべて</option>
          <option value="completed">完了</option>
          <option value="open">未完了</option>
        </select>
      </label>
      <label className="field-label">
        遅延
        <select value={filters.delay || ALL} onChange={(event) => onFilterChange('delay', event.target.value)}>
          <option value={ALL}>すべて</option>
          <option value="delayed">遅延あり</option>
          <option value="on-time">予定内</option>
          <option value="overdue-open">遅延中</option>
        </select>
      </label>
      <button type="button" className="ghost-button" onClick={onResetFilters}>クリア</button>
    </section>
  );
}

function InboundAnalysisPanel({ title, subtitle, children }) {
  return (
    <article className="analytics-panel inbound-analysis-panel">
      <div className="analytics-panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </article>
  );
}

function InboundVerticalBars({ rows = [], labelKey, valueKey, unit }) {
  if (rows.length === 0) return <p className="compact-empty chart-empty">表示できるデータがありません。</p>;
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row[valueKey]) || 0)));
  return (
    <div className="vertical-bar-chart inbound-analysis-bars">
      {rows.map((row) => {
        const value = Number(row[valueKey]) || 0;
        return (
          <div className="vertical-bar-group" key={row[labelKey]}>
            <div className="vertical-bars">
              <span
                style={{
                  '--bar-height': `${Math.max(4, (Math.abs(value) / max) * 100)}%`,
                  '--bar-color': value < 0 ? '#34d399' : '#60a5fa',
                }}
                title={`${row[labelKey]}: ${value}${unit}`}
              />
            </div>
            <small>{row[labelKey] || '-'}</small>
            <em>{value}{unit}</em>
          </div>
        );
      })}
    </div>
  );
}

function InboundHorizontalBars({ rows = [], labelKey, valueKey, unit }) {
  if (rows.length === 0) return <p className="compact-empty chart-empty">表示できるデータがありません。</p>;
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row[valueKey]) || 0)));
  return (
    <div className="horizontal-bar-chart inbound-analysis-horizontal">
      {rows.map((row) => {
        const value = Number(row[valueKey]) || 0;
        return (
          <div className="horizontal-bar-row" key={row[labelKey]}>
            <strong>{row[labelKey] || '-'}</strong>
            <div className="horizontal-bar-lines">
              <span>
                <i style={{ width: `${Math.max(3, (Math.abs(value) / max) * 100)}%`, background: value < 0 ? '#fb7185' : '#34d399' }} />
                <em>{formatPlannedQuantity(value, unit)}</em>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InboundSummaryBars({ rows = [], labelKey }) {
  if (rows.length === 0) return <p className="compact-empty chart-empty">表示できるデータがありません。</p>;
  const max = Math.max(1, ...rows.flatMap((row) => [row.plannedWeight, row.actualWeight].map((value) => Math.abs(Number(value) || 0))));
  return (
    <div className="horizontal-bar-chart inbound-analysis-horizontal">
      {rows.map((row) => (
        <div className="horizontal-bar-row" key={row[labelKey]}>
          <strong>{row[labelKey] || '-'}</strong>
          <div className="horizontal-bar-lines">
            <span><i style={{ width: `${Math.max(3, (Math.abs(row.plannedWeight) / max) * 100)}%`, background: '#60a5fa' }} /><em>予定 {formatPlannedQuantity(row.plannedWeight, 'kg')}</em></span>
            <span><i style={{ width: `${Math.max(3, (Math.abs(row.actualWeight) / max) * 100)}%`, background: '#34d399' }} /><em>実績 {formatPlannedQuantity(row.actualWeight, 'kg')}</em></span>
          </div>
          <small className="inline-helper">遅延 {row.delayedCount}件 / 差異 {formatPlannedQuantity(row.weightVariance, 'kg')}</small>
        </div>
      ))}
    </div>
  );
}

function InboundReasonDonut({ rows = [] }) {
  const total = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  if (total <= 0) return <p className="compact-empty chart-empty">表示できるデータがありません。</p>;
  const colors = ['#60a5fa', '#34d399', '#facc15', '#fb7185', '#a78bfa', '#fb923c', '#94a3b8'];
  let offset = 25;
  return (
    <div className="donut-chart inbound-reason-donut">
      <svg viewBox="0 0 42 42" className="donut-svg" role="img" aria-label="遅延理由内訳">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(148, 163, 184, .18)" strokeWidth="6" />
        {rows.map((row, index) => {
          const value = (row.count / total) * 100;
          const currentOffset = offset;
          offset -= value;
          return (
            <circle
              key={row.reason}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={colors[index % colors.length]}
              strokeWidth="6"
              strokeDasharray={`${value} ${100 - value}`}
              strokeDashoffset={currentOffset}
            />
          );
        })}
        <text x="21" y="20" textAnchor="middle" className="donut-total">{total}</text>
        <text x="21" y="25" textAnchor="middle" className="donut-caption">件</text>
      </svg>
      <div className="donut-legend">
        {rows.map((row, index) => (
          <div key={row.reason}>
            <span style={{ background: colors[index % colors.length] }} />
            <strong>{row.reason}</strong>
            <small>{row.count}件</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryProductSelect({ value, products, onChange }) {
  return (
    <label className="field-label">
      商品
      <select value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">商品を選択</option>
        {products.map((product) => (
          <option value={product.id} key={product.id}>
            {product.productCode ? `${product.productCode} / ` : ''}{productDisplayName(product, '商品名未設定')}
          </option>
        ))}
      </select>
    </label>
  );
}

function inboundStatusLabel(status) {
  const labels = {
    draft: '下書き',
    matching: '照合中',
    confirmed: '確定前',
    partially_received: '一部入荷',
    received: '入荷済',
    cancelled: '取消',
    deleted: '削除',
  };
  return labels[status] || status || '-';
}

function matchStatusLabel(status) {
  const labels = {
    matched: '自動照合',
    manual: '手動照合',
    ambiguous: '要確認',
    unmatched: '未照合',
  };
  return labels[status] || status || '-';
}

function inboundLineStatusLabel(status) {
  const labels = {
    draft: '未入荷',
    pending: '未入荷',
    partially_received: '一部入荷',
    received: '入荷済',
    skipped: 'スキップ',
    excluded: '除外',
    cancelled: '取消',
    failed: '失敗',
    deleted: '削除',
  };
  return labels[status] || status || '-';
}

function inboundStatusBadgeClass(status) {
  if (status === 'received') return 'ready';
  if (status === 'partially_received') return 'warning';
  if (status === 'cancelled' || status === 'failed') return 'danger';
  return 'muted';
}

function matchBadgeClass(status) {
  if (status === 'matched' || status === 'manual') return 'ready';
  if (status === 'ambiguous') return 'warning';
  return 'danger';
}

function previewProductMatchBadgeClass(status) {
  if (status === 'matched') return 'ready';
  if (status === 'unmatched') return 'danger';
  return 'warning';
}

function productMatchSourceLabel(source) {
  if (source === 'product_code') return '商品コード一致';
  if (source === 'supplier_code_alias' || source === 'name_alias') return 'Alias一致';
  return '';
}

function PreviewProductMatch({ line, onAddProduct, onLinkAlias }) {
  const sourceLabel = productMatchSourceLabel(line.productMatchSource);
  return (
    <div className="inbound-product-match">
      <span className={`info-badge ${previewProductMatchBadgeClass(line.productMatchStatus)}`}>
        {productMatchStatusLabel(line.productMatchStatus)}
      </span>
      {line.matchedProduct && (
        <span className="inbound-product-match-name">
          {line.matchedProduct.productCode || line.productCode} / {line.matchedProduct.name || '商品名未設定'}
        </span>
      )}
      {sourceLabel && <span className="inbound-product-match-source">{sourceLabel}</span>}
      {line.productMatchMessage && <span className="inline-helper">{line.productMatchMessage}</span>}
      {line.productMatchDifferences?.map((difference) => (
        <span className="inbound-product-difference" key={difference.label}>
          {difference.label}: 帳票「{difference.imported}」 / マスタ「{difference.registered}」
        </span>
      ))}
      {line.productMatchStatus === 'candidate' && line.productMatchCandidates?.length > 0 && (
        <div className="inbound-product-candidates">
          {line.productMatchCandidates.slice(0, 3).map((candidate) => (
            <div className="inbound-product-candidate" key={candidate.id}>
              <span><strong>{candidate.name || '商品名未設定'}</strong><small>{candidate.productCode || 'コードなし'} / {candidate.brandName || '-'}</small></span>
              <button type="button" className="ghost-button compact-button" onClick={() => onLinkAlias?.(line, candidate)}>
                同じ商品として登録
              </button>
            </div>
          ))}
        </div>
      )}
      {line.productMatchStatus === 'candidate' && (
        <button type="button" className="ghost-button compact-button" onClick={() => onAddProduct?.(line)}>
          別の商品として登録
        </button>
      )}
      {line.productMatchStatus === 'unmatched' && (
        <div className="inbound-product-match-actions">
          <button type="button" className="ghost-button compact-button" onClick={() => onAddProduct?.(line)}>商品マスタへ追加</button>
          <button type="button" className="ghost-button compact-button" onClick={() => onLinkAlias?.(line)}>既存商品と紐付け</button>
        </div>
      )}
    </div>
  );
}

function inboundDocumentTypeLabel(type) {
  return {
    delivery_notice: 'デリバリー予定案内',
    standard_excel_import: '標準Excel',
    product_price_list: '商品単価表',
    warehouse_receipt_candidate: '画像PDF（要確認）',
    unknown: '未判定',
  }[type] || '未判定';
}

function inboundDocumentConfidenceLabel(confidence) {
  return { high: '高', medium: '中', low: '低' }[confidence] || '-';
}

function DeliveryNoticeImportPanel({
  view = 'list',
  onUpload,
  onExcelUpload,
  onSavePreview,
  onLineChange,
  onSaveAlias,
  onAddProduct,
  onLinkAlias,
  onOpenImport,
  onBackToList,
  onSelectInboundShipment,
  parsing,
  saving,
  preview,
  error,
  inboundShipments = [],
  inboundReceipts = [],
  inboundReceiptLines = [],
  inboundScheduleChanges = [],
  selectedInboundShipment = null,
  products = [],
  onOpenReceipt,
  onOpenReverseReceipt,
  onOpenScheduleChange,
  syncState = '',
  syncError = '',
}) {
  if (view === 'list') {
    return (
      <InboundPlanList
        shipments={inboundShipments}
        error={syncError}
        onImport={onOpenImport}
        onOpenDetail={onSelectInboundShipment}
      />
    );
  }

  const detailColumns = [
    { key: 'lineNumber', label: '行', width: '64px', render: (row) => row.lineNumber || '-' },
    { key: 'contractNo', label: '契約No', minWidth: '110px', render: (row) => row.contractNo || '-' },
    { key: 'brand', label: 'ブランド', minWidth: '120px', render: (row) => row.brand || '-' },
    { key: 'productCode', label: '商品コード', minWidth: '120px', render: (row) => row.productCode || '-' },
    { key: 'productName', label: '商品名', minWidth: '240px', render: (row) => row.productName || '-' },
    { key: 'productMatch', label: '商品照合', minWidth: '300px', render: (row) => <PreviewProductMatch line={row} onAddProduct={onAddProduct} onLinkAlias={onLinkAlias} /> },
    { key: 'productType', label: '種別', minWidth: '120px', render: (row) => row.productType || '-' },
    { key: 'pieces', label: '個数', width: '80px', render: (row) => formatPrice(row.pieceCount) || '-' },
    { key: 'weight', label: '重量', width: '100px', render: (row) => row.weight !== '' ? `${formatPrice(row.weight)} ${row.unit || ''}` : '-' },
    { key: 'unitPrice', label: '単価', width: '130px', render: (row) => row.unitPrice !== '' ? `${formatPrice(row.unitPrice)} ${row.currency || ''}${row.priceUnit ? `/${row.priceUnit}` : ''}` : '-' },
    { key: 'origin', label: '原産国', minWidth: '120px', render: (row) => row.originCountry || '-' },
    { key: 'factory', label: '工場No', width: '90px', render: (row) => row.factoryNo || '-' },
    { key: 'customs', label: '通関予定', minWidth: '120px', render: (row) => row.customsClearancePlannedDate || '-' },
    { key: 'packing', label: 'Packing', minWidth: '210px', render: (row) => row.packingFrom || row.packingTo ? `${row.packingFrom || '-'} ～ ${row.packingTo || '-'}` : '-' },
    { key: 'expiry', label: '賞味期限', minWidth: '120px', render: (row) => row.expiryDate || '-' },
    { key: 'warehouse', label: '倉庫', minWidth: '160px', render: (row) => row.warehouse || '-' },
    { key: 'warnings', label: '確認事項', minWidth: '180px', render: (row) => row.warnings.length ? row.warnings.join(' / ') : 'なし' },
  ];

  const priceListColumns = [
    { key: 'lineNumber', label: '行', width: '64px', render: (row) => row.lineNumber || '-' },
    { key: 'productCode', label: '商品コード', minWidth: '120px', render: (row) => row.productCode || '-' },
    { key: 'productName', label: '商品名', minWidth: '220px', render: (row) => row.productName || '-' },
    { key: 'productMatch', label: '商品照合', minWidth: '300px', render: (row) => <PreviewProductMatch line={row} onAddProduct={onAddProduct} onLinkAlias={onLinkAlias} /> },
    { key: 'baseUnitPrice', label: '基礎単価', width: '110px', render: (row) => row.baseUnitPrice !== '' ? formatPrice(row.baseUnitPrice) : '-' },
    { key: 'coefficient', label: '係数', width: '90px', render: (row) => row.coefficient !== '' ? row.coefficient : '-' },
    { key: 'additionalCost', label: '諸費用', width: '100px', render: (row) => row.additionalCost !== '' ? formatPrice(row.additionalCost) : '-' },
    { key: 'billedUnitPrice', label: '請求単価', width: '120px', render: (row) => row.billedUnitPrice !== '' ? `${formatPrice(row.billedUnitPrice)} ${row.currency}/${row.priceUnit}` : '-' },
    { key: 'warnings', label: '確認事項', minWidth: '180px', render: (row) => row.warnings.length ? row.warnings.join(' / ') : 'なし' },
  ];

  const savedLineColumns = [
    { key: 'lineNo', label: '行', width: '64px', render: (line) => line.lineNo || '-' },
    { key: 'contractNo', label: '契約No', minWidth: '110px', render: (line) => line.contractNo || '-' },
    { key: 'rawProduct', label: 'PDF商品名', minWidth: '240px', render: (line) => line.productNameRaw || '-' },
    {
      key: 'matchedProduct',
      label: '商品照合',
      minWidth: '260px',
      render: (line) => (
        <select
          value={line.matchedProductId || ''}
          onChange={(event) => onLineChange?.(line, { matchedProductId: event.target.value })}
        >
          <option value="">未照合</option>
          {products.map((product) => (
            <option value={product.id} key={product.id}>
              {product.productCode ? `${product.productCode} / ` : ''}{productDisplayName(product, '商品名未設定')}
            </option>
          ))}
        </select>
      ),
    },
    { key: 'matchStatus', label: '照合状態', minWidth: '110px', render: (line) => <span className={`info-badge ${matchBadgeClass(line.matchStatus)}`}>{matchStatusLabel(line.matchStatus)}</span> },
    { key: 'lineStatus', label: '入荷状態', minWidth: '110px', render: (line) => <span className={`info-badge ${inboundStatusBadgeClass(line.status)}`}>{inboundLineStatusLabel(line.status)}</span> },
    { key: 'pieces', label: '予定個数', width: '90px', render: (line) => formatQuantity(line.plannedPieces ?? line.quantityPieces) },
    { key: 'receivedPieces', label: '入荷済個数', width: '100px', render: (line) => formatQuantity(line.receivedPiecesTotal) },
    { key: 'remainingPieces', label: '残個数', width: '90px', render: (line) => formatQuantity(lineRemainingPieces(line)) },
    {
      key: 'weight',
      label: '重量',
      width: '130px',
      render: (line) => (
        <input
          inputMode="decimal"
          defaultValue={line.weight ?? ''}
          onBlur={(event) => onLineChange?.(line, { weight: event.target.value })}
        />
      ),
    },
    { key: 'receivedWeight', label: '入荷済重量', width: '110px', render: (line) => formatQuantity(line.receivedWeightTotal, line.unit) },
    { key: 'remainingWeight', label: '残重量', width: '100px', render: (line) => formatQuantity(lineRemainingWeight(line), line.unit) },
    { key: 'originalCustoms', label: '当初通関予定', minWidth: '120px', render: (line) => scheduleOriginalDate(line) || '-' },
    { key: 'currentCustoms', label: '現在通関予定', minWidth: '120px', render: (line) => scheduleCurrentDate(line) || '-' },
    {
      key: 'scheduleDelay',
      label: '差分',
      minWidth: '110px',
      render: (line) => {
        const days = scheduleDelayDays(line);
        return <span className={`info-badge ${scheduleDelayBadgeClass(days)}`}>{scheduleDelayLabel(days)}</span>;
      },
    },
    {
      key: 'scheduleAction',
      label: '予定変更',
      width: '110px',
      render: (line) => (
        <button
          type="button"
          className="ghost-button"
          disabled={!canChangeInboundSchedule(line)}
          onClick={() => onOpenScheduleChange?.(line)}
        >
          変更
        </button>
      ),
    },
    {
      key: 'unitPrice',
      label: '単価',
      width: '130px',
      render: (line) => (
        <input
          inputMode="decimal"
          defaultValue={line.unitPrice ?? ''}
          onBlur={(event) => onLineChange?.(line, { unitPrice: event.target.value })}
        />
      ),
    },
    {
      key: 'expiry',
      label: '賞味期限',
      minWidth: '140px',
      render: (line) => <input type="date" defaultValue={line.expiryDate || ''} onBlur={(event) => onLineChange?.(line, { expiryDate: event.target.value })} />,
    },
    {
      key: 'warehouse',
      label: '倉庫',
      minWidth: '180px',
      render: (line) => <input defaultValue={line.warehouseName || ''} onBlur={(event) => onLineChange?.(line, { warehouseName: event.target.value })} />,
    },
    {
      key: 'status',
      label: '明細',
      width: '100px',
      render: (line) => (
        <label className="inline-check">
          <input
            type="checkbox"
            checked={line.status === 'excluded'}
            onChange={(event) => onLineChange?.(line, { status: event.target.checked ? 'excluded' : 'draft' })}
          />
          除外
        </label>
      ),
    },
    { key: 'alias', label: '別名', width: '110px', render: (line) => <button type="button" className="ghost-button" onClick={() => onSaveAlias?.(line)}>保存</button> },
    { key: 'warnings', label: '確認事項', minWidth: '180px', render: (line) => line.warnings?.length ? line.warnings.join(' / ') : 'なし' },
  ];

  const receiptRows = inboundReceipts
    .filter((receipt) => receipt.inboundShipmentId === selectedInboundShipment?.id)
    .map((receipt) => ({
      ...receipt,
      lines: inboundReceiptLines.filter((line) => line.inboundReceiptId === receipt.id),
    }));

  const scheduleChangeRows = (selectedInboundShipment?.lines || [])
    .flatMap((line) => {
      const lineChanges = line.scheduleChanges?.length
        ? line.scheduleChanges
        : inboundScheduleChanges.filter((change) => change.inboundShipmentLineId === line.id);
      return lineChanges.map((change) => ({ ...change, line }));
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const hasReceivableLines = (selectedInboundShipment?.lines || []).some(canReceiveInboundLine);

  return (
    <section className="detail-section delivery-notice-import-panel">
      <button type="button" className="ghost-button inbound-view-back" onClick={() => onBackToList?.()}>
        ← 入荷予定一覧
      </button>

      <div className="section-heading">
        <div>
          <p className="eyebrow">{view === 'import' ? 'New inbound plan' : 'Inbound plan detail'}</p>
          <h2>{view === 'import' ? '入荷予定を取り込む' : '入荷予定詳細'}</h2>
          <p className="inline-helper">
            {view === 'import'
              ? 'PDFまたは標準Excelを解析し、保存前に内容を確認します。'
              : '保存済みの入荷予定、商品照合、入荷状況を確認できます。'}
          </p>
        </div>
      </div>

      {view === 'import' && (
        <div className="inbound-import-choice">
          <label className="delivery-notice-upload-button">
            <strong>PDFから取り込む</strong>
            <span>入荷案内PDF、商品単価表など</span>
            <span className="primary-button">PDFを選択</span>
            <input type="file" accept="application/pdf,.pdf" onChange={onUpload} />
          </label>
          <label className="delivery-notice-upload-button standard-excel-upload-button">
            <strong>標準Excelから取り込む</strong>
            <span>IMPORT_TEMPLATE形式</span>
            <span className="secondary-button">Excelを選択</span>
            <input
              type="file"
              accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
              onChange={onExcelUpload}
            />
          </label>
        </div>
      )}

      {view === 'import' && parsing && <p className="notice-text">ファイルを解析しています...</p>}
      {view === 'import' && saving && <p className="notice-text">入荷予定として保存しています...</p>}
      {view === 'import' && error && <p className="error-text">{error}</p>}
      {syncError && <p className="error-text">{syncError}</p>}

      {view === 'detail' && !selectedInboundShipment && (
        <div className="empty-state delivery-notice-empty">
          <h3>入荷予定が見つかりません</h3>
          <p>一覧へ戻り、確認する入荷予定を選択してください。</p>
        </div>
      )}

      {view === 'import' && !preview && !parsing && (
        <div className="empty-state delivery-notice-empty">
          <h3>取込方法を選択してください</h3>
          <p>入荷関連PDF、またはIMPORT_TEMPLATEシートを持つ標準Excelを解析し、保存前に明細を確認できます。</p>
        </div>
      )}

      {view === 'import' && preview && (
        <div className="delivery-notice-preview">
          <div className="delivery-notice-summary">
            <div className="summary-card"><span>判定書類</span><strong>{inboundDocumentTypeLabel(preview.documentType)}</strong></div>
            <div className="summary-card"><span>判定精度</span><strong>{inboundDocumentConfidenceLabel(preview.classification?.confidence)}</strong></div>
            <div className="summary-card"><span>発行日</span><strong>{preview.issueDate || '-'}</strong></div>
            <div className="summary-card"><span>帳票番号</span><strong>{preview.documentNumber || '-'}</strong></div>
            <div className="summary-card"><span>仕入先</span><strong>{preview.supplier || '-'}</strong></div>
            <div className="summary-card"><span>明細数</span><strong>{preview.lines.length}</strong></div>
          </div>

          <dl className="company-details delivery-notice-file-details">
            <div><dt>ファイル名</dt><dd>{preview.fileName || '-'}</dd></div>
            <div><dt>ファイル識別子</dt><dd>{preview.fileHash || '-'}</dd></div>
            <div><dt>ページ数</dt><dd>{preview.pageCount || 0}</dd></div>
          </dl>

          {preview.warnings.length > 0 && (
            <div className="delivery-notice-warning-box">
              <h3>ファイル全体の確認事項</h3>
              <ul>
                {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}

          <div className="section-heading">
            <h3>解析明細</h3>
            <span className="info-badge muted">未取得項目は確認事項で確認</span>
          </div>

          {['delivery_notice', 'standard_excel_import'].includes(preview.documentType) ? (
            <>
              <div className="delivery-notice-actions">
                <button type="button" className="primary-button" disabled={saving || parsing} onClick={onSavePreview}>
                  入荷予定として保存
                </button>
                <span className="inline-helper">保存しても在庫数量には加算されません。</span>
              </div>

              <DesktopTable
                className="inventory-common-table delivery-notice-detail-table"
                columns={detailColumns}
                rows={preview.lines}
                getRowKey={(row) => row.id}
                minWidth={2160}
              />

              <div className="card-list-mobile delivery-notice-card-list">
                {preview.lines.map((line) => (
              <article className="product-card delivery-notice-card" key={line.id}>
                <div className="company-heading">
                  <p>{line.contractNo || '契約No未取得'} / {line.brand || 'ブランド未取得'}</p>
                  <h3>{line.productName || '商品名未取得'}</h3>
                </div>
                <dl className="company-details">
                  <div><dt>行番号</dt><dd>{line.lineNumber || '-'}</dd></div>
                  <div><dt>商品コード</dt><dd>{line.productCode || '-'}</dd></div>
                  <div><dt>商品照合</dt><dd><PreviewProductMatch line={line} onAddProduct={onAddProduct} onLinkAlias={onLinkAlias} /></dd></div>
                  <div><dt>種別</dt><dd>{line.productType || '-'}</dd></div>
                  <div><dt>個数</dt><dd>{formatPrice(line.pieceCount) || '-'}</dd></div>
                  <div><dt>重量</dt><dd>{line.weight !== '' ? `${formatPrice(line.weight)} ${line.unit || ''}` : '-'}</dd></div>
                  <div><dt>単価</dt><dd>{line.unitPrice !== '' ? `${formatPrice(line.unitPrice)} ${line.currency || ''}${line.priceUnit ? `/${line.priceUnit}` : ''}` : '-'}</dd></div>
                  <div><dt>原産国</dt><dd>{line.originCountry || '-'}</dd></div>
                  <div><dt>工場No</dt><dd>{line.factoryNo || '-'}</dd></div>
                  <div><dt>通関予定</dt><dd>{line.customsClearancePlannedDate || '-'}</dd></div>
                  <div><dt>Packing</dt><dd>{line.packingFrom || '-'} ～ {line.packingTo || '-'}</dd></div>
                  <div><dt>賞味期限</dt><dd>{line.expiryDate || '-'}</dd></div>
                  <div><dt>倉庫</dt><dd>{line.warehouse || '-'}</dd></div>
                </dl>
                {line.warnings.length > 0 && (
                  <div className="delivery-notice-line-warnings">
                    {line.warnings.map((warning) => <span className="info-badge muted" key={warning}>{warning}</span>)}
                  </div>
                )}
              </article>
                ))}
              </div>
            </>
          ) : preview.documentType === 'product_price_list' ? (
            <>
              <p className="notice-text">商品単価表は確認専用です。このStepではクラウドへ保存しません。</p>
              <DesktopTable
                className="inventory-common-table delivery-notice-detail-table product-price-list-preview-table"
                columns={priceListColumns}
                rows={preview.lines}
                getRowKey={(row) => row.id}
                minWidth={1340}
              />
              <div className="card-list-mobile delivery-notice-card-list product-price-list-card-list">
                {preview.lines.map((line) => (
                  <article className="product-card delivery-notice-card" key={line.id}>
                    <div className="company-heading">
                      <p>{line.productCode || '商品コード未取得'}</p>
                      <h3>{line.productName || '商品名未取得'}</h3>
                    </div>
                    <dl className="company-details">
                      <div><dt>商品照合</dt><dd><PreviewProductMatch line={line} onAddProduct={onAddProduct} onLinkAlias={onLinkAlias} /></dd></div>
                      <div><dt>基礎単価</dt><dd>{line.baseUnitPrice !== '' ? `${formatPrice(line.baseUnitPrice)} JPY/KG` : '-'}</dd></div>
                      <div><dt>係数</dt><dd>{line.coefficient !== '' ? line.coefficient : '-'}</dd></div>
                      <div><dt>諸費用</dt><dd>{line.additionalCost !== '' ? formatPrice(line.additionalCost) : '-'}</dd></div>
                      <div><dt>請求単価</dt><dd>{line.billedUnitPrice !== '' ? `${formatPrice(line.billedUnitPrice)} JPY/KG` : '-'}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state delivery-notice-empty">
              <h3>この書類形式はまだ解析できません</h3>
              <p>{preview.warnings.join(' / ') || '次のStepで対応予定です。'}</p>
            </div>
          )}
        </div>
      )}

      {view === 'detail' && selectedInboundShipment && (
        <div className="delivery-notice-detail-editor">
          <div className="section-heading">
            <div>
              <h3>入荷予定詳細・商品照合</h3>
              <p className="inline-helper">{selectedInboundShipment.sourceFileName || '-'} / {selectedInboundShipment.fileHash || '-'}</p>
            </div>
            <div className="delivery-notice-actions">
              <span className={`info-badge ${inboundStatusBadgeClass(selectedInboundShipment.status)}`}>{inboundStatusLabel(selectedInboundShipment.status)}</span>
              <button type="button" className="primary-button" disabled={!hasReceivableLines} onClick={() => onOpenReceipt?.(selectedInboundShipment)}>
                入荷確定
              </button>
            </div>
          </div>

          <DesktopTable
            className="inventory-common-table delivery-notice-line-editor-table"
            columns={savedLineColumns}
            rows={selectedInboundShipment.lines || []}
            getRowKey={(row) => row.id}
            minWidth={1840}
          />

          <div className="card-list-mobile delivery-notice-card-list">
            {(selectedInboundShipment.lines || []).map((line) => (
              <article className="product-card delivery-notice-card" key={line.id}>
                <div className="company-heading">
                  <p>{line.contractNo || '契約No未取得'} / {line.brandNameRaw || 'ブランド未取得'}</p>
                  <h3>{line.productNameRaw || '商品名未取得'}</h3>
                  <span className={`info-badge ${matchBadgeClass(line.matchStatus)}`}>{matchStatusLabel(line.matchStatus)}</span>
                </div>
                <label className="field-label">
                  商品照合
                  <select value={line.matchedProductId || ''} onChange={(event) => onLineChange?.(line, { matchedProductId: event.target.value })}>
                    <option value="">未照合</option>
                    {products.map((product) => (
                      <option value={product.id} key={product.id}>
                        {product.productCode ? `${product.productCode} / ` : ''}{productDisplayName(product, '商品名未設定')}
                      </option>
                    ))}
                  </select>
                </label>
                <dl className="company-details">
                  <div><dt>個数</dt><dd>{formatPrice(line.quantityPieces) || '-'}</dd></div>
                  <div><dt>入荷済個数</dt><dd>{formatQuantity(line.receivedPiecesTotal)}</dd></div>
                  <div><dt>残個数</dt><dd>{formatQuantity(lineRemainingPieces(line))}</dd></div>
                  <div><dt>重量</dt><dd>{line.weight !== null ? `${formatPrice(line.weight)} ${line.unit || ''}` : '-'}</dd></div>
                  <div><dt>入荷済重量</dt><dd>{formatQuantity(line.receivedWeightTotal, line.unit)}</dd></div>
                  <div><dt>残重量</dt><dd>{formatQuantity(lineRemainingWeight(line), line.unit)}</dd></div>
                  <div><dt>単価</dt><dd>{line.unitPrice !== null ? `${formatPrice(line.unitPrice)} ${line.currency || ''}` : '-'}</dd></div>
                  <div><dt>当初通関予定</dt><dd>{scheduleOriginalDate(line) || '-'}</dd></div>
                  <div><dt>現在通関予定</dt><dd>{scheduleCurrentDate(line) || '-'}</dd></div>
                  <div>
                    <dt>差分</dt>
                    <dd><span className={`info-badge ${scheduleDelayBadgeClass(scheduleDelayDays(line))}`}>{scheduleDelayLabel(scheduleDelayDays(line))}</span></dd>
                  </div>
                  <div><dt>Packing</dt><dd>{line.packingFrom || '-'} ～ {line.packingTo || '-'}</dd></div>
                </dl>
                <div className="inventory-form-grid compact-grid">
                  <label className="field-label">重量<input inputMode="decimal" defaultValue={line.weight ?? ''} onBlur={(event) => onLineChange?.(line, { weight: event.target.value })} /></label>
                  <label className="field-label">単価<input inputMode="decimal" defaultValue={line.unitPrice ?? ''} onBlur={(event) => onLineChange?.(line, { unitPrice: event.target.value })} /></label>
                  <label className="field-label">賞味期限<input type="date" defaultValue={line.expiryDate || ''} onBlur={(event) => onLineChange?.(line, { expiryDate: event.target.value })} /></label>
                  <label className="field-label">倉庫<input defaultValue={line.warehouseName || ''} onBlur={(event) => onLineChange?.(line, { warehouseName: event.target.value })} /></label>
                </div>
                <div className="card-actions">
                  <button type="button" className="ghost-button" onClick={() => onLineChange?.(line, { status: line.status === 'excluded' ? 'draft' : 'excluded' })}>
                    {line.status === 'excluded' ? '除外を戻す' : '明細除外'}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => onSaveAlias?.(line)}>別名保存</button>
                  <button type="button" className="ghost-button" disabled={!canChangeInboundSchedule(line)} onClick={() => onOpenScheduleChange?.(line)}>
                    予定変更
                  </button>
                </div>
                {line.warnings?.length > 0 && (
                  <div className="delivery-notice-line-warnings">
                    {line.warnings.map((warning) => <span className="info-badge muted" key={warning}>{warning}</span>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {view === 'detail' && selectedInboundShipment && scheduleChangeRows.length > 0 && (
        <div className="delivery-notice-schedule-history">
          <div className="section-heading">
            <h3>予定変更履歴</h3>
            <span className="info-badge muted">{scheduleChangeRows.length}件</span>
          </div>
          <div className="delivery-schedule-change-list">
            {scheduleChangeRows.map((change) => (
              <article className="delivery-schedule-change-card" key={change.id}>
                <div>
                  <strong>{change.oldDate || '-'} → {change.newDate || '-'}</strong>
                  <p>{change.line?.contractNo || '契約No未取得'} / {change.line?.productNameRaw || '商品名未取得'}</p>
                  <p>理由: {change.reason || '-'}{change.memo ? ` / ${change.memo}` : ''}</p>
                  <p>変更日時: {String(change.createdAt || '').replace('T', ' ').slice(0, 16) || '-'}</p>
                </div>
                <span className={`info-badge ${scheduleDelayBadgeClass(change.delayDays)}`}>
                  {scheduleDelayLabel(change.delayDays)}
                </span>
              </article>
            ))}
          </div>
        </div>
      )}

      {view === 'detail' && selectedInboundShipment && receiptRows.length > 0 && (
        <div className="delivery-notice-receipts">
          <div className="section-heading">
            <h3>入荷確定履歴</h3>
            <span className="info-badge muted">{receiptRows.length}件</span>
          </div>
          <div className="delivery-receipt-list">
            {receiptRows.map((receipt) => (
              <article className="delivery-receipt-card" key={receipt.id}>
                <div>
                  <strong>{receipt.receiptNo || receipt.id}</strong>
                  <p>{String(receipt.receivedAt || '').slice(0, 10)} / {receipt.warehouseName || '-'}</p>
                  {receipt.voidedAt && <p>取消済み: {String(receipt.voidedAt).slice(0, 10)} / {receipt.voidReason || '-'}</p>}
                </div>
                <div className="delivery-receipt-actions">
                  <span className={`info-badge ${receipt.voidedAt ? 'muted' : 'ready'}`}>
                    {receipt.voidedAt ? '取消済み' : `${receipt.lines.length}明細`}
                  </span>
                  <button
                    type="button"
                    className="ghost-button receipt-reverse-button"
                    disabled={Boolean(receipt.voidedAt)}
                    onClick={() => onOpenReverseReceipt?.(receipt)}
                  >
                    入荷取消
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function InboundScheduleChangeDialog({ line, form, saving, onChange, onClose, onSubmit }) {
  const originalDate = scheduleOriginalDate(line);
  const currentDate = scheduleCurrentDate(line);
  const nextDelay = dateDiffDays(originalDate, form.newDate);
  const currentDelay = scheduleDelayDays(line);

  return (
    <div className="modal-backdrop inbound-receipt-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal-panel inbound-receipt-dialog inbound-schedule-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbound-schedule-change-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="section-heading inbound-receipt-dialog-header">
          <div>
            <p className="eyebrow">Customs schedule</p>
            <h2 id="inbound-schedule-change-title">通関予定変更</h2>
            <p className="inline-helper">{line.contractNo || '契約No未取得'} / {line.productNameRaw || '商品名未取得'}</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>閉じる</button>
        </div>

        <div className="dashboard-metrics inbound-receipt-summary">
          <div className="summary-card"><span>当初予定</span><strong>{originalDate || '-'}</strong></div>
          <div className="summary-card"><span>現在予定</span><strong>{currentDate || '-'}</strong></div>
          <div className="summary-card">
            <span>現在差分</span>
            <strong className={`schedule-delay-text ${scheduleDelayBadgeClass(currentDelay)}`}>{scheduleDelayLabel(currentDelay)}</strong>
          </div>
          <div className="summary-card">
            <span>変更後差分</span>
            <strong className={`schedule-delay-text ${scheduleDelayBadgeClass(nextDelay)}`}>{scheduleDelayLabel(nextDelay)}</strong>
          </div>
        </div>

        <div className="inventory-form-grid inbound-receipt-meta">
          <label className="field-label">
            新しい通関予定日
            <input
              type="date"
              value={form.newDate || ''}
              onChange={(event) => onChange('newDate', event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            理由
            <select value={form.reason || ''} onChange={(event) => onChange('reason', event.target.value)} required>
              {SCHEDULE_CHANGE_REASONS.map((reason) => <option value={reason} key={reason}>{reason}</option>)}
            </select>
          </label>
          <label className="field-label full-width">
            メモ
            <textarea
              value={form.memo || ''}
              onChange={(event) => onChange('memo', event.target.value)}
              rows={4}
              placeholder={form.reason === 'その他' ? 'その他の理由を入力してください。' : '補足があれば入力してください。'}
            />
          </label>
        </div>

        <p className="inline-helper">
          履歴は削除せず保存します。予定変更は通関予定日だけを更新し、在庫数量・入荷実績・在庫履歴には影響しません。
        </p>

        <div className="modal-actions inbound-receipt-dialog-actions">
          <span className="inline-helper">pending / 一部入荷の明細のみ変更できます。</span>
          <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>キャンセル</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? '更新中...' : '更新'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ReverseInboundReceiptDialog({ receipt, receiptLines = [], inboundShipmentLines = [], products = [], reason, saving, onReasonChange, onClose, onSubmit }) {
  const totalWeight = receiptLines.reduce((sum, line) => sum + parseNumber(line.receivedWeight), 0);
  const totalPieces = receiptLines.reduce((sum, line) => sum + parseNumber(line.receivedPieces), 0);

  return (
    <div className="modal-backdrop inbound-receipt-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal-panel inbound-receipt-dialog reverse-inbound-receipt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reverse-inbound-receipt-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="section-heading inbound-receipt-dialog-header">
          <div>
            <p className="eyebrow">Reverse receipt</p>
            <h2 id="reverse-inbound-receipt-title">入荷取消</h2>
            <p className="inline-helper">{receipt.receiptNo || receipt.id} / {String(receipt.receivedAt || '').slice(0, 10)}</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>閉じる</button>
        </div>

        <div className="dashboard-metrics inbound-receipt-summary">
          <div className="summary-card"><span>対象明細</span><strong>{receiptLines.length}</strong></div>
          <div className="summary-card"><span>取消重量</span><strong>{formatQuantity(totalWeight, 'kg')}</strong></div>
          <div className="summary-card"><span>取消個数</span><strong>{formatQuantity(totalPieces)}</strong></div>
          <div className="summary-card"><span>処理</span><strong>逆仕訳</strong></div>
        </div>

        <div className="delivery-receipt-list reverse-receipt-line-list">
          {receiptLines.map((line) => {
            const product = products.find((item) => item.id === line.productId);
            const inboundLine = inboundShipmentLines.find((item) => item.id === line.inboundShipmentLineId);
            return (
              <article className="delivery-receipt-card reverse-receipt-line-card" key={line.id}>
                <div>
                  <strong>{productDisplayName(product, line.productId || '商品未設定')}</strong>
                  <p>契約No: {inboundLine?.contractNo || '-'}</p>
                  <p>数量: {formatQuantity(line.receivedWeight, 'kg')} / {formatQuantity(line.receivedPieces)}</p>
                  <p>倉庫: {line.warehouseName || '-'} / 賞味期限: {line.expiryDate || '-'}</p>
                </div>
                <span className="info-badge warning">取消対象</span>
              </article>
            );
          })}
        </div>

        <label className="field-label full-width">
          取消理由
          <textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={4}
            placeholder="例: 入荷数量の誤入力のため"
            required
          />
        </label>

        <p className="error-text">
          既に引当・出荷・後続の在庫変更がある入荷は取消できません。既存の入荷履歴は削除せず、在庫履歴へ逆仕訳を追加します。
        </p>

        <div className="modal-actions inbound-receipt-dialog-actions">
          <span className="inline-helper">取消は1トランザクションで実行され、途中失敗時は在庫数量を変更しません。</span>
          <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>キャンセル</button>
          <button type="submit" className="primary-button danger-action-button" disabled={saving}>
            {saving ? '取消中...' : '入荷取消'}
          </button>
        </div>
      </form>
    </div>
  );
}

function InboundReceiptDialog({ shipment, products, form, saving, onChange, onLineChange, onClose, onSubmit }) {
  const enabledLines = form.lines.filter((line) => line.enabled);
  const selectedWeightTotal = enabledLines.reduce((sum, line) => sum + parseNumber(line.receivedWeight), 0);
  const selectedPieceTotal = enabledLines.reduce((sum, line) => sum + parseNumber(line.receivedPieces), 0);

  const columns = [
    {
      key: 'enabled',
      label: '対象',
      width: '72px',
      render: (line) => {
        const formLine = form.lines.find((item) => item.inboundShipmentLineId === line.id) || defaultReceiptLine(line);
        return (
          <input
            type="checkbox"
            checked={Boolean(formLine.enabled)}
            disabled={!canReceiveInboundLine(line)}
            onChange={(event) => onLineChange(line.id, 'enabled', event.target.checked)}
          />
        );
      },
    },
    { key: 'product', label: '商品', minWidth: '220px', render: (line) => productDisplayName(products.find((product) => product.id === line.matchedProductId), line.productNameRaw || '未照合') },
    { key: 'contractNo', label: '契約No', minWidth: '110px', render: (line) => line.contractNo || '-' },
    { key: 'plannedPieces', label: '予定個数', width: '100px', render: (line) => formatQuantity(line.plannedPieces ?? line.quantityPieces) },
    { key: 'plannedWeight', label: '予定重量', width: '110px', render: (line) => formatQuantity(line.plannedWeight ?? line.weight, line.unit) },
    {
      key: 'receivedPieces',
      label: '実入荷個数',
      width: '130px',
      render: (line) => {
        const formLine = form.lines.find((item) => item.inboundShipmentLineId === line.id) || defaultReceiptLine(line);
        return (
          <input
            inputMode="decimal"
            value={formLine.receivedPieces}
            disabled={!formLine.enabled || !canReceiveInboundLine(line)}
            onChange={(event) => onLineChange(line.id, 'receivedPieces', event.target.value)}
          />
        );
      },
    },
    {
      key: 'receivedWeight',
      label: '実入荷重量',
      width: '130px',
      render: (line) => {
        const formLine = form.lines.find((item) => item.inboundShipmentLineId === line.id) || defaultReceiptLine(line);
        return (
          <input
            inputMode="decimal"
            value={formLine.receivedWeight}
            disabled={!formLine.enabled || !canReceiveInboundLine(line)}
            onChange={(event) => onLineChange(line.id, 'receivedWeight', event.target.value)}
          />
        );
      },
    },
    { key: 'unitPrice', label: '単価', width: '110px', render: (line) => formatQuantity(line.unitPrice, line.currency) },
    {
      key: 'expiryDate',
      label: '賞味期限',
      minWidth: '140px',
      render: (line) => {
        const formLine = form.lines.find((item) => item.inboundShipmentLineId === line.id) || defaultReceiptLine(line);
        return <input type="date" value={formLine.expiryDate} disabled={!formLine.enabled || !canReceiveInboundLine(line)} onChange={(event) => onLineChange(line.id, 'expiryDate', event.target.value)} />;
      },
    },
    {
      key: 'warehouse',
      label: '倉庫',
      minWidth: '160px',
      render: (line) => {
        const formLine = form.lines.find((item) => item.inboundShipmentLineId === line.id) || defaultReceiptLine(line);
        return <input value={formLine.warehouseName} disabled={!formLine.enabled || !canReceiveInboundLine(line)} onChange={(event) => onLineChange(line.id, 'warehouseName', event.target.value)} />;
      },
    },
    {
      key: 'difference',
      label: '差異',
      minWidth: '150px',
      render: (line) => {
        const formLine = form.lines.find((item) => item.inboundShipmentLineId === line.id) || defaultReceiptLine(line);
        const weightDiff = emptyToNumber(formLine.receivedWeight) === null ? null : parseNumber(formLine.receivedWeight) - parseNumber(line.plannedWeight ?? line.weight);
        const pieceDiff = emptyToNumber(formLine.receivedPieces) === null ? null : parseNumber(formLine.receivedPieces) - parseNumber(line.plannedPieces ?? line.quantityPieces);
        return (
          <span className="receipt-difference">
            W {weightDiff === null ? '-' : `${weightDiff > 0 ? '+' : ''}${formatPrice(weightDiff)} ${line.unit || ''}`}
            <br />
            P {pieceDiff === null ? '-' : `${pieceDiff > 0 ? '+' : ''}${formatPrice(pieceDiff)}`}
          </span>
        );
      },
    },
  ];

  return (
    <div className="modal-backdrop inbound-receipt-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal-panel inbound-receipt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbound-receipt-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="section-heading inbound-receipt-dialog-header">
          <div>
            <p className="eyebrow">Inbound receipt</p>
            <h2 id="inbound-receipt-title">入荷確定</h2>
            <p className="inline-helper">{shipment.supplierName || '-'} / {shipment.documentNumber || shipment.sourceFileName || '-'}</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>閉じる</button>
        </div>

        <div className="dashboard-metrics inbound-receipt-summary">
          <div className="summary-card"><span>対象明細</span><strong>{enabledLines.length}</strong></div>
          <div className="summary-card"><span>実入荷重量</span><strong>{formatQuantity(selectedWeightTotal, 'kg')}</strong></div>
          <div className="summary-card"><span>実入荷個数</span><strong>{formatQuantity(selectedPieceTotal)}</strong></div>
          <div className="summary-card"><span>在庫反映</span><strong>確定時のみ</strong></div>
        </div>

        <div className="inventory-form-grid inbound-receipt-meta">
          <label className="field-label">
            入荷日時
            <input type="datetime-local" value={form.receivedAt} onChange={(event) => onChange('receivedAt', event.target.value)} />
          </label>
          <label className="field-label">
            共通倉庫
            <input value={form.warehouseName} onChange={(event) => onChange('warehouseName', event.target.value)} placeholder="明細側の倉庫を優先" />
          </label>
          <label className="field-label full-width">
            メモ
            <textarea value={form.memo} onChange={(event) => onChange('memo', event.target.value)} rows={3} />
          </label>
        </div>

        <DesktopTable
          className="inventory-common-table inbound-receipt-table"
          columns={columns}
          rows={shipment.lines || []}
          getRowKey={(line) => line.id}
          minWidth={1360}
        />

        <div className="card-list-mobile inbound-receipt-card-list">
          {(shipment.lines || []).map((line) => {
            const formLine = form.lines.find((item) => item.inboundShipmentLineId === line.id) || defaultReceiptLine(line);
            const disabled = !formLine.enabled || !canReceiveInboundLine(line);
            return (
              <article className="product-card inbound-receipt-card" key={line.id}>
                <div className="company-heading">
                  <p>{line.contractNo || '契約No未取得'} / {inboundLineStatusLabel(line.status)}</p>
                  <h3>{productDisplayName(products.find((product) => product.id === line.matchedProductId), line.productNameRaw || '未照合')}</h3>
                  <span className={`info-badge ${matchBadgeClass(line.matchStatus)}`}>{matchStatusLabel(line.matchStatus)}</span>
                </div>
                <label className="inline-check">
                  <input type="checkbox" checked={Boolean(formLine.enabled)} disabled={!canReceiveInboundLine(line)} onChange={(event) => onLineChange(line.id, 'enabled', event.target.checked)} />
                  入荷対象
                </label>
                <dl className="company-details">
                  <div><dt>予定個数</dt><dd>{formatQuantity(line.plannedPieces ?? line.quantityPieces)}</dd></div>
                  <div><dt>予定重量</dt><dd>{formatQuantity(line.plannedWeight ?? line.weight, line.unit)}</dd></div>
                  <div><dt>入荷済個数</dt><dd>{formatQuantity(line.receivedPiecesTotal)}</dd></div>
                  <div><dt>入荷済重量</dt><dd>{formatQuantity(line.receivedWeightTotal, line.unit)}</dd></div>
                  <div><dt>残個数</dt><dd>{formatQuantity(lineRemainingPieces(line))}</dd></div>
                  <div><dt>残重量</dt><dd>{formatQuantity(lineRemainingWeight(line), line.unit)}</dd></div>
                  <div><dt>単価</dt><dd>{formatQuantity(line.unitPrice, line.currency)}</dd></div>
                  <div><dt>倉庫</dt><dd>{line.warehouseName || '-'}</dd></div>
                </dl>
                <div className="inventory-form-grid compact-grid">
                  <label className="field-label">実入荷個数<input inputMode="decimal" value={formLine.receivedPieces} disabled={disabled} onChange={(event) => onLineChange(line.id, 'receivedPieces', event.target.value)} /></label>
                  <label className="field-label">実入荷重量<input inputMode="decimal" value={formLine.receivedWeight} disabled={disabled} onChange={(event) => onLineChange(line.id, 'receivedWeight', event.target.value)} /></label>
                  <label className="field-label">単価<input inputMode="decimal" value={formLine.purchaseUnitCost} disabled={disabled} onChange={(event) => onLineChange(line.id, 'purchaseUnitCost', event.target.value)} /></label>
                  <label className="field-label">賞味期限<input type="date" value={formLine.expiryDate} disabled={disabled} onChange={(event) => onLineChange(line.id, 'expiryDate', event.target.value)} /></label>
                  <label className="field-label full-width">倉庫<input value={formLine.warehouseName} disabled={disabled} onChange={(event) => onLineChange(line.id, 'warehouseName', event.target.value)} /></label>
                </div>
              </article>
            );
          })}
        </div>

        <div className="modal-actions inbound-receipt-dialog-actions">
          <span className="inline-helper">確定後、inventory_lots と inventory_movements へ1トランザクションで反映します。</span>
          <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>キャンセル</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? '確定中...' : '入荷確定'}</button>
        </div>
      </form>
    </div>
  );
}

function InventoryAdjustmentDialog({ inventory, form, onChange, onClose, onSubmit }) {
  const currentQuantity = parseNumber(inventory.quantity);
  const inputQuantity = parseNumber(form.quantity);
  const nextQuantity = form.mode === 'delta' ? currentQuantity + inputQuantity : inputQuantity;
  const difference = form.quantity === '' ? 0 : nextQuantity - currentQuantity;
  const reservedQuantity = parseNumber(inventory.reservedQuantity);

  return (
    <div className="modal-backdrop inventory-adjustment-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal-panel inventory-adjustment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-adjustment-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inventory adjustment</p>
            <h2 id="inventory-adjustment-title">在庫調整</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>閉じる</button>
        </div>

        <div className="dashboard-metrics inventory-adjustment-summary">
          <div className="summary-card">
            <span>現在庫</span>
            <strong>{currentQuantity.toLocaleString('ja-JP')} {inventory.unit}</strong>
          </div>
          <div className="summary-card">
            <span>引当済</span>
            <strong>{reservedQuantity.toLocaleString('ja-JP')} {inventory.unit}</strong>
          </div>
          <div className="summary-card">
            <span>調整後数量</span>
            <strong>{nextQuantity.toLocaleString('ja-JP')} {inventory.unit}</strong>
          </div>
          <div className={`summary-card ${difference < 0 ? 'inventory-danger' : difference > 0 ? 'inventory-expiring' : ''}`}>
            <span>増減</span>
            <strong>{difference > 0 ? '+' : ''}{difference.toLocaleString('ja-JP')} {inventory.unit}</strong>
          </div>
        </div>

        <div className="inventory-form-grid">
          <label className="field-label">
            入力方式
            <select value={form.mode} onChange={(event) => onChange('mode', event.target.value)}>
              <option value="absolute">調整後数量</option>
              <option value="delta">増減数量</option>
            </select>
          </label>
          <label className="field-label">
            {form.mode === 'delta' ? '増減数量' : '調整後数量'}
            <input
              inputMode="decimal"
              value={form.quantity}
              onChange={(event) => onChange('quantity', event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            調整理由
            <select value={form.reason} onChange={(event) => onChange('reason', event.target.value)}>
              {ADJUSTMENT_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
            </select>
          </label>
          <label className="field-label">
            担当者
            <input value={form.handlerName} onChange={(event) => onChange('handlerName', event.target.value)} />
          </label>
          <label className="field-label full-width">
            メモ
            <textarea value={form.memo} onChange={(event) => onChange('memo', event.target.value)} />
          </label>
        </div>

        <div className="customer-editor-actions">
          <button type="button" className="ghost-button" onClick={onClose}>キャンセル</button>
          <button type="submit" className="primary-button">在庫調整を保存</button>
        </div>
      </form>
    </div>
  );
}

function InventoryInboundForm({ form, products, suppliers, setField, onSubmit }) {
  return (
    <section className="detail-section inventory-form-section">
      <div className="section-heading">
        <h2>＋ 在庫登録・入庫</h2>
        <span className="info-badge ready">保存後は在庫一覧へ戻ります</span>
      </div>
      <form className="inventory-form-grid" onSubmit={onSubmit}>
        <InventoryProductSelect value={form.productId} products={products} onChange={(value) => setField('productId', value)} />
        <label className="field-label">数量<input inputMode="decimal" value={form.quantity} onChange={(event) => setField('quantity', event.target.value)} required /></label>
        <label className="field-label">単位<select value={form.unit} onChange={(event) => setField('unit', event.target.value)}>{INVENTORY_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        <label className="field-label">ロット番号<input value={form.lot} onChange={(event) => setField('lot', event.target.value)} /></label>
        <label className="field-label">賞味期限<input type="date" value={form.expiryDate} onChange={(event) => setField('expiryDate', event.target.value)} /></label>
        <label className="field-label">製造日<input type="date" value={form.manufactureDate} onChange={(event) => setField('manufactureDate', event.target.value)} /></label>
        <label className="field-label">保管場所<input value={form.location} onChange={(event) => setField('location', event.target.value)} /></label>
        <label className="field-label">仕入先<select value={form.supplierId} onChange={(event) => setField('supplierId', event.target.value)}><option value="">未選択</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name || supplier.companyName || '仕入先名未設定'}</option>)}</select></label>
        <label className="field-label">仕入単価<input inputMode="decimal" value={form.cost} onChange={(event) => setField('cost', event.target.value)} /></label>
        <label className="field-label">入庫日<input type="date" value={form.receivedDate} onChange={(event) => setField('receivedDate', event.target.value)} /></label>
        <label className="field-label">伝票番号<input value={form.voucherNumber} onChange={(event) => setField('voucherNumber', event.target.value)} /></label>
        <label className="field-label">担当者<input value={form.handlerName} onChange={(event) => setField('handlerName', event.target.value)} /></label>
        <label className="field-label">入庫理由<select value={form.reason} onChange={(event) => setField('reason', event.target.value)}>{INVENTORY_INBOUND_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
        <label className="field-label">現物/先物<select value={form.stockType} onChange={(event) => setField('stockType', event.target.value)}>{INVENTORY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="field-label">在庫ステータス<select value={form.inventoryStatus} onChange={(event) => setField('inventoryStatus', event.target.value)}>{INVENTORY_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="field-label">在庫コード<input value={form.inventoryCode} placeholder="LOT-2026-001" onChange={(event) => setField('inventoryCode', event.target.value)} onBlur={(event) => setField('inventoryCode', normalizeInventoryCode(event.target.value))} /></label>
        <label className="field-label full-width">メモ<textarea value={form.memo} onChange={(event) => setField('memo', event.target.value)} /></label>
        <button className="primary-button full-width" type="submit">＋ 在庫登録</button>
      </form>
    </section>
  );
}

function InventoryOutboundForm({ form, inventories, products, selectedInventory, setField, onSubmit }) {
  return (
    <section className="detail-section inventory-form-section">
      <div className="section-heading">
        <h2>－ 出庫</h2>
        {selectedInventory?.expiryDate && <span className="info-badge muted">賞味期限 {selectedInventory.expiryDate}</span>}
      </div>
      <form className="inventory-form-grid" onSubmit={onSubmit}>
        <label className="field-label full-width">
          商品・ロット
          <select value={form.inventoryId} onChange={(event) => setField('inventoryId', event.target.value)} required>
            <option value="">出庫する在庫を選択</option>
            {inventories.map((inventory) => {
              const product = products.find((item) => item.id === inventory.productId);
              return <option value={inventory.id} key={inventory.id}>{productDisplayName(product, '商品未設定')} / LOT {inventory.lot || '-'} / {inventory.quantity || 0}{inventory.unit}</option>;
            })}
          </select>
        </label>
        <label className="field-label">数量<input inputMode="decimal" value={form.quantity} onChange={(event) => setField('quantity', event.target.value)} required /></label>
        <label className="field-label">出庫日<input type="date" value={form.receivedDate} onChange={(event) => setField('receivedDate', event.target.value)} /></label>
        <label className="field-label">担当者<input value={form.handlerName} onChange={(event) => setField('handlerName', event.target.value)} /></label>
        <label className="field-label">出庫理由<select value={form.reason} onChange={(event) => setField('reason', event.target.value)}>{INVENTORY_OUTBOUND_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
        <label className="field-label full-width">メモ<textarea value={form.memo} onChange={(event) => setField('memo', event.target.value)} /></label>
        <button className="primary-button full-width" type="submit">出庫を記録</button>
      </form>
    </section>
  );
}

function InventoryStocktakeForm({ form, inventories, products, selectedInventory, setField, onSubmit }) {
  const theoretical = parseNumber(selectedInventory?.quantity);
  const actual = parseNumber(form.quantity);
  const difference = form.quantity === '' ? 0 : actual - theoretical;

  return (
    <section className="detail-section inventory-form-section">
      <div className="section-heading">
        <h2>棚卸</h2>
        <span className={`info-badge ${difference === 0 ? 'ready' : 'muted'}`}>差異 {difference.toLocaleString('ja-JP')}</span>
      </div>
      <form className="inventory-form-grid" onSubmit={onSubmit}>
        <label className="field-label full-width">
          対象在庫
          <select value={form.inventoryId} onChange={(event) => setField('inventoryId', event.target.value)} required>
            <option value="">棚卸する在庫を選択</option>
            {inventories.map((inventory) => {
              const product = products.find((item) => item.id === inventory.productId);
              return <option value={inventory.id} key={inventory.id}>{productDisplayName(product, '商品未設定')} / LOT {inventory.lot || '-'} / 理論 {inventory.quantity || 0}{inventory.unit}</option>;
            })}
          </select>
        </label>
        <div className="summary-card"><span>理論在庫</span><strong>{theoretical.toLocaleString('ja-JP')} {selectedInventory?.unit || ''}</strong></div>
        <label className="field-label">実在庫<input inputMode="decimal" value={form.quantity} onChange={(event) => setField('quantity', event.target.value)} required /></label>
        <label className="field-label">差異理由<select value={form.reason} onChange={(event) => setField('reason', event.target.value)}>{INVENTORY_INBOUND_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
        <label className="field-label">更新者<input value={form.handlerName} onChange={(event) => setField('handlerName', event.target.value)} /></label>
        <label className="field-label full-width">メモ<textarea value={form.memo} onChange={(event) => setField('memo', event.target.value)} /></label>
        <button className="primary-button full-width" type="submit">棚卸結果を保存</button>
      </form>
    </section>
  );
}
