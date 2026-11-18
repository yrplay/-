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
  ReturnRecord,
  InventoryMovement,
  EmployeeItem,
  AttendanceRecord,
  PayrollRun,
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
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
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
  onReturnsUpdate?: (returns: ReturnRecord[]) => void;
  onMovementsUpdate?: (movements: InventoryMovement[]) => void;
  onEmployeesUpdate?: (employees: EmployeeItem[]) => void;
  onAttendanceUpdate?: (attendance: AttendanceRecord[]) => void;
  onPayrollsUpdate?: (payrolls: PayrollRun[]) => void;
  onAgencySettingsUpdate?: (settings: AgencySettings) => void;
  onStatusChange?: (status: SyncStatus, error?: string) => void;
}

export const QUOTA_EXHAUSTED_KEY = 'firestore_write_quota_exhausted_date';
export const CLOUD_SEEDED_FLAG = 'agency_cloud_initial_seeded_flag';

export function sanitizeId(id: string): string {
  return String(id).replace(/[\/\s#?]/g, '-').trim() || `doc-${Date.now()}`;
}

export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  try {
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

try {
  enableNetwork(db).catch(() => {});
  localStorage.removeItem(QUOTA_EXHAUSTED_KEY);
  localStorage.removeItem('force_firestore_write_enabled');
} catch {
  // ignore
}

export function isQuotaExhaustedToday(): boolean {
  return false;
}

export function markQuotaExhausted(): void {}

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
 * Helper to extract timestamp from record for conflict resolution (Newer timestamp wins)
 */
function getRecordTimestamp(item: any): number {
  const ts = item?.audit?.updatedAt || item?.audit?.createdAt || item?.approvedAt;
  if (ts) {
    const parsed = new Date(ts).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

export function subscribeToAgencyData(
  callbacks: CloudDataCallbacks,
  currentLocalData?: {
    sales: SaleItem[];
    purchases: PurchaseItem[];
    expenses: ExpenseItem[];
    inventory: InventoryItem[];
    quotations: QuotationItem[];
    vouchers?: VoucherItem[];
    returns?: ReturnRecord[];
    movements?: InventoryMovement[];
    employees?: EmployeeItem[];
    attendance?: AttendanceRecord[];
    payrolls?: PayrollRun[];
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
        try {
          const settingsSnap = await getDoc(doc(db, 'agency_settings', 'main_profile'));
          if (!settingsSnap.exists() && currentLocalData) {
            await uploadAllDataToCloud(
              currentLocalData.sales,
              currentLocalData.purchases,
              currentLocalData.expenses,
              currentLocalData.inventory,
              currentLocalData.quotations,
              currentLocalData.agencySettings,
              currentLocalData.vouchers || [],
              currentLocalData.returns || [],
              currentLocalData.movements || [],
              currentLocalData.employees || [],
              currentLocalData.attendance || [],
              currentLocalData.payrolls || []
            );
          }
        } catch (seedErr) {
          console.warn('Initial cloud seed note:', seedErr);
        }

        if (isCancelled) return;

        unsubs.push(
          onSnapshot(
            collection(db, 'sales'),
            (snap) => {
              const list: SaleItem[] = [];
              snap.forEach((d) => list.push(d.data() as SaleItem));
              callbacks.onSalesUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              callbacks.onStatusChange?.('error', err.message);
              handleFirestoreError(err, OperationType.GET, 'sales');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'purchases'),
            (snap) => {
              const list: PurchaseItem[] = [];
              snap.forEach((d) => list.push(d.data() as PurchaseItem));
              callbacks.onPurchasesUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              callbacks.onStatusChange?.('error', err.message);
              handleFirestoreError(err, OperationType.GET, 'purchases');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'expenses'),
            (snap) => {
              const list: ExpenseItem[] = [];
              snap.forEach((d) => list.push(d.data() as ExpenseItem));
              callbacks.onExpensesUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              callbacks.onStatusChange?.('error', err.message);
              handleFirestoreError(err, OperationType.GET, 'expenses');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'inventory'),
            (snap) => {
              const list: InventoryItem[] = [];
              snap.forEach((d) => list.push(d.data() as InventoryItem));
              callbacks.onInventoryUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              callbacks.onStatusChange?.('error', err.message);
              handleFirestoreError(err, OperationType.GET, 'inventory');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'quotations'),
            (snap) => {
              const list: QuotationItem[] = [];
              snap.forEach((d) => list.push(d.data() as QuotationItem));
              callbacks.onQuotationsUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              callbacks.onStatusChange?.('error', err.message);
              handleFirestoreError(err, OperationType.GET, 'quotations');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'vouchers'),
            (snap) => {
              const list: VoucherItem[] = [];
              snap.forEach((d) => list.push(d.data() as VoucherItem));
              callbacks.onVouchersUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              callbacks.onStatusChange?.('error', err.message);
              handleFirestoreError(err, OperationType.GET, 'vouchers');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'returns'),
            (snap) => {
              const list: ReturnRecord[] = [];
              snap.forEach((d) => list.push(d.data() as ReturnRecord));
              callbacks.onReturnsUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, 'returns');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'inventory_movements'),
            (snap) => {
              const list: InventoryMovement[] = [];
              snap.forEach((d) => list.push(d.data() as InventoryMovement));
              callbacks.onMovementsUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, 'inventory_movements');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'employees'),
            (snap) => {
              const list: EmployeeItem[] = [];
              snap.forEach((d) => list.push(d.data() as EmployeeItem));
              callbacks.onEmployeesUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, 'employees');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'attendance'),
            (snap) => {
              const list: AttendanceRecord[] = [];
              snap.forEach((d) => list.push(d.data() as AttendanceRecord));
              callbacks.onAttendanceUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, 'attendance');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            collection(db, 'payrolls'),
            (snap) => {
              const list: PayrollRun[] = [];
              snap.forEach((d) => list.push(d.data() as PayrollRun));
              callbacks.onPayrollsUpdate?.(list);
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, 'payrolls');
            }
          )
        );

        unsubs.push(
          onSnapshot(
            doc(db, 'agency_settings', 'main_profile'),
            (snap) => {
              if (snap.exists()) {
                const data = snap.data() as AgencySettings;
                callbacks.onAgencySettingsUpdate?.(data);
              }
              callbacks.onStatusChange?.('synced');
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, 'agency_settings/main_profile');
            }
          )
        );

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

async function saveDocToCollection<T extends { id: string }>(
  colName: string,
  item: T
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    const id = sanitizeId(item.id);
    await setDoc(doc(db, colName, id), stripUndefined(item), { merge: true });
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `${colName}/${sanitizeId(item.id)}`);
    return { success: false, error: err?.message || 'فشل الحفظ سحابياً' };
  }
}

async function deleteDocFromCollection(
  colName: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };
    await deleteDoc(doc(db, colName, sanitizeId(id)));
    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `${colName}/${sanitizeId(id)}`);
    return { success: false, error: err?.message || 'فشل الحذف سحابياً' };
  }
}

export const cloudSaveSale = (item: SaleItem) => saveDocToCollection('sales', item);
export const cloudDeleteSale = (id: string) => deleteDocFromCollection('sales', id);

export const cloudSavePurchase = (item: PurchaseItem) => saveDocToCollection('purchases', item);
export const cloudDeletePurchase = (id: string) => deleteDocFromCollection('purchases', id);

export const cloudSaveExpense = (item: ExpenseItem) => saveDocToCollection('expenses', item);
export const cloudDeleteExpense = (id: string) => deleteDocFromCollection('expenses', id);

export const cloudSaveInventory = (item: InventoryItem) => saveDocToCollection('inventory', item);
export const cloudDeleteInventory = (id: string) => deleteDocFromCollection('inventory', id);

export const cloudSaveQuotation = (item: QuotationItem) => saveDocToCollection('quotations', item);
export const cloudDeleteQuotation = (id: string) => deleteDocFromCollection('quotations', id);

export const cloudSaveVoucher = (item: VoucherItem) => saveDocToCollection('vouchers', item);
export const cloudDeleteVoucher = (id: string) => deleteDocFromCollection('vouchers', id);

export const cloudSaveReturn = (item: ReturnRecord) => saveDocToCollection('returns', item);
export const cloudDeleteReturn = (id: string) => deleteDocFromCollection('returns', id);

export const cloudSaveMovement = (item: InventoryMovement) => saveDocToCollection('inventory_movements', item);
export const cloudDeleteMovement = (id: string) => deleteDocFromCollection('inventory_movements', id);

export const cloudSaveEmployee = (item: EmployeeItem) => saveDocToCollection('employees', item);
export const cloudDeleteEmployee = (id: string) => deleteDocFromCollection('employees', id);

export const cloudSaveAttendance = (item: AttendanceRecord) => saveDocToCollection('attendance', item);
export const cloudDeleteAttendance = (id: string) => deleteDocFromCollection('attendance', id);

export const cloudSavePayroll = (item: PayrollRun) => saveDocToCollection('payrolls', item);
export const cloudDeletePayroll = (id: string) => deleteDocFromCollection('payrolls', id);

export async function cloudSaveAgencySettings(settings: AgencySettings): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureAuthSession();
    if (!user) return { success: false, error: 'غير مسجل الدخول' };

    // إضافة قائمة الإيميلات المصرح لها لدعم قواعد الأمان في Firestore
    const authorizedEmails = Array.from(
      new Set(
        [
          settings.ownerEmail,
          settings.userProfile?.email,
          ...(settings.collaborators || []).map((c) => c.email),
        ]
          .filter(Boolean)
          .map((e) => String(e).toLowerCase().trim())
      )
    );
    const adminEmails = Array.from(
      new Set(
        [
          settings.ownerEmail,
          ...(settings.collaborators || [])
            .filter((c) => c.role.includes('مالك') || c.role.includes('Owner') || c.role.includes('مدير') || c.role.includes('Admin'))
            .map((c) => c.email),
        ]
          .filter(Boolean)
          .map((e) => String(e).toLowerCase().trim())
      )
    );

    const payload = {
      ...settings,
      authorizedEmails,
      adminEmails,
    };

    await setDoc(doc(db, 'agency_settings', 'main_profile'), stripUndefined(payload), { merge: true });

    // حفظ هوية العرض العامة المختصرة لبوابة الدخول فقط (بدون الرقم الضريبي ولا بيانات الموظفين)
    await setDoc(
      doc(db, 'public_branding', 'main'),
      stripUndefined({
        agencyName: settings.agencyName,
        agencySubtitle: settings.agencySubtitle,
        agencyLogoUrl: settings.agencyLogoUrl,
      }),
      { merge: true }
    ).catch(() => {});

    return { success: true };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, 'agency_settings/main_profile');
    return { success: false, error: err?.message || 'فشل حفظ إعدادات الوكالة سحابياً' };
  }
}

export function subscribeToPublicAgencySettings(
  onSettingsUpdate: (settings: Partial<AgencySettings>) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'public_branding', 'main'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<AgencySettings>;
        if (data && (data.agencyName || data.agencyLogoUrl)) {
          onSettingsUpdate(data);
        }
      }
    },
    () => {
      // ignore if unauthenticated or not yet created
    }
  );
}

export async function uploadAllDataToCloud(
  sales: SaleItem[],
  purchases: PurchaseItem[],
  expenses: ExpenseItem[],
  inventory: InventoryItem[],
  quotations: QuotationItem[],
  agencySettings: AgencySettings,
  vouchers: VoucherItem[] = [],
  returns: ReturnRecord[] = [],
  movements: InventoryMovement[] = [],
  employees: EmployeeItem[] = [],
  attendance: AttendanceRecord[] = [],
  payrolls: PayrollRun[] = []
): Promise<void> {
  const user = await ensureAuthSession();
  if (!user) {
    throw new Error('يلزم تسجيل الدخول بواسطة Google لتفعيل المزامنة السحابية');
  }

  try {
    await cloudSaveAgencySettings(agencySettings);

    const commitCollectionBatch = async <T extends { id: string }>(colName: string, items: T[]) => {
      if (items.length === 0) return;
      const batch = writeBatch(db);
      items.forEach((item) => {
        batch.set(doc(db, colName, sanitizeId(item.id)), stripUndefined(item), { merge: true });
      });
      await batch.commit();
    };

    await commitCollectionBatch('sales', sales);
    await commitCollectionBatch('purchases', purchases);
    await commitCollectionBatch('expenses', expenses);
    await commitCollectionBatch('inventory', inventory);
    await commitCollectionBatch('quotations', quotations);
    await commitCollectionBatch('vouchers', vouchers);
    await commitCollectionBatch('returns', returns);
    await commitCollectionBatch('inventory_movements', movements);
    await commitCollectionBatch('employees', employees);
    await commitCollectionBatch('attendance', attendance);
    await commitCollectionBatch('payrolls', payrolls);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, 'batch_upload');
    throw err;
  }
}

export async function fetchAllCloudData(): Promise<{
  sales: SaleItem[];
  purchases: PurchaseItem[];
  expenses: ExpenseItem[];
  inventory: InventoryItem[];
  quotations: QuotationItem[];
  vouchers: VoucherItem[];
  returns: ReturnRecord[];
  movements: InventoryMovement[];
  employees: EmployeeItem[];
  attendance: AttendanceRecord[];
  payrolls: PayrollRun[];
  agencySettings: AgencySettings | null;
}> {
  const user = await ensureAuthSession();
  if (!user) {
    throw new Error('يرجى تسجيل الدخول بحساب Google أولاً لسحب البيانات السحابية');
  }

  try {
    const [
      salesSnap,
      purchasesSnap,
      expensesSnap,
      inventorySnap,
      quotesSnap,
      vouchersSnap,
      returnsSnap,
      movementsSnap,
      employeesSnap,
      attendanceSnap,
      payrollsSnap,
      settingsSnap,
    ] = await Promise.all([
      getDocs(collection(db, 'sales')),
      getDocs(collection(db, 'purchases')),
      getDocs(collection(db, 'expenses')),
      getDocs(collection(db, 'inventory')),
      getDocs(collection(db, 'quotations')),
      getDocs(collection(db, 'vouchers')),
      getDocs(collection(db, 'returns')),
      getDocs(collection(db, 'inventory_movements')),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'attendance')),
      getDocs(collection(db, 'payrolls')),
      getDoc(doc(db, 'agency_settings', 'main_profile')),
    ]);

    const extract = <T>(snap: any): T[] => {
      const arr: T[] = [];
      snap.forEach((d: any) => arr.push(d.data() as T));
      return arr;
    };

    const agencySettings = settingsSnap.exists() ? (settingsSnap.data() as AgencySettings) : null;

    return {
      sales: extract<SaleItem>(salesSnap),
      purchases: extract<PurchaseItem>(purchasesSnap),
      expenses: extract<ExpenseItem>(expensesSnap),
      inventory: extract<InventoryItem>(inventorySnap),
      quotations: extract<QuotationItem>(quotesSnap),
      vouchers: extract<VoucherItem>(vouchersSnap),
      returns: extract<ReturnRecord>(returnsSnap),
      movements: extract<InventoryMovement>(movementsSnap),
      employees: extract<EmployeeItem>(employeesSnap),
      attendance: extract<AttendanceRecord>(attendanceSnap),
      payrolls: extract<PayrollRun>(payrollsSnap),
      agencySettings,
    };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.GET, 'all_collections');
    throw err;
  }
}

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
 * دمج ذكي يعتمد على الطابع الزمني الأحدث (Timestamp-Aware Conflict Resolution)
 * لمنع فقدان التعديلات الحديثة عند العمل أوفلاين من جهازين
 */
export async function syncMergeLocalAndCloud(localData: {
  sales: SaleItem[];
  purchases: PurchaseItem[];
  expenses: ExpenseItem[];
  inventory: InventoryItem[];
  quotations: QuotationItem[];
  vouchers?: VoucherItem[];
  returns?: ReturnRecord[];
  movements?: InventoryMovement[];
  employees?: EmployeeItem[];
  attendance?: AttendanceRecord[];
  payrolls?: PayrollRun[];
  agencySettings: AgencySettings;
}): Promise<{
  sales: SaleItem[];
  purchases: PurchaseItem[];
  expenses: ExpenseItem[];
  inventory: InventoryItem[];
  quotations: QuotationItem[];
  vouchers: VoucherItem[];
  returns: ReturnRecord[];
  movements: InventoryMovement[];
  employees: EmployeeItem[];
  attendance: AttendanceRecord[];
  payrolls: PayrollRun[];
  agencySettings: AgencySettings;
  mergedCount: number;
}> {
  const cloudData = await fetchAllCloudData();
  let mergedCount = 0;

  const mergeCollection = async <T extends { id: string }>(
    cloudList: T[],
    localList: T[],
    saveFn: (item: T) => Promise<any>
  ): Promise<T[]> => {
    const map = new Map<string, T>();
    cloudList.forEach((c) => map.set(c.id, c));
    for (const localItem of localList) {
      const existingCloud = map.get(localItem.id);
      if (!existingCloud) {
        map.set(localItem.id, localItem);
        await saveFn(localItem);
        mergedCount++;
      } else {
        // حل التعارض: إذا كانت النسخة المحلية أحدث زمنياً من السحابية، نعتمد المحلية ونرفعها
        const localTs = getRecordTimestamp(localItem);
        const cloudTs = getRecordTimestamp(existingCloud);
        if (localTs > cloudTs) {
          map.set(localItem.id, localItem);
          await saveFn(localItem);
          mergedCount++;
        }
      }
    }
    return Array.from(map.values());
  };

  const sales = await mergeCollection(cloudData.sales, localData.sales, cloudSaveSale);
  const quotations = await mergeCollection(cloudData.quotations, localData.quotations, cloudSaveQuotation);
  const purchases = await mergeCollection(cloudData.purchases, localData.purchases, cloudSavePurchase);
  const expenses = await mergeCollection(cloudData.expenses, localData.expenses, cloudSaveExpense);
  const inventory = await mergeCollection(cloudData.inventory, localData.inventory, cloudSaveInventory);
  const vouchers = await mergeCollection(cloudData.vouchers || [], localData.vouchers || [], cloudSaveVoucher);
  const returns = await mergeCollection(cloudData.returns || [], localData.returns || [], cloudSaveReturn);
  const movements = await mergeCollection(cloudData.movements || [], localData.movements || [], cloudSaveMovement);
  const employees = await mergeCollection(cloudData.employees || [], localData.employees || [], cloudSaveEmployee);
  const attendance = await mergeCollection(cloudData.attendance || [], localData.attendance || [], cloudSaveAttendance);
  const payrolls = await mergeCollection(cloudData.payrolls || [], localData.payrolls || [], cloudSavePayroll);

  const finalSettings = cloudData.agencySettings || localData.agencySettings;
  if (!cloudData.agencySettings) {
    await cloudSaveAgencySettings(finalSettings);
  }

  return {
    sales,
    quotations,
    purchases,
    expenses,
    inventory,
    vouchers,
    returns,
    movements,
    employees,
    attendance,
    payrolls,
    agencySettings: finalSettings,
    mergedCount,
  };
}
