import { createContext, useContext } from 'react';
import { useAdoptions } from '../modules/products/hooks/useAdoptions.js';
import { useAttachments } from '../shared/hooks/useAttachments.js';
import { useBusinessCards } from '../modules/businessCards/hooks/useBusinessCards.js';
import { useComplaints } from '../modules/claims/hooks/useComplaints.js';
import { useContacts } from '../modules/contacts/hooks/useContacts.js';
import { useCustomers } from '../modules/customers/hooks/useCustomers.js';
import { useProjects } from '../modules/deals/hooks/useProjects.js';
import { useEvents } from '../modules/calendar/hooks/useEvents.js';
import { useTasks } from '../modules/calendar/hooks/useTasks.js';
import { useInventory } from '../modules/inventory/hooks/useInventory.js';
import { useInvoices } from '../modules/invoices/hooks/useInvoices.js';
import { useBrands } from '../modules/products/hooks/useBrands.js';
import { useProductAssets } from '../modules/products/hooks/useProductAssets.js';
import { useProducts } from '../modules/products/hooks/useProducts.js';
import { useCustomerProductPrices } from '../modules/prices/hooks/useCustomerProductPrices.js';
import { useQuotes } from '../modules/quotes/hooks/useQuotes.js';
import { useSalesOrders } from '../modules/salesOrders/hooks/useSalesOrders.js';
import { useSamples } from '../modules/samples/hooks/useSamples.js';
import { useShipments } from '../modules/shipments/hooks/useShipments.js';
import { useDeliveryNotes } from '../modules/deliveryNotes/hooks/useDeliveryNotes.js';
import { useIssuers } from '../modules/settings/hooks/useIssuers.js';
import { useSuppliers } from '../modules/suppliers/hooks/useSuppliers.js';

const AppDataContext = createContext(null);

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function AppDataProvider({ userId, children }) {
  const customersState = useCustomers(userId);
  const productsState = useProducts(userId);
  const productAssetsState = useProductAssets(userId);
  const brandsState = useBrands(userId);
  const pricesState = useCustomerProductPrices(userId);
  const inventoryState = useInventory(userId);
  const adoptionsState = useAdoptions(userId);
  const samplesState = useSamples(userId);
  const quotesState = useQuotes(userId);
  const invoicesState = useInvoices(userId);
  const salesOrdersState = useSalesOrders(userId);
  const shipmentsState = useShipments(userId);
  const deliveryNotesState = useDeliveryNotes(userId);
  const issuersState = useIssuers(userId);
  const projectsState = useProjects(userId);
  const contactsState = useContacts(userId);
  const suppliersState = useSuppliers(userId);
  const businessCardsState = useBusinessCards(userId);
  const complaintsState = useComplaints(userId);
  const eventsState = useEvents(userId);
  const tasksState = useTasks(userId);
  const attachmentsState = useAttachments(userId);

  const value = {
    customers: toArray(customersState.customers),
    addCustomer: customersState.addCustomer,
    importCompanyName: customersState.importCompanyName,
    updateCustomer: customersState.updateCustomer,
    removeCustomer: customersState.removeCustomer,
    isSaved: customersState.isSaved,
    reloadFromCloud: customersState.reloadFromCloud,
    syncError: customersState.syncError,
    syncState: customersState.syncState,

    products: toArray(productsState.products),
    addProduct: productsState.addProduct,
    updateProduct: productsState.updateProduct,
    removeProduct: productsState.removeProduct,

    productAssets: toArray(productAssetsState.records),
    addProductAsset: productAssetsState.addRecord,
    updateProductAsset: productAssetsState.updateRecord,
    removeProductAsset: productAssetsState.removeRecord,

    brands: toArray(brandsState.records),
    addBrand: brandsState.addRecord,
    updateBrand: brandsState.updateRecord,
    removeBrand: brandsState.removeRecord,

    customerProductPrices: toArray(pricesState.records),
    customerProductPriceHistory: toArray(pricesState.history),
    addCustomerProductPrice: pricesState.addRecord,
    updateCustomerProductPrice: pricesState.updateRecord,
    removeCustomerProductPrice: pricesState.removeRecord,
    deactivateCustomerProductPrice: pricesState.deactivateRecord,
    addCustomerProductPriceHistory: pricesState.addHistoryRecord,
    customerProductPriceSyncState: pricesState.syncState,
    customerProductPriceSyncError: pricesState.syncError,
    customerProductPriceLegacyLocalDataWarning: pricesState.legacyLocalDataWarning,

    inventories: toArray(inventoryState.records),
    addInventory: inventoryState.addRecord,
    updateInventory: inventoryState.updateRecord,
    removeInventory: inventoryState.removeRecord,
    reloadInventory: inventoryState.reload,
    inventoryLots: toArray(inventoryState.inventoryLots),
    inventoryMovements: toArray(inventoryState.inventoryMovements),
    inventoryReservations: toArray(inventoryState.inventoryReservations),
    stocktakes: toArray(inventoryState.stocktakes),
    stocktakeLines: toArray(inventoryState.stocktakeLines),
    inventorySyncState: inventoryState.syncState,
    inventorySyncError: inventoryState.syncError,
    inventoryLegacyLocalDataWarning: inventoryState.legacyLocalDataWarning,

    adoptions: toArray(adoptionsState.records),
    addAdoption: adoptionsState.addRecord,
    updateAdoption: adoptionsState.updateRecord,
    removeAdoption: adoptionsState.removeRecord,

    samples: toArray(samplesState.records),
    addSample: samplesState.addRecord,
    updateSample: samplesState.updateRecord,
    removeSample: samplesState.removeRecord,

    quotes: toArray(quotesState.records),
    addQuote: quotesState.addRecord,
    updateQuote: quotesState.updateRecord,
    removeQuote: quotesState.removeRecord,
    quoteSyncState: quotesState.syncState,
    quoteSyncError: quotesState.syncError,
    quoteLegacyLocalDataWarning: quotesState.legacyLocalDataWarning,

    invoices: toArray(invoicesState.records),
    addInvoice: invoicesState.addRecord,
    updateInvoice: invoicesState.updateRecord,
    removeInvoice: invoicesState.removeRecord,

    salesOrders: toArray(salesOrdersState.records),
    addSalesOrder: salesOrdersState.addRecord,
    updateSalesOrder: salesOrdersState.updateRecord,
    removeSalesOrder: salesOrdersState.removeRecord,
    reserveLineFefo: salesOrdersState.reserveLineFefo,
    reserveLineLot: salesOrdersState.reserveLineLot,
    releaseLineReservations: salesOrdersState.releaseLineReservations,
    reallocateLineFefo: salesOrdersState.reallocateLineFefo,

    shipments: toArray(shipmentsState.records),
    createShipmentFromOrder: shipmentsState.createShipmentFromOrder,
    updateShipmentStatus: shipmentsState.updateShipmentStatus,
    shipShipment: shipmentsState.shipShipment,
    cancelShipment: shipmentsState.cancelShipment,
    reloadShipments: shipmentsState.reload,

    deliveryNotes: toArray(deliveryNotesState.records),
    addDeliveryNote: deliveryNotesState.addRecord,
    updateDeliveryNote: deliveryNotesState.updateRecord,
    removeDeliveryNote: deliveryNotesState.removeRecord,
    createDeliveryNoteFromShipment: deliveryNotesState.createDeliveryNoteFromShipment,
    reloadDeliveryNotes: deliveryNotesState.reload,

    issuers: toArray(issuersState.records),
    addIssuer: issuersState.addRecord,
    updateIssuer: issuersState.updateRecord,
    removeIssuer: issuersState.removeRecord,

    projects: toArray(projectsState.records),
    addProject: projectsState.addRecord,
    updateProject: projectsState.updateRecord,
    removeProject: projectsState.removeRecord,

    contacts: toArray(contactsState.records),
    addContact: contactsState.addRecord,
    updateContact: contactsState.updateRecord,
    removeContact: contactsState.removeRecord,

    suppliers: toArray(suppliersState.records),
    addSupplier: suppliersState.addRecord,
    updateSupplier: suppliersState.updateRecord,
    removeSupplier: suppliersState.removeRecord,

    businessCards: toArray(businessCardsState.records),
    addBusinessCard: businessCardsState.addRecord,
    updateBusinessCard: businessCardsState.updateRecord,

    complaints: toArray(complaintsState.records),
    addComplaint: complaintsState.addRecord,
    updateComplaint: complaintsState.updateRecord,
    removeComplaint: complaintsState.removeRecord,

    events: toArray(eventsState.records),
    addEvent: eventsState.addRecord,
    updateEvent: eventsState.updateRecord,
    removeEvent: eventsState.removeRecord,

    tasks: toArray(tasksState.records),
    addTask: tasksState.addRecord,
    updateTask: tasksState.updateRecord,
    removeTask: tasksState.removeRecord,

    attachments: toArray(attachmentsState.records),
    addAttachment: attachmentsState.addRecord,
    updateAttachment: attachmentsState.updateRecord,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}
