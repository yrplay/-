import {
  SaleItem,
  SaleLineItem,
  PurchaseItem,
  PurchaseLineItem,
  ExpenseItem,
  InventoryItem,
  DashboardMetrics,
  AgencySettings,
  QuotationItem,
  QuotationLineItem,
  VoucherItem,
  PriceListItem,
  ReturnRecord,
  InventoryMovement,
  EmployeeItem,
  AttendanceRecord,
  PayrollRun,
  PaymentStatusCode,
} from '../types';

export const LOCAL_STORAGE_KEY_QUOTATIONS = 'agency_quotations_data';
export const LOCAL_STORAGE_KEY_VOUCHERS = 'adv_accounting_vouchers';
export const LOCAL_STORAGE_KEY_PRICE_LIST = 'adv_accounting_price_list';
export const LOCAL_STORAGE_KEY_RETURNS = 'adv_accounting_returns_v2';
export const LOCAL_STORAGE_KEY_MOVEMENTS = 'adv_accounting_stock_movements_v2';
export const LOCAL_STORAGE_KEY_EMPLOYEES = 'adv_accounting_employees_v2';
export const LOCAL_STORAGE_KEY_ATTENDANCE = 'adv_accounting_attendance_v2';
export const LOCAL_STORAGE_KEY_PAYROLLS = 'adv_accounting_payrolls_v2';
export const LOCAL_STORAGE_KEY_SEQUENCES = 'adv_accounting_doc_sequences_v2';

// دالة تقريب مالي دقيقة إلى منزلتين عشريتين (بالهللات) لمنع أخطاء الفاصلة العائمة
export function roundMoney(val: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// قراءة آمنة ومحققة من localStorage مع عزل البيانات التالفة دون انهيار التطبيق
export function safeLoadArray<T>(key: string, fallback: T[], validator?: (item: any) => boolean): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    if (validator) {
      return parsed.filter((item) => item && typeof item === 'object' && validator(item));
    }
    return parsed.filter((item) => item && typeof item === 'object');
  } catch (err) {
    console.warn(`Corrupted localStorage key "${key}" isolated:`, err);
    return fallback;
  }
}

// ==========================================
// مولد الأرقام التسلسلية الذري غير القابل للتكرار حتى بعد الحذف
// ==========================================
export type SequenceDocPrefix = 'INV' | 'QT' | 'RC' | 'PV' | 'CN' | 'PR' | 'SUP' | 'MOV' | 'EMP' | 'PAY';

interface SequenceCounterMap {
  [key: string]: number;
}

export function getNextSequenceNumber(
  prefix: SequenceDocPrefix,
  existingNumbers: string[] = [],
  includeYear: boolean = true
): string {
  const year = new Date().getFullYear();
  const counterKey = includeYear ? `${prefix}-${year}` : prefix;
  let counters: SequenceCounterMap = {};

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_SEQUENCES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') counters = parsed;
    }
  } catch {
    counters = {};
  }

  let maxFound = counters[counterKey] || 0;

  // فحص جميع الأرقام الموجودة حالياً لضمان عدم حدوث أي تعارض أبداً
  for (const numStr of existingNumbers) {
    if (!numStr) continue;
    const matches = numStr.match(/(\d+)$/);
    if (matches && matches[1]) {
      const val = parseInt(matches[1], 10);
      if (Number.isFinite(val) && val > maxFound && val < 900000) {
        maxFound = val;
      }
    }
  }

  const nextVal = maxFound + 1;
  counters[counterKey] = nextVal;

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_SEQUENCES, JSON.stringify(counters));
  } catch {
    // ignore
  }

  const padded = String(nextVal).padStart(4, '0');
  return includeYear ? `${prefix}-${year}-${padded}` : `${prefix}-${padded}`;
}

export function calculateDelayDays(deliveryDateStr: string, orderStatus: string): number | '' {
  if (!deliveryDateStr || orderStatus === 'تم التسليم' || orderStatus === 'ملغى') {
    return '';
  }
  const delivery = new Date(deliveryDateStr);
  if (isNaN(delivery.getTime())) return '';
  const today = new Date();
  delivery.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (delivery < today) {
    const diffTime = today.getTime() - delivery.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return '';
}

export function getPaymentStatusDisplay(code: PaymentStatusCode): string {
  switch (code) {
    case 'paid':
      return '✅ مسدد';
    case 'partial':
      return '🟡 مسدد جزئي';
    case 'unpaid':
    default:
      return '🔴 غير مسدد';
  }
}

export function derivePaymentStatusCode(paidAmount: number, effectiveNetTotal: number): PaymentStatusCode {
  const paid = roundMoney(paidAmount);
  const net = roundMoney(effectiveNetTotal);
  const remaining = Math.max(0, roundMoney(net - paid));
  if (remaining === 0 && net > 0) return 'paid';
  if (paid > 0 && remaining > 0) return 'partial';
  return 'unpaid';
}

// إعدادات الوكالة الافتراضية بدون بريد أو رقم ضريبي شخصي مثبت في الكود
export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  agencyName: 'وكالة الإبداع للدعاية والإعلان والمطبوعات',
  agencySubtitle: 'خدمات الطباعة الرقمية واللوحات الإعلانية والأوفست وستاندات المعارض',
  agencyCountry: 'المملكة العربية السعودية',
  agencyVatNumber: '',
  showVatNumber: true,
  defaultTaxRate: 15,
  agencyPhone: '',
  agencyAddress: 'المملكة العربية السعودية',
  agencyLogoUrl: null,
  agencyStampUrl: null,
  invoiceFooterText: 'شكراً لتعاملكم معنا - نسعد دائماً بخدمتكم',
  showQrCode: true,
  customQrUrl: null,
  invoiceLockApproved: true,
  userProfile: {
    name: 'مدير النظام',
    email: '',
    role: 'مالك (Owner)',
    phone: '',
    avatarUrl: null,
  },
  collaborators: [],
  parties: [
    {
      id: 'party-1',
      name: 'شركة الأفق للاستثمار',
      type: 'customer',
      phone: '0501234567',
      company: 'شركة الأفق للاستثمار',
      vatNumber: '310987654300003',
    },
    {
      id: 'party-2',
      name: 'مطعم مذاق الشام',
      type: 'customer',
      phone: '0559876543',
      company: 'مطعم مذاق الشام',
    },
    {
      id: 'party-3',
      name: 'مؤسسة خامات الإعلان الحديثة',
      type: 'supplier',
      phone: '0561122334',
      company: 'مؤسسة خامات الإعلان الحديثة',
      vatNumber: '310123456700003',
    },
  ],
};

export function computeSaleDerivedFields(
  item: Partial<SaleItem>,
  index: number,
  existingInvoiceNos: string[] = []
): SaleItem {
  let items: SaleLineItem[] = [];
  let invoiceTotal = 0;

  if (item.items && item.items.length > 0) {
    items = item.items.map((it, i) => {
      const q = Math.max(0, Number(it.quantity) || 0);
      const up = Math.max(0, Number(it.unitPrice) || 0);
      const lineTot = roundMoney(q * up);
      return {
        id: it.id || `line-${i}-${Date.now()}`,
        serviceType: (it.serviceType || '').trim(),
        specifications: (it.specifications || '').trim(),
        quantity: q,
        unitType: (it.unitType || '').trim(),
        unitPrice: up,
        itemTotal: lineTot,
        inventoryItemId: it.inventoryItemId,
      };
    });
    invoiceTotal = roundMoney(items.reduce((sum, it) => sum + it.itemTotal, 0));
  } else {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const singleTotal = roundMoney(qty * unitPrice);
    invoiceTotal =
      item.invoiceTotal !== undefined && item.invoiceTotal !== null
        ? roundMoney(Number(item.invoiceTotal))
        : singleTotal;
    items = [
      {
        id: `line-0-${Date.now()}`,
        serviceType: (item.serviceType || '').trim(),
        specifications: (item.specifications || '').trim(),
        quantity: qty,
        unitType: (item.unitType || '').trim(),
        unitPrice,
        itemTotal: singleTotal,
      },
    ];
  }

  const primaryItem = items[0] || {
    serviceType: item.serviceType || '',
    specifications: item.specifications || '',
    quantity: Number(item.quantity) || 0,
    unitType: item.unitType || '',
    unitPrice: Number(item.unitPrice) || 0,
    itemTotal: invoiceTotal,
  };

  const discountType = item.discountType || 'amount';
  let discount = Math.max(0, roundMoney(Number(item.discount) || 0));
  let discountPercent = item.discountPercent !== undefined ? Number(item.discountPercent) : 0;

  if (discountType === 'percentage') {
    if (discountPercent > 0) {
      discount = roundMoney((invoiceTotal * Math.min(100, discountPercent)) / 100);
    } else {
      discount = 0;
    }
  } else if (invoiceTotal > 0 && discount > 0) {
    discount = Math.min(invoiceTotal, discount);
    discountPercent = Math.round(((discount / invoiceTotal) * 100) * 10) / 10;
  }

  const isTaxInvoice = Boolean(item.isTaxInvoice);
  const taxRate =
    item.taxRate !== undefined && item.taxRate !== null && Number(item.taxRate) >= 0
      ? Number(item.taxRate)
      : DEFAULT_AGENCY_SETTINGS.defaultTaxRate || 15;
  const subtotalBeforeTax = Math.max(0, roundMoney(invoiceTotal - discount));
  const taxAmount = isTaxInvoice ? roundMoney(subtotalBeforeTax * (taxRate / 100)) : 0;
  const netTotal = isTaxInvoice ? roundMoney(subtotalBeforeTax + taxAmount) : subtotalBeforeTax;

  const returnedAmount = Math.max(0, roundMoney(Number(item.returnedAmount) || 0));
  const effectiveNetAfterReturns = Math.max(0, roundMoney(netTotal - returnedAmount));

  const paidAmount = Math.max(0, roundMoney(Number(item.paidAmount) || 0));
  const initialPaidAmount =
    item.initialPaidAmount !== undefined
      ? Math.max(0, roundMoney(Number(item.initialPaidAmount) || 0))
      : paidAmount;
  const remainingAmount = Math.max(0, roundMoney(effectiveNetAfterReturns - paidAmount));

  const paymentStatusCode = derivePaymentStatusCode(paidAmount, effectiveNetAfterReturns);
  const paymentStatus = getPaymentStatusDisplay(paymentStatusCode);

  // توحيد بادئة الفواتير (INV-YYYY-XXXX) وتجنب تعارض الأرقام
  let invoiceNo = (item.invoiceNo || '').trim();
  if (!invoiceNo) {
    invoiceNo =
      existingInvoiceNos.length > 0
        ? getNextSequenceNumber('INV', existingInvoiceNos)
        : `INV-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`;
  }

  const receiptDate = item.receiptDate || new Date().toISOString().split('T')[0];
  const delayDays = calculateDelayDays(item.deliveryDate || '', item.orderStatus || 'قيد التصميم');

  return {
    id: item.id || `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    invoiceNo,
    customerName: (item.customerName || '').trim(),
    customerPhone: (item.customerPhone || '').trim(),
    customerSource: item.customerSource || '',
    serviceType:
      items.length > 1 ? `${primaryItem.serviceType} (+${items.length - 1} خدمات)` : primaryItem.serviceType,
    specifications: primaryItem.specifications || '',
    quantity: items.length > 1 ? items.reduce((s, it) => s + it.quantity, 0) : primaryItem.quantity,
    unitType: primaryItem.unitType || '',
    unitPrice: primaryItem.unitPrice || 0,
    itemTotal: primaryItem.itemTotal || 0,
    invoiceTotal,
    discount,
    discountType,
    discountPercent,
    netTotal,
    paymentMethod: item.paymentMethod || '',
    paidAmount,
    initialPaidAmount,
    remainingAmount,
    returnedAmount,
    paymentStatus,
    paymentStatusCode,
    receiptDate,
    deliveryDate: item.deliveryDate || '',
    orderStatus: item.orderStatus || '',
    assignedTo: item.assignedTo || '',
    delayDays,
    notes: item.notes || '',
    items,
    isTaxInvoice,
    taxRate,
    taxAmount,
    subtotalBeforeTax,
    customerVatNumber: (item.customerVatNumber || '').trim(),
    agencyVatNumber: item.agencyVatNumber || DEFAULT_AGENCY_SETTINGS.agencyVatNumber,
    revenueSource: item.revenueSource || 'المحل المباشر',
    deductFromInventory: Boolean(item.deductFromInventory),
    consumedMaterials: item.consumedMaterials || [],
    audit: item.audit,
  };
}

export function computePurchaseDerivedFields(
  item: Partial<PurchaseItem>,
  existingPurchaseNos: string[] = []
): PurchaseItem {
  let items: PurchaseLineItem[] = [];
  let calculatedSubtotal = 0;

  if (item.items && item.items.length > 0) {
    items = item.items.map((it, i) => {
      const q = Math.max(0, Number(it.quantity) || 0);
      const price = Math.max(0, Number(it.purchasePrice) || 0);
      const lineTot = roundMoney(q * price);
      return {
        id: it.id || `pline-${i}-${Date.now()}`,
        item: (it.item || '').trim(),
        unitType: (it.unitType || '').trim(),
        quantity: q,
        purchasePrice: price,
        total: lineTot,
        notes: it.notes || '',
        inventoryItemId: it.inventoryItemId,
      };
    });
    calculatedSubtotal = roundMoney(items.reduce((sum, it) => sum + it.total, 0));
  } else {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.purchasePrice) || 0);
    calculatedSubtotal = roundMoney(qty * price);
    items = [
      {
        id: `pline-0-${Date.now()}`,
        item: (item.item || '').trim(),
        unitType: (item.unitType || '').trim(),
        quantity: qty,
        purchasePrice: price,
        total: calculatedSubtotal,
        notes: item.notes || '',
      },
    ];
  }

  const primaryItem = items[0] || {
    item: item.item || '',
    unitType: item.unitType || '',
    quantity: Number(item.quantity) || 0,
    purchasePrice: Number(item.purchasePrice) || 0,
    total: calculatedSubtotal,
  };

  const isTaxInvoice = Boolean(item.isTaxInvoice);
  const taxRate =
    item.taxRate !== undefined && item.taxRate !== null && Number(item.taxRate) >= 0
      ? Number(item.taxRate)
      : DEFAULT_AGENCY_SETTINGS.defaultTaxRate || 15;
  const subtotalBeforeTax = roundMoney(calculatedSubtotal);
  const taxAmount = isTaxInvoice ? roundMoney(subtotalBeforeTax * (taxRate / 100)) : 0;
  const total = isTaxInvoice ? roundMoney(subtotalBeforeTax + taxAmount) : subtotalBeforeTax;

  const returnedAmount = Math.max(0, roundMoney(Number(item.returnedAmount) || 0));
  const effectiveTotalAfterReturns = Math.max(0, roundMoney(total - returnedAmount));

  const paidAmount = Math.max(0, roundMoney(Number(item.paidAmount) || 0));
  const initialPaidAmount =
    item.initialPaidAmount !== undefined
      ? Math.max(0, roundMoney(Number(item.initialPaidAmount) || 0))
      : paidAmount;
  const remainingAmount = Math.max(0, roundMoney(effectiveTotalAfterReturns - paidAmount));

  const paymentStatusCode = derivePaymentStatusCode(paidAmount, effectiveTotalAfterReturns);
  const paymentStatus = getPaymentStatusDisplay(paymentStatusCode);

  let supplierInvoiceNo = (item.supplierInvoiceNo || '').trim();
  if (!supplierInvoiceNo && existingPurchaseNos.length > 0) {
    supplierInvoiceNo = getNextSequenceNumber('SUP', existingPurchaseNos);
  }

  return {
    id: item.id || `purch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    date: item.date || new Date().toISOString().split('T')[0],
    supplierInvoiceNo,
    item: items.length > 1 ? `${primaryItem.item} (+${items.length - 1} أصناف)` : primaryItem.item,
    supplierType: item.supplierType || '',
    unitType: primaryItem.unitType || '',
    quantity: items.length > 1 ? items.reduce((s, it) => s + it.quantity, 0) : primaryItem.quantity,
    purchasePrice: primaryItem.purchasePrice || 0,
    subtotalBeforeTax,
    taxRate: isTaxInvoice ? taxRate : 0,
    taxAmount,
    isTaxInvoice,
    supplierVatNumber: (item.supplierVatNumber || '').trim(),
    total,
    supplier: (item.supplier || '').trim(),
    paymentMethod: item.paymentMethod || '',
    paidAmount,
    initialPaidAmount,
    remainingAmount,
    returnedAmount,
    paymentStatus,
    paymentStatusCode,
    notes: item.notes || '',
    items,
    addToInventory: item.addToInventory !== undefined ? Boolean(item.addToInventory) : true,
    audit: item.audit,
  };
}

/**
 * إعادة احتساب المدفوعات والمتبقي لجميع الفواتير والمشتريات والمرتجعات ديناميكياً
 * بناءً على الدفعة الأولية + مجموع سندات التسوية المرتبطة + المرتجعات
 * مما يصلح جذرياً مشكلة حذف أو تعديل سند التسوية أو إضافة إشعار دائن
 */
export function reconcileDocumentsWithVouchersAndReturns(
  sales: SaleItem[],
  purchases: PurchaseItem[],
  vouchers: VoucherItem[],
  returns: ReturnRecord[] = []
): { updatedSales: SaleItem[]; updatedPurchases: PurchaseItem[] } {
  const updatedSales = sales.map((sale) => {
    // 1. حساب مجموع سندات القبض المرتبطة بهذه الفاتورة
    const settledReceipts = vouchers
      .filter(
        (v) =>
          v.type === 'receipt' &&
          (v.isInvoiceSettlement || v.relatedDocType === 'sale' || Boolean(v.relatedInvoiceNo)) &&
          (v.relatedDocId === sale.id ||
            (v.relatedInvoiceNo &&
              (v.relatedInvoiceNo === sale.invoiceNo || v.relatedInvoiceNo === sale.id)))
      )
      .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);

    // 2. حساب مجموع مرتجعات المبيعات (إشعارات الدائن) المرتبطة بهذه الفاتورة
    const saleReturnsTotal = returns
      .filter(
        (r) =>
          r.kind === 'sale_return' &&
          (r.originalDocId === sale.id || r.originalDocNo === sale.invoiceNo)
      )
      .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

    // 3. الدفعة المبدئية (قبل سندات التسوية)
    const baseInitialPaid =
      sale.initialPaidAmount !== undefined
        ? Number(sale.initialPaidAmount)
        : Math.max(0, Number(sale.paidAmount) || 0);

    const effectiveMaxPayable = Math.max(0, roundMoney(sale.netTotal - saleReturnsTotal));
    const totalPaid = Math.min(effectiveMaxPayable, roundMoney(baseInitialPaid + settledReceipts));

    return computeSaleDerivedFields(
      {
        ...sale,
        initialPaidAmount: baseInitialPaid,
        paidAmount: totalPaid,
        returnedAmount: saleReturnsTotal,
      },
      0
    );
  });

  const updatedPurchases = purchases.map((purch) => {
    const settledPayments = vouchers
      .filter(
        (v) =>
          v.type === 'payment' &&
          (v.relatedDocType === 'purchase' || Boolean(v.relatedInvoiceNo)) &&
          (v.relatedDocId === purch.id ||
            (v.relatedInvoiceNo &&
              (v.relatedInvoiceNo === purch.supplierInvoiceNo || v.relatedInvoiceNo === purch.id)))
      )
      .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);

    const purchaseReturnsTotal = returns
      .filter(
        (r) =>
          r.kind === 'purchase_return' &&
          (r.originalDocId === purch.id || r.originalDocNo === purch.supplierInvoiceNo)
      )
      .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

    const baseInitialPaid =
      purch.initialPaidAmount !== undefined
        ? Number(purch.initialPaidAmount)
        : Math.max(0, Number(purch.paidAmount) || 0);

    const effectiveMaxPayable = Math.max(0, roundMoney(purch.total - purchaseReturnsTotal));
    const totalPaid = Math.min(effectiveMaxPayable, roundMoney(baseInitialPaid + settledPayments));

    return computePurchaseDerivedFields({
      ...purch,
      initialPaidAmount: baseInitialPaid,
      paidAmount: totalPaid,
      returnedAmount: purchaseReturnsTotal,
    });
  });

  return { updatedSales, updatedPurchases };
}

export function computeInventoryStatus(currentQty: number, minQty: number): string {
  if (currentQty <= minQty) {
    return '🛒 طلب شراء';
  }
  if (currentQty <= minQty * 1.5) {
    return '🟡 منخفض';
  }
  return '🟢 كافي';
}

export function calculateDashboardMetrics(
  sales: SaleItem[],
  purchases: PurchaseItem[],
  expenses: ExpenseItem[],
  inventory: InventoryItem[],
  returns: ReturnRecord[] = [],
  movements: InventoryMovement[] = []
): DashboardMetrics {
  const activeSales = sales.filter((s) => s.orderStatus !== 'ملغى');

  const totalSales = roundMoney(
    activeSales.reduce((sum, item) => sum + (Number(item.netTotal) || 0), 0)
  );

  const totalSaleReturns = roundMoney(
    returns
      .filter((r) => r.kind === 'sale_return')
      .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0)
  );

  const netSalesAfterReturns = Math.max(0, roundMoney(totalSales - totalSaleReturns));

  const totalPurchases = roundMoney(
    purchases.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  );

  const totalPurchaseReturns = roundMoney(
    returns
      .filter((r) => r.kind === 'purchase_return')
      .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0)
  );

  const netPurchasesAfterReturns = Math.max(0, roundMoney(totalPurchases - totalPurchaseReturns));

  const totalExpenses = roundMoney(
    expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  );

  const wastageCost = roundMoney(
    movements
      .filter((m) => m.type === 'wastage_out')
      .reduce((sum, m) => sum + Math.abs(Number(m.totalCost) || 0), 0)
  );

  // صافي الربح الدقيق = صافي المبيعات بعد المرتجعات - صافي المشتريات بعد المرتجعات - المصروفات التشغيلية - تكلفة الهالك المستقلة
  const netProfit = roundMoney(
    netSalesAfterReturns - netPurchasesAfterReturns - totalExpenses - wastageCost
  );

  const customerReceivables = roundMoney(
    activeSales.reduce((sum, item) => sum + (Number(item.remainingAmount) || 0), 0)
  );

  const supplierPayables = roundMoney(
    purchases.reduce((sum, item) => sum + (Number(item.remainingAmount) || 0), 0)
  );

  const expectedCashFlow = roundMoney(netProfit + customerReceivables - supplierPayables);

  const unpaidInvoicesCount = activeSales.filter(
    (s) => s.paymentStatusCode === 'unpaid' || s.paymentStatus.includes('غير مسدد')
  ).length;
  const partiallyPaidCount = activeSales.filter(
    (s) => s.paymentStatusCode === 'partial' || s.paymentStatus.includes('مسدد جزئي')
  ).length;
  const paidCount = activeSales.filter(
    (s) => s.paymentStatusCode === 'paid' || s.paymentStatus.includes('✅')
  ).length;

  const ordersInProgressCount = activeSales.filter(
    (s) => s.orderStatus !== 'تم التسليم' && s.orderStatus !== 'ملغى'
  ).length;

  const lowStockItemsCount = inventory.filter(
    (i) => i.currentQty <= i.minQty * 1.5 || i.status.includes('طلب شراء') || i.status.includes('منخفض')
  ).length;

  // حساب ضريبة القيمة المضافة الصافية
  const grossOutputVat = activeSales
    .filter((s) => s.isTaxInvoice)
    .reduce((sum, s) => sum + (Number(s.taxAmount) || 0), 0);
  const returnedOutputVat = returns
    .filter((r) => r.kind === 'sale_return' && r.isTaxIncluded)
    .reduce((sum, r) => sum + (Number(r.taxAmount) || 0), 0);
  const outputVatTotal = Math.max(0, roundMoney(grossOutputVat - returnedOutputVat));

  const grossInputVat = purchases
    .filter((p) => p.isTaxInvoice)
    .reduce((sum, p) => sum + (Number(p.taxAmount) || 0), 0);
  const returnedInputVat = returns
    .filter((r) => r.kind === 'purchase_return' && r.isTaxIncluded)
    .reduce((sum, r) => sum + (Number(r.taxAmount) || 0), 0);
  const inputVatTotal = Math.max(0, roundMoney(grossInputVat - returnedInputVat));

  const netVatPayable = roundMoney(outputVatTotal - inputVatTotal);

  return {
    totalSales: netSalesAfterReturns,
    totalSaleReturns,
    netSalesAfterReturns,
    totalPurchases: netPurchasesAfterReturns,
    totalPurchaseReturns,
    netPurchasesAfterReturns,
    totalExpenses,
    wastageCost,
    netProfit,
    customerReceivables,
    supplierPayables,
    expectedCashFlow,
    unpaidInvoicesCount,
    partiallyPaidCount,
    paidCount,
    ordersInProgressCount,
    lowStockItemsCount,
    outputVatTotal,
    inputVatTotal,
    netVatPayable,
  };
}

export function computeQuotationDerivedFields(
  item: Partial<QuotationItem>,
  index: number,
  existingQuotationNos: string[] = []
): QuotationItem {
  let items: QuotationLineItem[] = [];
  let subtotal = 0;

  if (item.items && item.items.length > 0) {
    items = item.items.map((it, i) => {
      const q = Math.max(0, Number(it.quantity) || 0);
      const up = Math.max(0, Number(it.unitPrice) || 0);
      const total = roundMoney(q * up);
      return {
        id: it.id || `qline-${Date.now()}-${i + 1}`,
        serviceType: (it.serviceType || '').trim(),
        specifications: (it.specifications || '').trim(),
        quantity: q,
        unitType: (it.unitType || '').trim(),
        unitPrice: up,
        itemTotal: total,
      };
    });
    subtotal = roundMoney(items.reduce((sum, it) => sum + it.itemTotal, 0));
  } else {
    subtotal = roundMoney(Number(item.subtotal) || 0);
  }

  const discountType = item.discountType || 'amount';
  let discount = Math.max(0, roundMoney(Number(item.discount) || 0));
  let discountPercent = item.discountPercent !== undefined ? Number(item.discountPercent) : 0;

  if (discountType === 'percentage') {
    if (discountPercent > 0) {
      discount = roundMoney((subtotal * Math.min(100, discountPercent)) / 100);
    } else {
      discount = 0;
    }
  } else if (subtotal > 0 && discount > 0) {
    discount = Math.min(subtotal, discount);
    discountPercent = Math.round(((discount / subtotal) * 100) * 10) / 10;
  }

  const netAfterDiscount = Math.max(0, roundMoney(subtotal - discount));

  const isTaxIncluded = Boolean(item.isTaxIncluded);
  // إصلاح الخطأ #4: استخدام taxRate المدخل بدلاً من تثبيت 15%
  const taxRate =
    item.taxRate !== undefined && item.taxRate !== null && Number(item.taxRate) >= 0
      ? Number(item.taxRate)
      : DEFAULT_AGENCY_SETTINGS.defaultTaxRate || 15;
  const taxAmount = isTaxIncluded ? roundMoney(netAfterDiscount * (taxRate / 100)) : 0;
  const netTotal = roundMoney(netAfterDiscount + taxAmount);

  const today = new Date().toISOString().split('T')[0];
  const issueDate = item.issueDate || today;

  const validityDays =
    item.validityDays !== undefined && item.validityDays !== '' && Number(item.validityDays) > 0
      ? Number(item.validityDays)
      : '';

  let expiryDate = '';
  if (validityDays && typeof validityDays === 'number' && issueDate) {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + validityDays);
    expiryDate = d.toISOString().split('T')[0];
  } else if (item.expiryDate) {
    expiryDate = item.expiryDate;
  }

  let quotationNo = (item.quotationNo || '').trim();
  if (!quotationNo) {
    quotationNo =
      existingQuotationNos.length > 0
        ? getNextSequenceNumber('QT', existingQuotationNos)
        : `QT-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`;
  }

  return {
    id: item.id || `quote-${Date.now()}-${index + 1}`,
    quotationNo,
    customerName: (item.customerName || '').trim(),
    customerPhone: (item.customerPhone || '').trim(),
    customerCompany: (item.customerCompany || '').trim(),
    customerEmail: (item.customerEmail || '').trim(),
    customerVatNumber: (item.customerVatNumber || '').trim(),
    issueDate,
    validityDays,
    expiryDate,
    status: item.status || 'بانتظار الاعتماد',
    items,
    subtotal,
    discount,
    discountType,
    discountPercent,
    isTaxIncluded,
    taxRate,
    taxAmount,
    netTotal,
    paymentTerms: (item.paymentTerms || '').trim(),
    executionDays: (item.executionDays || '').trim(),
    notes: (item.notes || '').trim(),
    includeCustomerApproval: Boolean(item.includeCustomerApproval),
    convertedSaleId: item.convertedSaleId,
    convertedDate: item.convertedDate,
    revenueSource: item.revenueSource || 'المحل المباشر',
    audit: item.audit,
  };
}

/**
 * إصلاح الخطأ #2 و #3: تحويل عرض السعر إلى فاتورة مبيعات عبر computeSaleDerivedFields
 * مع الحفاظ الكامل على الضريبة والخصم وتوليد رقم فاتورة تسلسلي موحد غير مكرر
 */
export function convertQuotationToSale(
  quotation: QuotationItem,
  currentSalesCount: number,
  existingInvoiceNos: string[] = []
): SaleItem {
  const today = new Date().toISOString().split('T')[0];
  const invoiceNo = getNextSequenceNumber('INV', existingInvoiceNos);

  const saleLines: SaleLineItem[] = quotation.items.map((line, idx) => ({
    id: `line-${Date.now()}-${idx + 1}`,
    serviceType: line.serviceType,
    specifications: line.specifications,
    quantity: line.quantity,
    unitType: line.unitType,
    unitPrice: line.unitPrice,
    itemTotal: roundMoney(line.quantity * line.unitPrice),
  }));

  const primaryService = saleLines[0]?.serviceType || 'تنفيذ طلب معتمد من عرض سعر';
  const primarySpecs = saleLines.map((l) => `${l.serviceType}: ${l.specifications || ''}`).join(' | ');

  return computeSaleDerivedFields(
    {
      id: `sale-from-quote-${Date.now()}`,
      invoiceNo,
      customerName: quotation.customerName,
      customerPhone: quotation.customerPhone || '',
      customerSource: quotation.customerCompany ? `شركة: ${quotation.customerCompany}` : 'عرض سعر معتمد',
      serviceType: primaryService,
      specifications: primarySpecs,
      quantity: saleLines.reduce((s, it) => s + it.quantity, 0) || 1,
      unitType: saleLines[0]?.unitType || 'طلب',
      unitPrice: saleLines[0]?.unitPrice || quotation.subtotal,
      itemTotal: quotation.subtotal,
      invoiceTotal: quotation.subtotal,
      discount: quotation.discount,
      discountType: quotation.discountType || 'amount',
      discountPercent: quotation.discountPercent,
      paymentMethod: 'تحويل',
      paidAmount: 0,
      initialPaidAmount: 0,
      receiptDate: today,
      deliveryDate: '',
      orderStatus: 'قيد التصميم',
      assignedTo: '',
      notes: `تم إنشاء الطلب بناءً على اعتماد عرض السعر رقم: ${quotation.quotationNo} بتاريخ ${quotation.issueDate}. ${quotation.notes || ''}`.trim(),
      items: saleLines,
      isTaxInvoice: Boolean(quotation.isTaxIncluded),
      taxRate: quotation.taxRate !== undefined ? quotation.taxRate : 15,
      customerVatNumber: quotation.customerVatNumber || '',
      revenueSource: quotation.revenueSource || 'المحل المباشر',
      audit: quotation.audit,
    },
    currentSalesCount,
    existingInvoiceNos
  );
}

export const INITIAL_SALES: SaleItem[] = [
  computeSaleDerivedFields(
    {
      invoiceNo: `INV-${new Date().getFullYear()}-0001`,
      customerName: 'شركة الأفق للاستثمار',
      customerPhone: '0501234567',
      customerSource: 'عميل مباشر',
      serviceType: 'لافتات فينيل',
      specifications: 'لافتة خارجية مع إضاءة LED مقاس 3x1 متر',
      quantity: 3,
      unitType: 'متر',
      unitPrice: 450,
      invoiceTotal: 1350,
      discount: 100,
      paymentMethod: 'شبكة',
      paidAmount: 1250,
      initialPaidAmount: 1250,
      deliveryDate: '2026-11-25',
      orderStatus: 'قيد الطباعة',
      assignedTo: 'أحمد الخطاط',
      notes: 'التركيب مشمول بالعقد',
    },
    0
  ),
  computeSaleDerivedFields(
    {
      invoiceNo: `INV-${new Date().getFullYear()}-0002`,
      customerName: 'مطعم مذاق الشام',
      customerPhone: '0559876543',
      customerSource: 'توصية',
      serviceType: 'طباعة بروشورات',
      specifications: 'منيو مطعم ورق كوشيه مطفي 250 جرام وجهين',
      quantity: 500,
      unitType: 'قطعة',
      unitPrice: 1.8,
      invoiceTotal: 900,
      discount: 50,
      paymentMethod: 'كاش',
      paidAmount: 400,
      initialPaidAmount: 400,
      deliveryDate: '2026-11-22',
      orderStatus: 'جاهز للطباعة',
      assignedTo: 'سامر المصمم',
      notes: 'دفعة أولى 400 والباقي عند الاستلام',
    },
    1
  ),
  computeSaleDerivedFields(
    {
      invoiceNo: `INV-${new Date().getFullYear()}-0003`,
      customerName: 'مكتب النخبة العقاري',
      customerPhone: '0533344455',
      customerSource: 'عميل سابق',
      serviceType: 'بطاقات عمل',
      specifications: 'كروت شخصية فاخرة سبوت يو في مع بروز ذهبي',
      quantity: 1000,
      unitType: 'قطعة',
      unitPrice: 0.6,
      invoiceTotal: 600,
      discount: 0,
      paymentMethod: 'تحويل',
      paidAmount: 600,
      initialPaidAmount: 600,
      deliveryDate: '2026-11-14',
      orderStatus: 'تم التسليم',
      assignedTo: 'مروان فني القص',
      notes: 'تم التسليم بالكامل',
    },
    2
  ),
  computeSaleDerivedFields(
    {
      invoiceNo: `INV-${new Date().getFullYear()}-0004`,
      customerName: 'عيادات د. خالد لطب الأسنان',
      customerPhone: '0567788990',
      customerSource: 'وسائل تواصل',
      serviceType: 'ستاندات عرض',
      specifications: 'رول أب ستاند مقاس 85x200 سم مع طباعة عالية الدقة',
      quantity: 2,
      unitType: 'قطعة',
      unitPrice: 220,
      invoiceTotal: 440,
      discount: 40,
      paymentMethod: 'آجل',
      paidAmount: 0,
      initialPaidAmount: 0,
      deliveryDate: '2026-11-12',
      orderStatus: 'جاهز للتسليم',
      assignedTo: 'سعيد التجهيز',
      notes: 'فاتورة مؤجلة سداد نهاية الشهر',
    },
    3
  ),
];

export const INITIAL_PURCHASES: PurchaseItem[] = [
  computePurchaseDerivedFields({
    supplierInvoiceNo: 'SUP-2026-0001',
    item: 'فينيل',
    unitType: 'رول',
    quantity: 4,
    purchasePrice: 190,
    supplier: 'مؤسسة خامات الإعلان الحديثة',
    paymentMethod: 'تحويل',
    paidAmount: 874,
    initialPaidAmount: 874,
    isTaxInvoice: true,
    supplierVatNumber: '310123456700003',
    notes: 'فاتورة ضريبية رسمية معتمدة',
  }),
  computePurchaseDerivedFields({
    supplierInvoiceNo: 'SUP-2026-0002',
    item: 'حبر',
    unitType: 'لتر',
    quantity: 4,
    purchasePrice: 220,
    supplier: 'شركة تكنو برنت للمستلزمات',
    paymentMethod: 'آجل',
    paidAmount: 300,
    initialPaidAmount: 300,
    isTaxInvoice: false,
    notes: 'مشتريات بدون ضريبة',
  }),
  computePurchaseDerivedFields({
    supplierInvoiceNo: 'SUP-2026-0003',
    item: 'ورق طباعة',
    unitType: 'رزمة',
    quantity: 10,
    purchasePrice: 45,
    supplier: 'مستودعات الخليج للورق',
    paymentMethod: 'شبكة',
    paidAmount: 517.5,
    initialPaidAmount: 517.5,
    isTaxInvoice: true,
    supplierVatNumber: '300998877600003',
  }),
];

export const INITIAL_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-1',
    date: '2026-11-01',
    expenseType: 'إيجار المقر',
    category: 'تشغيلية',
    amount: 3500,
    paymentMethod: 'تحويل',
    notes: 'دفعة إيجار المقر الشهري',
  },
  {
    id: 'exp-2',
    date: '2026-11-05',
    expenseType: 'فواتير الكهرباء',
    category: 'تشغيلية',
    amount: 480,
    paymentMethod: 'شبكة',
    notes: 'فاتورة استهلاك ماكينات الطباعة',
  },
  {
    id: 'exp-3',
    date: '2026-11-08',
    expenseType: 'صيانة معدات',
    category: 'تشغيلية',
    amount: 320,
    paymentMethod: 'كاش',
    notes: 'تغيير رؤوس تنظيف ماكينة الفينيل',
  },
  {
    id: 'exp-4',
    date: '2026-11-10',
    expenseType: 'إعلانات وتسويق',
    category: 'تسويقية',
    amount: 250,
    paymentMethod: 'شبكة',
    notes: 'حملة إعلانية ممولة',
  },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    item: 'فينيل',
    type: 'لامع',
    color: 'أبيض',
    unit: 'رول',
    currentQty: 12,
    minQty: 5,
    unitCost: 190,
    status: computeInventoryStatus(12, 5),
    statusCode: 'ok',
    notes: 'عرض 127 سم ماركة أوراكال',
  },
  {
    id: 'inv-2',
    item: 'حبر',
    type: 'عادي',
    color: 'أسود',
    unit: 'لتر',
    currentQty: 2,
    minQty: 3,
    unitCost: 220,
    status: computeInventoryStatus(2, 3),
    statusCode: 'reorder',
    notes: 'حبر إيكو سولفنت عالي الدقة',
  },
  {
    id: 'inv-3',
    item: 'بانر',
    type: 'مقاوم للماء',
    color: 'أبيض',
    unit: 'متر',
    currentQty: 45,
    minQty: 40,
    unitCost: 14,
    status: computeInventoryStatus(45, 40),
    statusCode: 'low',
    notes: 'بانر كوري وزن 440 جرام',
  },
  {
    id: 'inv-4',
    item: 'استيكر',
    type: 'عاكس',
    color: 'أحمر',
    unit: 'متر',
    currentQty: 3,
    minQty: 10,
    unitCost: 28,
    status: computeInventoryStatus(3, 10),
    statusCode: 'reorder',
    notes: 'للوحات السلامة والمشاريع',
  },
  {
    id: 'inv-5',
    item: 'ورق طباعة',
    type: 'مات',
    color: 'أبيض',
    unit: 'رزمة',
    currentQty: 25,
    minQty: 10,
    unitCost: 45,
    status: computeInventoryStatus(25, 10),
    statusCode: 'ok',
    notes: 'كوشيه مطفي 300 جرام',
  },
];

export const INITIAL_QUOTATIONS: QuotationItem[] = [
  {
    id: 'quote-1',
    quotationNo: `QT-${new Date().getFullYear()}-0001`,
    customerName: 'مؤسسة أفق التقنية',
    customerPhone: '0555987654',
    customerCompany: 'شركة أفق للحلول الرقمية',
    customerEmail: '',
    customerVatNumber: '310987654300003',
    issueDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    validityDays: 15,
    expiryDate: new Date(Date.now() + 13 * 86400000).toISOString().split('T')[0],
    status: 'بانتظار الاعتماد',
    items: [
      {
        id: 'qline-1',
        serviceType: 'لوحات محلات ومؤسسات',
        specifications: 'لوحة زنكور بارز مع إضاءة ليد خلفية مقاس 4م × 1.2م مقاومة للعوامل الجوية',
        quantity: 1,
        unitType: 'لوحة',
        unitPrice: 2800,
        itemTotal: 2800,
      },
      {
        id: 'qline-2',
        serviceType: 'رول أب ومطبوعات معارض',
        specifications: 'رول أب ستاند ألومنيوم فاخر مقاس 85×200 سم طباعة ديجيتال فيلم غير قابل للتمزق',
        quantity: 4,
        unitType: 'ستاند',
        unitPrice: 175,
        itemTotal: 700,
      },
    ],
    subtotal: 3500,
    discount: 100,
    isTaxIncluded: true,
    taxRate: 15,
    taxAmount: 510,
    netTotal: 3910,
    paymentTerms: '50% دفعة مقدمة عند التعميد، و50% المتبقية عند التسليم والتركيب',
    executionDays: '4 إلى 6 أيام عمل بعد اعتماد التصاميم النهائية',
    notes: 'يشمل السعر التوريد والتركيب داخل نطاق المدينة مع ضمان سنة على إضاءة الليد.',
  },
  {
    id: 'quote-2',
    quotationNo: `QT-${new Date().getFullYear()}-0002`,
    customerName: 'شركة النخبة للتطوير العقاري',
    customerPhone: '0543219876',
    customerCompany: 'مجموعة النخبة العقارية',
    customerEmail: 'media@elnokhba.com',
    customerVatNumber: '311234567800003',
    issueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    validityDays: 30,
    expiryDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
    status: 'معتمد ومحول لطلب',
    items: [
      {
        id: 'qline-3',
        serviceType: 'هوية بصرية ومطبوعات ورقية',
        specifications: 'فولدرات جيب فاخرة سلوفان مطفي مع سبوت يو في مقاس A4 كمية 500 حبة',
        quantity: 500,
        unitType: 'حبة',
        unitPrice: 3.5,
        itemTotal: 1750,
      },
      {
        id: 'qline-4',
        serviceType: 'كروت شخصية فاخرة',
        specifications: 'كروت بزنس كوشيه 350 جرام كوانتم مطفي وجهين بصمة ذهبي كمية 1000 كرت',
        quantity: 1000,
        unitType: 'كرت',
        unitPrice: 0.35,
        itemTotal: 350,
      },
    ],
    subtotal: 2100,
    discount: 100,
    isTaxIncluded: false,
    taxRate: 15,
    taxAmount: 0,
    netTotal: 2000,
    paymentTerms: 'سداد كامل المبلغ بشيك مصدق أو تحويل بنكي عند استلام البضاعة',
    executionDays: '3 أيام عمل',
    notes: 'تم اعتماد العرض وتحويله للإنتاج بنجاح.',
    convertedSaleId: 'sale-1',
  },
];

export const INITIAL_VOUCHERS: VoucherItem[] = [
  {
    id: 'vouch-1',
    voucherNo: `RC-${new Date().getFullYear()}-0001`,
    type: 'receipt',
    date: new Date().toISOString().split('T')[0],
    amount: 1500,
    amountInWords: 'ألف وخمسمائة ريال سعودي فقط لا غير',
    partyName: 'مؤسسة أفق التقنية للتجارة',
    partyPhone: '0551234567',
    paymentMethod: 'شبكة مدى',
    referenceNo: 'TXN-984210',
    relatedInvoiceNo: '',
    isInvoiceSettlement: false,
    description: 'دفعة مقدمة لحساب تصميم وطباعة بنرات ولوحات إعلانية لمقر الفرع',
    receivedBy: 'أمين الصندوق',
    approvedBy: 'المدير المالي',
    notes: 'تم إيداع المبلغ في حساب نقاط البيع مدى.',
  },
  {
    id: 'vouch-2',
    voucherNo: `PV-${new Date().getFullYear()}-0001`,
    type: 'payment',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    amount: 850,
    amountInWords: 'ثمانمائة وخمسون ريال سعودي فقط لا غير',
    partyName: 'شركة النجم لمواد وأحبار الطباعة',
    partyPhone: '0569876543',
    paymentMethod: 'تحويل بنكي',
    referenceNo: 'TR-77210',
    relatedInvoiceNo: '',
    description: 'سداد قيمة توريد رولات بنر واستيكر ألماني لاصق 50 متر',
    receivedBy: 'مندوب المورد',
    approvedBy: 'المدير العام',
    notes: 'تم التحويل من حساب الراجحي للشركة.',
  },
];

export const INITIAL_EMPLOYEES: EmployeeItem[] = [
  {
    id: 'emp-1',
    employeeCode: 'EMP-0001',
    name: 'سامر المصمم',
    jobTitle: 'مصمم جرافيك أول',
    department: 'التصميم والابتكار',
    phone: '0501112233',
    nationalIdOrIqama: '2456789123',
    joinDate: '2025-01-15',
    salaryType: 'monthly',
    baseSalary: 4500,
    housingAllowance: 500,
    transportAllowance: 300,
    otherAllowance: 0,
    workingDaysPerMonth: 26,
    dailyWorkHours: 8,
    bankName: 'مصرف الراجحي',
    iban: 'SA4480000000608010167519',
    status: 'نشط',
    notes: 'مسؤول التصاميم والهويات البصرية والفرز الطباعي',
  },
  {
    id: 'emp-2',
    employeeCode: 'EMP-0002',
    name: 'أحمد الخطاط',
    jobTitle: 'فني طباعة رقمية ولوحات',
    department: 'الإنتاج والطباعة',
    phone: '0552223344',
    nationalIdOrIqama: '2398765432',
    joinDate: '2025-03-01',
    salaryType: 'monthly',
    baseSalary: 4000,
    housingAllowance: 400,
    transportAllowance: 300,
    otherAllowance: 0,
    workingDaysPerMonth: 26,
    dailyWorkHours: 8,
    bankName: 'البنك الأهلي السعودي',
    iban: 'SA1210000000123456789012',
    status: 'نشط',
    notes: 'تشغيل مكائن الفينيل والبنر والقص الحراري',
  },
  {
    id: 'emp-3',
    employeeCode: 'EMP-0003',
    name: 'مروان فني القص والتركيب',
    jobTitle: 'فني قص ليزر وتركيب ميداني',
    department: 'التركيب والتنفيذ',
    phone: '0543334455',
    nationalIdOrIqama: '2512349876',
    joinDate: '2025-06-01',
    salaryType: 'monthly',
    baseSalary: 3800,
    housingAllowance: 400,
    transportAllowance: 300,
    otherAllowance: 0,
    workingDaysPerMonth: 26,
    dailyWorkHours: 8,
    bankName: 'بنك الإنماء',
    iban: 'SA8805000068201234567000',
    status: 'نشط',
    notes: 'تركيب اللوحات الخارجية والحروف البارزة',
  },
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_PAYROLLS: PayrollRun[] = [];
export const INITIAL_RETURNS: ReturnRecord[] = [];
export const INITIAL_MOVEMENTS: InventoryMovement[] = [];

export const INITIAL_PRICE_LIST: PriceListItem[] = [
  {
    id: 'pr-1',
    materialName: 'بنر عادي خارجي (Banner 440g)',
    category: 'خامات عريضة',
    unit: 'متر مربع',
    sellingPrice: 35,
    costPrice: 14,
    minOrder: 1,
    notes: 'طباعة سولفنت خارجية عالية الوضوح مع ثني وتخريم',
  },
  {
    id: 'pr-2',
    materialName: 'فليكس لوحات مضيئة (Flex 510g)',
    category: 'خامات عريضة',
    unit: 'متر مربع',
    sellingPrice: 50,
    costPrice: 22,
    minOrder: 1,
    notes: 'خامة خاصة بنفاذية الضوء للوحات الصندوقية المضيئة',
  },
  {
    id: 'pr-3',
    materialName: 'ستيكر فينيل ألماني (Orafol / Avery)',
    category: 'خامات عريضة',
    unit: 'متر مربع',
    sellingPrice: 65,
    costPrice: 28,
    minOrder: 1,
    notes: 'لاصق ممتاز للسيارات والواجهات مقاوم للشمس والرطوبة',
  },
  {
    id: 'pr-4',
    materialName: 'ستيكر فينيل مع سلوفان حماية (Lamination)',
    category: 'خامات عريضة',
    unit: 'متر مربع',
    sellingPrice: 85,
    costPrice: 38,
    minOrder: 1,
    notes: 'طبقة حماية لمينيشن مطفي أو لامع ضد الخدش والغسيل',
  },
  {
    id: 'pr-5',
    materialName: 'قماش كانفاس قطني فاخر (Canvas Cotton)',
    category: 'خامات عريضة',
    unit: 'متر مربع',
    sellingPrice: 95,
    costPrice: 42,
    minOrder: 1,
    notes: 'لوحات جدارية ديكورية مع شد على شاسيه خشب سويدي',
  },
  {
    id: 'pr-6',
    materialName: 'رول أب ستاند ألومنيوم (Roll-Up 85×200cm)',
    category: 'ستاندات ومعارض',
    unit: 'قطعة',
    sellingPrice: 150,
    costPrice: 75,
    minOrder: 1,
    notes: 'هيكل ألومنيوم ثقيل مع حقيبة قماشية وطباعة فيلم فاخر',
  },
  {
    id: 'pr-7',
    materialName: 'ستيكر مقصوص كتر بلوتر (Die-Cut Vinyl)',
    category: 'قص وتفريغ',
    unit: 'متر مربع',
    sellingPrice: 75,
    costPrice: 30,
    minOrder: 1,
    notes: 'تفريغ دقيق للشعارات والنصوص مع شريط ناقل شفاف',
  },
  {
    id: 'pr-8',
    materialName: 'كروت شخصية كوشيه 350 جرام (1000 كرت)',
    category: 'مطبوعات ورقية',
    unit: '1000 كرت',
    sellingPrice: 120,
    costPrice: 55,
    minOrder: 1,
    notes: 'طباعة وجهين ملونة مع سلوفان مطفي فاخر',
  },
  {
    id: 'pr-9',
    materialName: 'بروشورات وفلايرات A4 وجهين (1000 حبة)',
    category: 'مطبوعات ورقية',
    unit: '1000 حبة',
    sellingPrice: 450,
    costPrice: 220,
    minOrder: 1,
    notes: 'ورق كوشيه 150 جرام مع طي نصفي أو ثنائي',
  },
  {
    id: 'pr-10',
    materialName: 'أكريليك مقصوص ليزر 3 ملم (Acrylic)',
    category: 'قص ليزر وحروف',
    unit: 'متر مربع',
    sellingPrice: 220,
    costPrice: 110,
    minOrder: 1,
    notes: 'قص ليزر دقيق للحروف البارزة وشعارات المكاتب',
  },
  {
    id: 'pr-11',
    materialName: 'لوح فوم بورد 5 ملم مع طباعة لاصقة (Foam Board)',
    category: 'مطبوعات ورقية',
    unit: 'متر مربع',
    sellingPrice: 110,
    costPrice: 50,
    minOrder: 1,
    notes: 'لوحات معارض إرشادية وتثبيت بوسترات خفيفة الوزن',
  },
];
