import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  getDocFromServer,
  writeBatch,
  Unsubscribe,
  enableNetwork,
} from 'firebase/firestore';
import { db, ensureAuthSession, auth } from './firebase';
import {
  SaleItem,
  PurchaseItem,
  ExpenseItem,
  InventoryItem,
  QuotationItem,
  AgencySettings,
  VoucherItem,
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export type SyncStatus = 'connecting' | 'synced' | 'syncing' | 'offline' | 'error';

export interface CloudDataCallbacks {
  onSalesUpdate?: (sales: SaleItem[]) => void;
  onPurchasesUpdate?: (purchases: PurchaseItem[]) => void;
  onExpensesUpdate?: (expenses: ExpenseItem[]) => void;
  onInventoryUpdate?: (inventory: InventoryItem[]) => void;
  onQuotationsUpdate?: (quotations: QuotationItem[]) => void;
  onVouchersUpdate?: (vouchers: VoucherItem[]) => void;
  onAgencySettingsUpdate?: (settings: AgencySettings) => void;
  onStatusChange?: (status: SyncStatus, error?: string) => void;
}

export const QUOTA_EXHAUSTED_KEY = 'firestore_write_quota_exhausted_date';
export const CLOUD_SEEDED_FLAG = 'agency_cloud_initial_seeded_flag';

// Clean document ID to ensure Firestore compatibility
export function sanitizeId(id: string): string {
  return String(id).replace(/[\/\s#?]/g, '-').trim() || `doc-${Date.now()}`;
}

/**
 * Recursively removes all keys whose values are undefined,
 * because Firestore setDoc/updateDoc/batch.set throws errors on undefined fields.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  try {
    // JSON.stringify drops keys with undefined values automatically
    return JSON.parse(JSON.stringify(obj, (_key, val) => (val === undefined ? null : val)));
  } catch {
    const clean: any = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = typeof value === 'object' && value !== null ? stripUndefined(value) : value;
      }
    }
    return clean;
  }
}

// Ensure network is always active on load
try {
  enableNetwork(db).catch(() => {});
  // Clear any legacy quota block flags that might have frozen sync in past sessions
  localStorage.removeItem(QUOTA_EXHAUSTED_KEY);
  localStorage.removeItem('force_firestore_write_enabled');
} catch {
  // ignore
}

export function isQuotaExhaustedToday(): boolean {
  return false;
}

export function markQuotaExhausted(): void {
  // No-op to avoid breaking cross-device sync
}

export function clearQuotaExhausted(): void {
  try {
    localStorage.removeItem(QUOTA_EXHAUSTED_KEY);
    localStorage.removeItem('force_firestore_write_enabled');
  } catch {
    // ignore
  }
}

export async function resetCloudNetwork(): Promise<boolean> {
  clearQuotaExhausted();
  try {
    await enableNetwork(db);
    return true;
  } catch (err) {
    console.warn('Could not re-enable Firestore network:', err);
    return false;
  }
}

/**
 * Subscribes to real-time updates across all agency collections in Firestore.
 * Automatically synchronizes changes from any connected device instantly.
 */
export function subscribeToAgencyData(
  callbacks: CloudDataCallbacks,
  currentLocalData?: {
    sales: SaleItem[];
    purchases: PurchaseItem[];
    expenses: ExpenseItem[];
    inventory: InventoryItem[];
    quotations: QuotationItem[];
    vouchers?: VoucherItem[];
    agencySettings: AgencySettings;
  }
): () => void {
  let isCancelled = false;
  const unsubs: Unsubscribe[] = [];

  callbacks.onStatusChange?.('connecting');

  ensureAuthSession()
    .then(async (user) => {
      if (isCancelled) return;
      if (!user) {
        callbacks.onStatusChange?.('offline', 'يرجى تسجيل الدخول لتفعيل المزامنة السحابية');
        return;
      }

      try {
        // Check if cloud has initial settings or if this is first initialization
        try {
          const settingsSnap = await getDoc(doc(db, 'agency_settings', 'main_profile'));
          if (!settingsSnap.exists() && currentLocalData) {
            // Seed cloud with initial records in background so second devices have base data
            await uploadAllDataToCloud(
              currentLocalData.sales,
              currentLocalData.purchases,
              currentLocalData.expenses,
              currentLocalData.inventory,
              currentLocalData.quotations,
              currentLocalData.agencySettings,
              currentLocalData.vouchers || []
            );
          }
        } catch (seedErr) {
          console.warn('Initial cloud seed note:', seedErr);
        }

        if (isCancelled) return;

        // 1. Setup Real-time Listener for Sales
        const salesUnsub = onSnapshot(
          collection(db, 'sales'),
          (snap) => {
            const list: SaleItem[] = [];
            snap.forEach((d) => list.push(d.data() as SaleItem));
            if (callbacks.onSalesUpdate) callbacks.onSalesUpdate(list);
            callbacks.onStatusChange?.('synced');
          },
          (err) => {
            callbacks.onStatusChange?.('error', err.message);
            handleFirestoreError(err, OperationType.GET, 'sales');
          }
        );
        unsubs.push(salesUnsub);

        // 2. Setup Real-time Listener for Purchases
        const purchasesUnsub = onSnapshot(
          collection(db, 'purchases'),
          (snap) => {
            const list: PurchaseItem[] = [];
            snap.forEach((d) => list.push(d.data() as PurchaseItem));
            if (callbacks.onPurchasesUpdate) callbacks.onPurchasesUpdate(list);
            callbacks.onStatusChange?.('synced');
          },
          (err) => {
            callbacks.onStatusChange?.('error', err.message);
            handleFirestoreError(err, OperationType.GET, 'purchases');
          }
        );
        unsubs.push(purchasesUnsub);

        // 3. Setup Real-time Listener for Expenses
        const expensesUnsub = onSnapshot(
          collection(db, 'expenses'),
          (snap) => {
            const list: ExpenseItem[] = [];
            snap.forEach((d) => list.push(d.data() as ExpenseItem));
            if (callbacks.onExpensesUpdate) callbacks.onExpensesUpdate(list);
            callbacks.onStatusChange?.('synced');
          },
          (err) => {
            callbacks.onStatusChange?.('error', err.message);
            handleFirestoreError(err, OperationType.GET, 'expenses');
          }
        );
        unsubs.push(expensesUnsub);

        // 4. Setup Real-time Listener for Inventory
        const inventoryUnsub = onSnapshot(
          collection(db, 'inventory'),
          (snap) => {
            const list: InventoryItem[] = [];
            snap.forEach((d) => list.push(d.data() as InventoryItem));
            if (callbacks.onInventoryUpdate) callbacks.onInventoryUpdate(list);
            callbacks.onStatusChange?.('synced');
          },
          (err) => {
            callbacks.onStatusChange?.('error', err.message);
            handleFirestoreError(err, OperationType.GET, 'inventory');
          }
        );
        unsubs.push(inventoryUnsub);

        // 5. Setup Real-time Listener for Quotations
        const quotesUnsub = onSnapshot(
          collection(db, 'quotations'),
          (snap) => {
            const list: QuotationItem[] = [];
            snap.forEach((d) => list.push(d.data() as QuotationItem));
            if (callbacks.onQuotationsUpdate) callbacks.onQuotationsUpdate(list);
            callbacks.onStatusChange?.('synced');
          },
          (err) => {
            callbacks.onStatusChange?.('error', err.message);
            handleFirestoreError(err, OperationType.GET, 'quotations');
          }
        );
        unsubs.push(quotesUnsub);

        // 6. Setup Real-time Listener for Vouchers (قبض وصرف)
        const vouchersUnsub = onSnapshot(
          collection(db, 'vouchers'),
          (snap) => {
            const list: VoucherItem[] = [];
            snap.forEach((d) => list.push(d.data() as VoucherItem));
            if (callbacks.onVouchersUpdate) callbacks.onVouchersUpdate(list);
            callbacks.onStatusChange?.('synced');
          },
          (err) => {
            callbacks.onStatusChange?.('error', err.message);
            handleFirestoreError(err, OperationType.GET, 'vouchers');
          }
        );
        unsubs.push(vouchersUnsub);

        // 6. Setup Real-time Listener for Agency Settings
        const settingsUnsub = onSnapshot(
          doc(db, 'agency_settings', 'main_profile'),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as AgencySettings;
              if (callbacks.onAgencySettingsUpdate) callbacks.onAgencySettingsUpdate(data);
            }
            callbacks.onStatusChange?.('synced');
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, 'agency_settings/main_profile');
          }
        );
        unsubs.push(settingsUnsub);

        callbacks.onStatusChange?.('synced');
      } catch (err: any) {
        console.error('Firestore starting sync error:', err);
        callbacks.onStatusChange?.('error', err?.message || 'تعذر بدء المزامنة السحابية');
      }
    })
    .catch((err) => {
      console.error('Firestore sync auth error:', err);
      callbacks.onStatusChange?.('offline', err?.message);
    });

  return () => {
    isCancelled = true;
    unsubs.forEach((u) => u());
  };
}

// Write/Delete Operations with Automatic Cloud Propagation

export async function cloudSaveSale(item: SaleItem): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    const id = sanitizeId(item.id);
    await setDoc(doc(db, 'sales', id), stripUndefined(item), { merge: true });
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `sales/${sanitizeId(item.id)}`);
    return { success: false, error: err?.message || 'فشل حفظ الفاتورة سحابياً' };
  }
}

export async function cloudDeleteSale(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    await deleteDoc(doc(db, 'sales', sanitizeId(id)));
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `sales/${sanitizeId(id)}`);
    return { success: false, error: err?.message || 'فشل حذف الفاتورة سحابياً' };
  }
}

export async function cloudSavePurchase(item: PurchaseItem): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    const id = sanitizeId(item.id);
    await setDoc(doc(db, 'purchases', id), stripUndefined(item), { merge: true });
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `purchases/${sanitizeId(item.id)}`);
    return { success: false, error: err?.message || 'فشل حفظ فاتورة الشراء سحابياً' };
  }
}

export async function cloudDeletePurchase(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    await deleteDoc(doc(db, 'purchases', sanitizeId(id)));
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `purchases/${sanitizeId(id)}`);
    return { success: false, error: err?.message || 'فشل حذف فاتورة الشراء سحابياً' };
  }
}

export async function cloudSaveExpense(item: ExpenseItem): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    const id = sanitizeId(item.id);
    await setDoc(doc(db, 'expenses', id), stripUndefined(item), { merge: true });
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `expenses/${sanitizeId(item.id)}`);
    return { success: false, error: err?.message || 'فشل حفظ المصروف سحابياً' };
  }
}

export async function cloudDeleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    await deleteDoc(doc(db, 'expenses', sanitizeId(id)));
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `expenses/${sanitizeId(id)}`);
    return { success: false, error: err?.message || 'فشل حذف المصروف سحابياً' };
  }
}

export async function cloudSaveInventory(item: InventoryItem): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    const id = sanitizeId(item.id);
    await setDoc(doc(db, 'inventory', id), stripUndefined(item), { merge: true });
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `inventory/${sanitizeId(item.id)}`);
    return { success: false, error: err?.message || 'فشل حفظ الصنف بالمخزون سحابياً' };
  }
}

export async function cloudDeleteInventory(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    await deleteDoc(doc(db, 'inventory', sanitizeId(id)));
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `inventory/${sanitizeId(id)}`);
    return { success: false, error: err?.message || 'فشل حذف الصنف بالمخزون سحابياً' };
  }
}

export async function cloudSaveQuotation(item: QuotationItem): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    const id = sanitizeId(item.id);
    await setDoc(doc(db, 'quotations', id), stripUndefined(item), { merge: true });
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `quotations/${sanitizeId(item.id)}`);
    return { success: false, error: err?.message || 'فشل حفظ عرض السعر سحابياً' };
  }
}

export async function cloudDeleteQuotation(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    await deleteDoc(doc(db, 'quotations', sanitizeId(id)));
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `quotations/${sanitizeId(id)}`);
    return { success: false, error: err?.message || 'فشل حذف عرض السعر سحابياً' };
  }
}

export async function cloudSaveVoucher(item: VoucherItem): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    const id = sanitizeId(item.id);
    await setDoc(doc(db, 'vouchers', id), stripUndefined(item), { merge: true });
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `vouchers/${sanitizeId(item.id)}`);
    return { success: false, error: err?.message || 'فشل حفظ السند سحابياً' };
  }
}

export async function cloudDeleteVoucher(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    await deleteDoc(doc(db, 'vouchers', sanitizeId(id)));
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `vouchers/${sanitizeId(id)}`);
    return { success: false, error: err?.message || 'فشل حذف السند سحابياً' };
  }
}

export async function cloudSaveAgencySettings(settings: AgencySettings): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    await setDoc(doc(db, 'agency_settings', 'main_profile'), stripUndefined(settings), { merge: true });
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, 'agency_settings/main_profile');
    return { success: false, error: err?.message || 'فشل حفظ إعدادات الوكالة سحابياً' };
  }
}

/**
 * Subscribes to agency branding and profile settings in real-time.
 * Accessible publicly so the Login Gate (AuthGate), page title, and favicon
 * reflect the customized agency brand immediately on page load before login.
 */
export function subscribeToPublicAgencySettings(
  onSettingsUpdate: (settings: AgencySettings) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'agency_settings', 'main_profile'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AgencySettings;
        if (data && (data.agencyName || data.agencyLogoUrl)) {
          onSettingsUpdate(data);
        }
      }
    },
    (err) => {
      console.warn('Public agency branding sync note:', err);
    }
  );
}

/**
 * Upload all local records to Firestore in batches (for migration/initial sync).
 */
export async function uploadAllDataToCloud(
  sales: SaleItem[],
  purchases: PurchaseItem[],
  expenses: ExpenseItem[],
  inventory: InventoryItem[],
  quotations: QuotationItem[],
  agencySettings: AgencySettings,
  vouchers: VoucherItem[] = []
): Promise<void> {
  const user = await ensureAuthSession();
  if (!user) {
    throw new Error('يلزم تسجيل الدخول بواسطة Google لتفعيل المزامنة السحابية');
  }

  try {
    // 1. Settings
    await setDoc(doc(db, 'agency_settings', 'main_profile'), stripUndefined(agencySettings), { merge: true });

    // 2. Sales in batch
    if (sales.length > 0) {
      const batch = writeBatch(db);
      sales.forEach((s) => {
        batch.set(doc(db, 'sales', sanitizeId(s.id)), stripUndefined(s), { merge: true });
      });
      await batch.commit();
    }

    // 3. Purchases in batch
    if (purchases.length > 0) {
      const batch = writeBatch(db);
      purchases.forEach((p) => {
        batch.set(doc(db, 'purchases', sanitizeId(p.id)), stripUndefined(p), { merge: true });
      });
      await batch.commit();
    }

    // 4. Expenses in batch
    if (expenses.length > 0) {
      const batch = writeBatch(db);
      expenses.forEach((e) => {
        batch.set(doc(db, 'expenses', sanitizeId(e.id)), stripUndefined(e), { merge: true });
      });
      await batch.commit();
    }

    // 5. Inventory in batch
    if (inventory.length > 0) {
      const batch = writeBatch(db);
      inventory.forEach((i) => {
        batch.set(doc(db, 'inventory', sanitizeId(i.id)), stripUndefined(i), { merge: true });
      });
      await batch.commit();
    }

    // 6. Quotations in batch
    if (quotations.length > 0) {
      const batch = writeBatch(db);
      quotations.forEach((q) => {
        batch.set(doc(db, 'quotations', sanitizeId(q.id)), stripUndefined(q), { merge: true });
      });
      await batch.commit();
    }

    // 7. Vouchers in batch (سندات قبض وصرف)
    if (vouchers.length > 0) {
      const batch = writeBatch(db);
      vouchers.forEach((v) => {
        batch.set(doc(db, 'vouchers', sanitizeId(v.id)), stripUndefined(v), { merge: true });
      });
      await batch.commit();
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, 'batch_upload');
    throw err;
  }
}

/**
 * Fetches all collections directly from Firestore cloud server.
 */
export async function fetchAllCloudData(): Promise<{
  sales: SaleItem[];
  purchases: PurchaseItem[];
  expenses: ExpenseItem[];
  inventory: InventoryItem[];
  quotations: QuotationItem[];
  vouchers: VoucherItem[];
  agencySettings: AgencySettings | null;
}> {
  const user = await ensureAuthSession();
  if (!user) {
    throw new Error('يرجى تسجيل الدخول بحساب Google أولاً لسحب البيانات السحابية');
  }

  try {
    const [salesSnap, purchasesSnap, expensesSnap, inventorySnap, quotesSnap, vouchersSnap, settingsSnap] =
      await Promise.all([
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'inventory')),
        getDocs(collection(db, 'quotations')),
        getDocs(collection(db, 'vouchers')),
        getDoc(doc(db, 'agency_settings', 'main_profile')),
      ]);

    const sales: SaleItem[] = [];
    salesSnap.forEach((d) => sales.push(d.data() as SaleItem));

    const purchases: PurchaseItem[] = [];
    purchasesSnap.forEach((d) => purchases.push(d.data() as PurchaseItem));

    const expenses: ExpenseItem[] = [];
    expensesSnap.forEach((d) => expenses.push(d.data() as ExpenseItem));

    const inventory: InventoryItem[] = [];
    inventorySnap.forEach((d) => inventory.push(d.data() as InventoryItem));

    const quotations: QuotationItem[] = [];
    quotesSnap.forEach((d) => quotations.push(d.data() as QuotationItem));

    const vouchers: VoucherItem[] = [];
    vouchersSnap.forEach((d) => vouchers.push(d.data() as VoucherItem));

    const agencySettings = settingsSnap.exists()
      ? (settingsSnap.data() as AgencySettings)
      : null;

    return { sales, purchases, expenses, inventory, quotations, vouchers, agencySettings };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.GET, 'all_collections');
    throw err;
  }
}

/**
 * Tests live connection to Firestore and returns latency and auth info.
 */
export async function testCloudConnection(): Promise<{
  ok: boolean;
  latencyMs: number;
  userEmail?: string;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    const user = await ensureAuthSession();
    if (!user) {
      return { ok: false, latencyMs: 0, error: 'غير مسجل الدخول بحساب Google' };
    }
    const testDocRef = doc(db, 'test', 'ping');
    await setDoc(testDocRef, {
      ping: true,
      timestamp: Date.now(),
      testedBy: user.email,
    });
    const snap = await getDocFromServer(testDocRef);
    const latencyMs = Date.now() - startTime;
    return {
      ok: snap.exists(),
      latencyMs,
      userEmail: user.email || undefined,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      ok: false,
      latencyMs,
      error: err?.message || 'فشل الاتصال بـ Firestore',
    };
  }
}

/**
 * Merges local items with cloud items so changes made on this device or another device are combined without losing records.
 */
export async function syncMergeLocalAndCloud(
  localData: {
    sales: SaleItem[];
    purchases: PurchaseItem[];
    expenses: ExpenseItem[];
    inventory: InventoryItem[];
    quotations: QuotationItem[];
    vouchers?: VoucherItem[];
    agencySettings: AgencySettings;
  }
): Promise<{
  sales: SaleItem[];
  purchases: PurchaseItem[];
  expenses: ExpenseItem[];
  inventory: InventoryItem[];
  quotations: QuotationItem[];
  vouchers: VoucherItem[];
  agencySettings: AgencySettings;
  mergedCount: number;
}> {
  const cloudData = await fetchAllCloudData();
  let mergedCount = 0;

  // Merge Sales:
  const salesMap = new Map<string, SaleItem>();
  cloudData.sales.forEach((s) => salesMap.set(s.id, s));
  for (const localSale of localData.sales) {
    if (!salesMap.has(localSale.id)) {
      salesMap.set(localSale.id, localSale);
      await cloudSaveSale(localSale);
      mergedCount++;
    }
  }

  // Merge Quotations:
  const quotesMap = new Map<string, QuotationItem>();
  cloudData.quotations.forEach((q) => quotesMap.set(q.id, q));
  for (const localQuote of localData.quotations) {
    if (!quotesMap.has(localQuote.id)) {
      quotesMap.set(localQuote.id, localQuote);
      await cloudSaveQuotation(localQuote);
      mergedCount++;
    }
  }

  // Merge Purchases:
  const purchasesMap = new Map<string, PurchaseItem>();
  cloudData.purchases.forEach((p) => purchasesMap.set(p.id, p));
  for (const localP of localData.purchases) {
    if (!purchasesMap.has(localP.id)) {
      purchasesMap.set(localP.id, localP);
      await cloudSavePurchase(localP);
      mergedCount++;
    }
  }

  // Merge Expenses:
  const expensesMap = new Map<string, ExpenseItem>();
  cloudData.expenses.forEach((e) => expensesMap.set(e.id, e));
  for (const localE of localData.expenses) {
    if (!expensesMap.has(localE.id)) {
      expensesMap.set(localE.id, localE);
      await cloudSaveExpense(localE);
      mergedCount++;
    }
  }

  // Merge Inventory:
  const invMap = new Map<string, InventoryItem>();
  cloudData.inventory.forEach((i) => invMap.set(i.id, i));
  for (const localI of localData.inventory) {
    if (!invMap.has(localI.id)) {
      invMap.set(localI.id, localI);
      await cloudSaveInventory(localI);
      mergedCount++;
    }
  }

  // Merge Vouchers (سندات القبض والصرف):
  const vouchersMap = new Map<string, VoucherItem>();
  (cloudData.vouchers || []).forEach((v) => vouchersMap.set(v.id, v));
  for (const localV of (localData.vouchers || [])) {
    if (!vouchersMap.has(localV.id)) {
      vouchersMap.set(localV.id, localV);
      await cloudSaveVoucher(localV);
      mergedCount++;
    }
  }

  const finalSettings = cloudData.agencySettings || localData.agencySettings;
  if (!cloudData.agencySettings) {
    await cloudSaveAgencySettings(finalSettings);
  }

  return {
    sales: Array.from(salesMap.values()),
    quotations: Array.from(quotesMap.values()),
    purchases: Array.from(purchasesMap.values()),
    expenses: Array.from(expensesMap.values()),
    inventory: Array.from(invMap.values()),
    vouchers: Array.from(vouchersMap.values()),
    agencySettings: finalSettings,
    mergedCount,
  };
}
