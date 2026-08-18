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

const TABS = [
  { key: 'list', label: '在庫一覧' },
  { key: 'arrival', label: '入荷予定' },
  { key: 'inbound', label: '入庫' },
  { key: 'outbound', label: '出庫' },
  { key: 'stocktake', label: '棚卸' },
  { key: 'history', label: '入出庫履歴' },
];

const ALL = 'all';
const ADJUSTMENT_REASONS = ['棚卸差異', '破損', '廃棄', 'サンプル使用', '入力ミス修正', 'その他'];

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
  supplierProductAliases = [],
  saveInboundShipmentPreview,
  updateInboundShipmentLine,
  addSupplierProductAlias,
  confirmInboundReceipt,
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
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('eigyo-techo-inventory-tab') || 'list');
  const [keyword, setKeyword] = useState(() => localStorage.getItem('eigyo-techo-inventory-keyword') || '');
  const [filter, setFilter] = useState(() => localStorage.getItem('eigyo-techo-inventory-filter') || ALL);
  const [form, setForm] = useState(() => emptyMovementForm(initialAction || {}, user));
  const [adjustmentInventoryId, setAdjustmentInventoryId] = useState('');
  const [adjustmentForm, setAdjustmentForm] = useState(() => emptyAdjustmentForm(null, user));
  const [deliveryNoticePreview, setDeliveryNoticePreview] = useState(null);
  const [deliveryNoticeParsing, setDeliveryNoticeParsing] = useState(false);
  const [deliveryNoticeSaving, setDeliveryNoticeSaving] = useState(false);
  const [deliveryNoticeError, setDeliveryNoticeError] = useState('');
  const [selectedInboundShipmentId, setSelectedInboundShipmentId] = useState('');
  const [receiptShipmentId, setReceiptShipmentId] = useState('');
  const [receiptForm, setReceiptForm] = useState(() => buildReceiptForm(null));
  const [receiptSaving, setReceiptSaving] = useState(false);
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

  useEffect(() => {
    if (!initialAction) return;
    setActiveTab(initialAction.tab || 'inbound');
    setForm(emptyMovementForm(initialAction, user));
    onInitialHandled?.();
  }, [initialAction, onInitialHandled, user]);

  const selectedProduct = products.find((product) => product.id === form.productId);
  const selectedInventory = inventories.find((inventory) => inventory.id === form.inventoryId);
  const adjustmentInventory = inventories.find((inventory) => inventory.id === adjustmentInventoryId);
  const selectedInboundShipment = inboundShipments.find((shipment) => shipment.id === selectedInboundShipmentId) || inboundShipments[0];
  const receiptShipment = inboundShipments.find((shipment) => shipment.id === receiptShipmentId);
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
      const { parseDeliveryNoticePdfFile } = await import('../services/deliveryNoticePdfParser.js');
      const preview = await parseDeliveryNoticePdfFile(file);
      setDeliveryNoticePreview(preview);
      setToast('デリバリー予定案内PDFを解析しました。在庫にはまだ反映していません。');
    } catch (parseError) {
      setDeliveryNoticePreview(null);
      setDeliveryNoticeError(parseError.message || 'PDF解析に失敗しました。');
    } finally {
      setDeliveryNoticeParsing(false);
    }
  }

  async function handleSaveDeliveryNoticePreview() {
    if (!deliveryNoticePreview) return;
    setDeliveryNoticeSaving(true);
    setDeliveryNoticeError('');
    setToast('');
    setError('');

    try {
      const result = await saveInboundShipmentPreview?.(deliveryNoticePreview);
      if (result?.status === 'duplicate') {
        setSelectedInboundShipmentId(result.shipmentId);
        setToast('このPDFはすでに取り込み済みです。既存の入荷予定を表示しました。');
      } else {
        setSelectedInboundShipmentId(result?.shipmentId || '');
        setToast('入荷予定として保存しました。まだ在庫数量には反映していません。');
      }
    } catch (saveError) {
      setDeliveryNoticeError(saveError.message || '入荷予定の保存に失敗しました。');
    } finally {
      setDeliveryNoticeSaving(false);
    }
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
            minWidth={1600}
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
          onUpload={handleDeliveryNoticeUpload}
          onSavePreview={handleSaveDeliveryNoticePreview}
          saving={deliveryNoticeSaving}
          parsing={deliveryNoticeParsing}
          preview={deliveryNoticePreview}
          error={deliveryNoticeError}
          inboundShipments={inboundShipments}
          inboundReceipts={inboundReceipts}
          inboundReceiptLines={inboundReceiptLines}
          selectedInboundShipment={selectedInboundShipment}
          onSelectInboundShipment={setSelectedInboundShipmentId}
          products={products}
          aliases={supplierProductAliases}
          onLineChange={handleInboundLineChange}
          onSaveAlias={handleSaveInboundAlias}
          onOpenReceipt={openInboundReceiptDialog}
          syncState={inboundShipmentSyncState}
          syncError={inboundShipmentSyncError}
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
    </main>
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

function DeliveryNoticeImportPanel({
  onUpload,
  onSavePreview,
  onLineChange,
  onSaveAlias,
  onSelectInboundShipment,
  parsing,
  saving,
  preview,
  error,
  inboundShipments = [],
  inboundReceipts = [],
  inboundReceiptLines = [],
  selectedInboundShipment = null,
  products = [],
  onOpenReceipt,
  syncState = '',
  syncError = '',
}) {
  const shipmentColumns = [
    { key: 'createdAt', label: '取込日', minWidth: '120px', render: (row) => String(row.createdAt || '').slice(0, 10) || '-' },
    { key: 'supplierName', label: '仕入先', minWidth: '180px', render: (row) => row.supplierName || '-' },
    { key: 'documentNumber', label: '帳票番号', minWidth: '120px', render: (row) => row.documentNumber || '-' },
    { key: 'contractNo', label: '契約No', minWidth: '120px', render: (row) => [...new Set((row.lines || []).map((line) => line.contractNo).filter(Boolean))].join(' / ') || '-' },
    { key: 'customs', label: '通関予定', minWidth: '120px', render: (row) => (row.lines || [])[0]?.customsClearancePlannedDate || '-' },
    { key: 'lineCount', label: '明細数', width: '90px', render: (row) => row.lines?.length || 0 },
    { key: 'unmatched', label: '未照合', width: '90px', render: (row) => (row.lines || []).filter((line) => line.matchStatus !== 'matched' && line.matchStatus !== 'manual' && line.status !== 'excluded').length },
    { key: 'received', label: '入荷状況', minWidth: '130px', render: (row) => `${(row.lines || []).filter((line) => line.status === 'received').length}/${row.lines?.length || 0}` },
    { key: 'status', label: 'Status', width: '110px', render: (row) => <span className={`info-badge ${inboundStatusBadgeClass(row.status)}`}>{inboundStatusLabel(row.status)}</span> },
  ];

  const detailColumns = [
    { key: 'lineNumber', label: '行', width: '64px', render: (row) => row.lineNumber || '-' },
    { key: 'contractNo', label: '契約No', minWidth: '110px', render: (row) => row.contractNo || '-' },
    { key: 'brand', label: 'ブランド', minWidth: '120px', render: (row) => row.brand || '-' },
    { key: 'productName', label: '商品名', minWidth: '240px', render: (row) => row.productName || '-' },
    { key: 'pieces', label: '個数', width: '80px', render: (row) => formatPrice(row.pieceCount) || '-' },
    { key: 'weight', label: '重量', width: '100px', render: (row) => row.weight !== '' ? `${formatPrice(row.weight)} ${row.unit || ''}` : '-' },
    { key: 'unitPrice', label: '単価', width: '110px', render: (row) => row.unitPrice !== '' ? `${formatPrice(row.unitPrice)} ${row.currency || ''}` : '-' },
    { key: 'origin', label: '原産国', minWidth: '120px', render: (row) => row.originCountry || '-' },
    { key: 'factory', label: '工場No', width: '90px', render: (row) => row.factoryNo || '-' },
    { key: 'customs', label: '通関予定', minWidth: '120px', render: (row) => row.customsClearancePlannedDate || '-' },
    { key: 'packing', label: 'Packing', minWidth: '210px', render: (row) => row.packingFrom || row.packingTo ? `${row.packingFrom || '-'} ～ ${row.packingTo || '-'}` : '-' },
    { key: 'expiry', label: '賞味期限', minWidth: '120px', render: (row) => row.expiryDate || '-' },
    { key: 'warehouse', label: '倉庫', minWidth: '160px', render: (row) => row.warehouse || '-' },
    { key: 'warnings', label: 'Warning', minWidth: '180px', render: (row) => row.warnings.length ? row.warnings.join(' / ') : 'なし' },
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
    { key: 'warnings', label: 'Warning', minWidth: '180px', render: (line) => line.warnings?.length ? line.warnings.join(' / ') : 'なし' },
  ];

  const receiptRows = inboundReceipts
    .filter((receipt) => receipt.inboundShipmentId === selectedInboundShipment?.id)
    .map((receipt) => ({
      ...receipt,
      lines: inboundReceiptLines.filter((line) => line.inboundReceiptId === receipt.id),
    }));

  const hasReceivableLines = (selectedInboundShipment?.lines || []).some(canReceiveInboundLine);

  return (
    <section className="detail-section delivery-notice-import-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Delivery notice PDF</p>
          <h2>入荷予定PDF取込</h2>
          <p className="inline-helper">Phase2は入荷予定DB登録と商品照合までです。在庫登録、入庫RPC実行は行いません。</p>
        </div>
        <label className="primary-button delivery-notice-upload-button">
          PDFアップロード
          <input type="file" accept="application/pdf,.pdf" onChange={onUpload} />
        </label>
      </div>

      {parsing && <p className="notice-text">PDFを解析しています...</p>}
      {saving && <p className="notice-text">入荷予定として保存しています...</p>}
      {error && <p className="error-text">{error}</p>}
      {syncError && <p className="error-text">{syncError}</p>}

      {!preview && !parsing && inboundShipments.length === 0 && (
        <div className="empty-state delivery-notice-empty">
          <h3>デリバリー予定案内PDFを選択してください</h3>
          <p>日鉄物産の帳票を解析し、契約No、ブランド、商品名、重量、単価、通関予定日などを確認できます。</p>
        </div>
      )}

      {preview && (
        <div className="delivery-notice-preview">
          <div className="delivery-notice-summary">
            <div className="summary-card"><span>発行日</span><strong>{preview.issueDate || '-'}</strong></div>
            <div className="summary-card"><span>帳票番号</span><strong>{preview.documentNumber || '-'}</strong></div>
            <div className="summary-card"><span>仕入先</span><strong>{preview.supplier || '-'}</strong></div>
            <div className="summary-card"><span>明細数</span><strong>{preview.lines.length}</strong></div>
          </div>

          <dl className="company-details delivery-notice-file-details">
            <div><dt>ファイル名</dt><dd>{preview.fileName || '-'}</dd></div>
            <div><dt>file_hash</dt><dd>{preview.fileHash || '-'}</dd></div>
            <div><dt>ページ数</dt><dd>{preview.pageCount || 0}</dd></div>
          </dl>

          {preview.warnings.length > 0 && (
            <div className="delivery-notice-warning-box">
              <h3>PDF全体のWarning</h3>
              <ul>
                {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}

          <div className="section-heading">
            <h3>解析明細</h3>
            <span className="info-badge muted">未取得項目はWarningで確認</span>
          </div>

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
            minWidth={1780}
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
                  <div><dt>個数</dt><dd>{formatPrice(line.pieceCount) || '-'}</dd></div>
                  <div><dt>重量</dt><dd>{line.weight !== '' ? `${formatPrice(line.weight)} ${line.unit || ''}` : '-'}</dd></div>
                  <div><dt>単価</dt><dd>{line.unitPrice !== '' ? `${formatPrice(line.unitPrice)} ${line.currency || ''}` : '-'}</dd></div>
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
        </div>
      )}

      {inboundShipments.length > 0 && (
        <div className="delivery-notice-saved">
          <div className="section-heading">
            <div>
              <h3>保存済み入荷予定</h3>
              <p className="inline-helper">PDF単位で保存した入荷予定です。入荷確定までは在庫数量に影響しません。</p>
            </div>
            <span className="info-badge muted">{syncState || 'supabase'}</span>
          </div>

          <DesktopTable
            className="inventory-common-table delivery-notice-shipment-table"
            columns={shipmentColumns}
            rows={inboundShipments}
            getRowKey={(row) => row.id}
            minWidth={1040}
            actions={(shipment) => (
              <>
                <button type="button" className="ghost-button" onClick={() => onSelectInboundShipment?.(shipment.id)}>
                  詳細
                </button>
                <button type="button" className="primary-button" disabled={!shipment.lines?.some(canReceiveInboundLine)} onClick={() => onOpenReceipt?.(shipment)}>
                  入荷確定
                </button>
              </>
            )}
          />

          <div className="card-list-mobile delivery-notice-card-list">
            {inboundShipments.map((shipment) => (
              <button
                type="button"
                className={`product-card delivery-notice-card delivery-notice-card-button ${selectedInboundShipment?.id === shipment.id ? 'active' : ''}`}
                key={shipment.id}
                onClick={() => onSelectInboundShipment?.(shipment.id)}
              >
                <div className="company-heading">
                  <p>{String(shipment.createdAt || '').slice(0, 10)} / {inboundStatusLabel(shipment.status)}</p>
                  <h3>{shipment.supplierName || '仕入先未取得'}</h3>
                </div>
                <dl className="company-details">
                  <div><dt>帳票番号</dt><dd>{shipment.documentNumber || '-'}</dd></div>
                  <div><dt>契約No</dt><dd>{[...new Set((shipment.lines || []).map((line) => line.contractNo).filter(Boolean))].join(' / ') || '-'}</dd></div>
                  <div><dt>通関予定</dt><dd>{shipment.lines?.[0]?.customsClearancePlannedDate || '-'}</dd></div>
                  <div><dt>明細数</dt><dd>{shipment.lines?.length || 0}</dd></div>
                  <div><dt>未照合</dt><dd>{(shipment.lines || []).filter((line) => line.matchStatus !== 'matched' && line.matchStatus !== 'manual' && line.status !== 'excluded').length}</dd></div>
                  <div><dt>入荷状況</dt><dd>{(shipment.lines || []).filter((line) => line.status === 'received').length}/{shipment.lines?.length || 0}</dd></div>
                </dl>
                <div className="card-actions">
                  <span className={`info-badge ${inboundStatusBadgeClass(shipment.status)}`}>{inboundStatusLabel(shipment.status)}</span>
                  <span className="ghost-button">詳細</span>
                  {shipment.lines?.some(canReceiveInboundLine) && (
                    <span className="primary-button">入荷確定</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedInboundShipment && (
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
                  <div><dt>通関予定</dt><dd>{line.customsClearancePlannedDate || '-'}</dd></div>
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

      {selectedInboundShipment && receiptRows.length > 0 && (
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
                </div>
                <span className="info-badge ready">{receipt.lines.length}明細</span>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
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
