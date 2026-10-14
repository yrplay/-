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
} from '../types';

export const LOCAL_STORAGE_KEY_QUOTATIONS = 'agency_quotations_data';

export function calculateDelayDays(deliveryDateStr: string, orderStatus: string): number | '' {
  if (!deliveryDateStr || orderStatus === 'تم التسليم' || orderStatus === 'ملغى') {
    return '';
  }
  const delivery = new Date(deliveryDateStr);
  const today = new Date();
  // reset hours for date-only comparison
  delivery.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (delivery < today) {
    const diffTime = today.getTime() - delivery.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return '';
}

export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  agencyName: 'وكالة الإبداع للدعاية والإعلان والمطبوعات',
  agencySubtitle: 'خدمات الطباعة الرقمية واللوحات الإعلانية والأوفست وستاندات المعارض',
  agencyCountry: 'المملكة العربية السعودية',
  agencyVatNumber: '310123456700003',
  showVatNumber: true,
  agencyPhone: '0501234567',
  agencyAddress: 'المملكة العربية السعودية',
  agencyLogoUrl: null,
  agencyStampUrl: null,
  invoiceFooterText: 'شكراً لتعاملكم معنا - نسعد دائماً بخدمتكم',
  showQrCode: true,
  customQrUrl: null,
  userProfile: {
    name: 'المالك والمدير العام',
    email: 'yr.play.com@gmail.com',
    role: 'مالك (Owner)',
    phone: '',
    avatarUrl: null,
  },
  collaborators: [],
};

export function computeSaleDerivedFields(item: Partial<SaleItem>, index: number): SaleItem {
  // Support multi-items or single item
  let items: SaleLineItem[] = [];
  let invoiceTotal = 0;

  if (item.items && item.items.length > 0) {
    items = item.items.map((it, i) => {
      const q = Number(it.quantity) || 0;
      const up = Number(it.unitPrice) || 0;
      return {
        id: it.id || `line-${i}-${Date.now()}`,
        serviceType: it.serviceType || '',
        specifications: it.specifications || '',
        quantity: q,
        unitType: it.unitType || '',
        unitPrice: up,
        itemTotal: q * up,
      };
    });
    invoiceTotal = items.reduce((sum, it) => sum + it.itemTotal, 0);
  } else {
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const singleTotal = qty * unitPrice;
    invoiceTotal = item.invoiceTotal !== undefined && item.invoiceTotal !== null
      ? Number(item.invoiceTotal)
      : singleTotal;
    items = [
      {
        id: `line-0-${Date.now()}`,
        serviceType: item.serviceType || '',
        specifications: item.specifications || '',
        quantity: qty,
        unitType: item.unitType || '',
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
  let discount = Math.max(0, Number(item.discount) || 0);
  let discountPercent = item.discountPercent !== undefined ? Number(item.discountPercent) : 0;

  if (discountType === 'percentage') {
    if (discountPercent > 0) {
      discount = Math.round(((invoiceTotal * discountPercent) / 100) * 100) / 100;
    } else {
      discount = 0;
    }
  } else if (invoiceTotal > 0 && discount > 0) {
    discountPercent = Math.round(((discount / invoiceTotal) * 100) * 10) / 10;
  }

  const isTaxInvoice = Boolean(item.isTaxInvoice);
  const taxRate = item.taxRate !== undefined ? Number(item.taxRate) : 15;
  const subtotalBeforeTax = Math.max(0, invoiceTotal - discount);
  const taxAmount = isTaxInvoice ? Math.round(subtotalBeforeTax * (taxRate / 100) * 100) / 100 : 0;
  const netTotal = isTaxInvoice ? subtotalBeforeTax + taxAmount : subtotalBeforeTax;

  const paidAmount = Number(item.paidAmount) || 0;
  const remainingAmount = Math.max(0, netTotal - paidAmount);

  let paymentStatus = '🔴 غير مسدد';
  if (remainingAmount === 0 && netTotal > 0) {
    paymentStatus = '✅ مسدد';
  } else if (paidAmount > 0 && remainingAmount > 0) {
    paymentStatus = '🟡 مسدد جزئي';
  } else if (remainingAmount === netTotal) {
    paymentStatus = '🔴 غير مسدد';
  }

  const currentYear = new Date().getFullYear();
  const invoiceNo = item.invoiceNo || `F-${currentYear}-${String(index + 1).padStart(3, '0')}`;
  const receiptDate = item.receiptDate || new Date().toISOString().split('T')[0];
  const delayDays = calculateDelayDays(item.deliveryDate || '', item.orderStatus || 'قيد التصميم');

  return {
    id: item.id || `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    invoiceNo,
    customerName: item.customerName || '',
    customerPhone: item.customerPhone || '',
    customerSource: item.customerSource || '',
    serviceType: items.length > 1 ? `${primaryItem.serviceType} (+${items.length - 1} خدمات)` : primaryItem.serviceType,
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
    remainingAmount,
    paymentStatus,
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
    customerVatNumber: item.customerVatNumber || '',
    agencyVatNumber: item.agencyVatNumber || DEFAULT_AGENCY_SETTINGS.agencyVatNumber,
    revenueSource: item.revenueSource || 'المحل المباشر',
    audit: item.audit,
  };
}

export function computePurchaseDerivedFields(item: Partial<PurchaseItem>): PurchaseItem {
  let items: PurchaseLineItem[] = [];
  let calculatedSubtotal = 0;

  if (item.items && item.items.length > 0) {
    items = item.items.map((it, i) => {
      const q = Number(it.quantity) || 0;
      const price = Number(it.purchasePrice) || 0;
      return {
        id: it.id || `pline-${i}-${Date.now()}`,
        item: it.item || '',
        unitType: it.unitType || '',
        quantity: q,
        purchasePrice: price,
        total: q * price,
        notes: it.notes || '',
      };
    });
    calculatedSubtotal = items.reduce((sum, it) => sum + it.total, 0);
  } else {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.purchasePrice) || 0;
    calculatedSubtotal = qty * price;
    items = [
      {
        id: `pline-0-${Date.now()}`,
        item: item.item || '',
        unitType: item.unitType || '',
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
  const taxRate = item.taxRate !== undefined ? Number(item.taxRate) : 15;
  const subtotalBeforeTax = Math.round(calculatedSubtotal * 100) / 100;
  const taxAmount = isTaxInvoice ? Math.round(subtotalBeforeTax * (taxRate / 100) * 100) / 100 : 0;
  const total = isTaxInvoice ? Math.round((subtotalBeforeTax + taxAmount) * 100) / 100 : subtotalBeforeTax;

  const paidAmount = Number(item.paidAmount) || 0;
  const remainingAmount = Math.max(0, Math.round((total - paidAmount) * 100) / 100);

  let paymentStatus = '🔴 غير مسدد';
  if (remainingAmount === 0 && total > 0) {
    paymentStatus = '✅ مسدد';
  } else if (paidAmount > 0 && remainingAmount > 0) {
    paymentStatus = '🟡 مسدد جزئي';
  } else if (remainingAmount === total) {
    paymentStatus = '🔴 غير مسدد';
  }

  return {
    id: item.id || `purch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    date: item.date || new Date().toISOString().split('T')[0],
    supplierInvoiceNo: item.supplierInvoiceNo || '',
    item: items.length > 1 ? `${primaryItem.item} (+${items.length - 1} أصناف)` : primaryItem.item,
    supplierType: item.supplierType || '',
    unitType: primaryItem.unitType || '',
    quantity: items.length > 1 ? items.reduce((s, it) => s + it.quantity, 0) : primaryItem.quantity,
    purchasePrice: primaryItem.purchasePrice || 0,
    subtotalBeforeTax,
    taxRate: isTaxInvoice ? taxRate : 0,
    taxAmount,
    isTaxInvoice,
    supplierVatNumber: item.supplierVatNumber || '',
    total,
    supplier: item.supplier || '',
    paymentMethod: item.paymentMethod || '',
    paidAmount,
    remainingAmount,
    paymentStatus,
    notes: item.notes || '',
    items,
    audit: item.audit,
  };
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
  inventory: InventoryItem[]
): DashboardMetrics {
  // Sales net totals
  const totalSales = sales.reduce((sum, item) => sum + (Number(item.netTotal) || 0), 0);
  // Purchases totals
  const totalPurchases = purchases.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  // Expenses amounts
  const totalExpenses = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // Net Profit = B2 - B3 - B4
  const netProfit = totalSales - totalPurchases - totalExpenses;

  // Receivables from customers = SUM(Sales!P:P)
  const customerReceivables = sales.reduce((sum, item) => sum + (Number(item.remainingAmount) || 0), 0);

  // Payables to suppliers = SUM(Purchases!K:K)
  const supplierPayables = purchases.reduce((sum, item) => sum + (Number(item.remainingAmount) || 0), 0);

  // Expected Cash Flow = netProfit + customerReceivables - supplierPayables (=B5+B6-B7)
  const expectedCashFlow = netProfit + customerReceivables - supplierPayables;

  // Unpaid invoices = COUNTIF(Sales!Q:Q, "🔴 غير مسدد")
  const unpaidInvoicesCount = sales.filter((s) => s.paymentStatus.includes('غير مسدد')).length;
  const partiallyPaidCount = sales.filter((s) => s.paymentStatus.includes('مسدد جزئي')).length;
  const paidCount = sales.filter((s) => s.paymentStatus.includes('✅')).length;

  const ordersInProgressCount = sales.filter(
    (s) => s.orderStatus !== 'تم التسليم' && s.orderStatus !== 'ملغى'
  ).length;

  const lowStockItemsCount = inventory.filter(
    (i) => i.status.includes('طلب شراء') || i.status.includes('منخفض')
  ).length;

  return {
    totalSales,
    totalPurchases,
    totalExpenses,
    netProfit,
    customerReceivables,
    supplierPayables,
    expectedCashFlow,
    unpaidInvoicesCount,
    partiallyPaidCount,
    paidCount,
    ordersInProgressCount,
    lowStockItemsCount,
  };
}

export const INITIAL_SALES: SaleItem[] = [
  computeSaleDerivedFields(
    {
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
      deliveryDate: '2026-09-18',
      orderStatus: 'قيد الطباعة',
      assignedTo: 'أحمد الخطاط',
      notes: 'التركيب مشمول بالعقد',
    },
    0
  ),
  computeSaleDerivedFields(
    {
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
      deliveryDate: '2026-09-15',
      orderStatus: 'جاهز للطباعة',
      assignedTo: 'سامر المصمم',
      notes: 'دفعة أولى 400 والباقي عند الاستلام',
    },
    1
  ),
  computeSaleDerivedFields(
    {
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
      deliveryDate: '2026-09-14',
      orderStatus: 'تم التسليم',
      assignedTo: 'مروان فني القص',
      notes: 'تم التسليم بالكامل',
    },
    2
  ),
  computeSaleDerivedFields(
    {
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
      deliveryDate: '2026-09-12',
      orderStatus: 'جاهز للتسليم',
      assignedTo: 'سعيد التجهيز',
      notes: 'فاتورة مؤجلة سداد نهاية الشهر',
    },
    3
  ),
];

export const INITIAL_PURCHASES: PurchaseItem[] = [
  computePurchaseDerivedFields({
    supplierInvoiceNo: 'SUP-4491',
    item: 'فينيل لاصق',
    unitType: 'رول',
    quantity: 4,
    purchasePrice: 190,
    supplier: 'مؤسسة خامات الإعلان الحديثة',
    paymentMethod: 'تحويل',
    paidAmount: 874,
    isTaxInvoice: true,
    supplierVatNumber: '310123456700003',
    notes: 'فاتورة ضريبية رسمية معتمدة',
  }),
  computePurchaseDerivedFields({
    supplierInvoiceNo: 'SUP-5020',
    item: 'حبر طابعة ليزر',
    unitType: 'علبة',
    quantity: 4,
    purchasePrice: 220,
    supplier: 'شركة تكنو برنت للمستلزمات',
    paymentMethod: 'آجل',
    paidAmount: 300,
    isTaxInvoice: false,
    notes: 'مشتريات بدون ضريبة (متجر محلي غير خاضع)',
  }),
  computePurchaseDerivedFields({
    supplierInvoiceNo: 'SUP-6112',
    item: 'ورق براق',
    unitType: 'رزمة',
    quantity: 10,
    purchasePrice: 45,
    supplier: 'مستودعات الخليج للورق',
    paymentMethod: 'شبكة',
    paidAmount: 517.5,
    isTaxInvoice: true,
    supplierVatNumber: '300998877600003',
  }),
];

export const INITIAL_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-1',
    date: '2026-09-01',
    expenseType: 'إيجار المقر',
    category: 'تشغيلية',
    amount: 3500,
    paymentMethod: 'تحويل',
    notes: 'دفعة إيجار شهر سبتمبر',
  },
  {
    id: 'exp-2',
    date: '2026-09-05',
    expenseType: 'فواتير الكهرباء',
    category: 'تشغيلية',
    amount: 480,
    paymentMethod: 'شبكة',
    notes: 'فاتورة استهلاك ماكينات الطباعة',
  },
  {
    id: 'exp-3',
    date: '2026-09-08',
    expenseType: 'صيانة معدات',
    category: 'تشغيلية',
    amount: 320,
    paymentMethod: 'كاش',
    notes: 'تغيير رؤوس تنظيف ماكينة الفينيل',
  },
  {
    id: 'exp-4',
    date: '2026-09-10',
    expenseType: 'إعلانات وتسويق',
    category: 'تسويقية',
    amount: 250,
    paymentMethod: 'شبكة',
    notes: 'حملة إعلانية ممولة انستقرام وسناب',
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
    status: computeInventoryStatus(12, 5),
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
    status: computeInventoryStatus(2, 3),
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
    status: computeInventoryStatus(45, 40),
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
    status: computeInventoryStatus(3, 10),
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
    status: computeInventoryStatus(25, 10),
    notes: 'كوشيه مطفي 300 جرام',
  },
];

export function computeQuotationDerivedFields(
  item: Partial<QuotationItem>,
  index: number
): QuotationItem {
  let items: QuotationLineItem[] = [];
  let subtotal = 0;

  if (item.items && item.items.length > 0) {
    items = item.items.map((it, i) => {
      const q = Number(it.quantity) || 0;
      const up = Number(it.unitPrice) || 0;
      const total = Number((q * up).toFixed(2));
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
    subtotal = items.reduce((sum, it) => sum + it.itemTotal, 0);
  } else {
    subtotal = Number(item.subtotal) || 0;
  }

  const discountType = item.discountType || 'amount';
  let discount = Math.max(0, Number(item.discount) || 0);
  let discountPercent = item.discountPercent !== undefined ? Number(item.discountPercent) : 0;

  if (discountType === 'percentage') {
    if (discountPercent > 0) {
      discount = Number(((subtotal * discountPercent) / 100).toFixed(2));
    } else {
      discount = 0;
    }
  } else if (subtotal > 0 && discount > 0) {
    discountPercent = Math.round(((discount / subtotal) * 100) * 10) / 10;
  }

  const netAfterDiscount = Math.max(0, subtotal - discount);

  const isTaxIncluded = Boolean(item.isTaxIncluded);
  const taxRate = 15;
  const taxAmount = isTaxIncluded ? Number((netAfterDiscount * 0.15).toFixed(2)) : 0;
  const netTotal = Number((netAfterDiscount + taxAmount).toFixed(2));

  const today = new Date().toISOString().split('T')[0];
  const issueDate = item.issueDate || today;
  
  // Validity days: completely optional and clearable
  const validityDays = item.validityDays !== undefined && item.validityDays !== '' && Number(item.validityDays) > 0
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

  const quotationNo =
    item.quotationNo || `QT-${new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`;

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
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(discount.toFixed(2)),
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

export function convertQuotationToSale(
  quotation: QuotationItem,
  currentSalesCount: number
): SaleItem {
  const today = new Date().toISOString().split('T')[0];
  const invoiceNo = `INV-${new Date().getFullYear()}-${String(currentSalesCount + 1).padStart(3, '0')}`;

  const saleLines: SaleLineItem[] = quotation.items.map((line, idx) => ({
    id: `line-${Date.now()}-${idx + 1}`,
    serviceType: line.serviceType,
    specifications: line.specifications,
    quantity: line.quantity,
    unitType: line.unitType,
    unitPrice: line.unitPrice,
    itemTotal: line.itemTotal,
  }));

  const primaryService = saleLines[0]?.serviceType || 'تنفيذ طلب معتمد من عرض سعر';
  const primarySpecs = saleLines.map((l) => `${l.serviceType}: ${l.specifications || ''}`).join(' | ');

  return {
    id: `sale-from-quote-${Date.now()}`,
    invoiceNo,
    customerName: quotation.customerName,
    customerPhone: quotation.customerPhone,
    customerSource: quotation.customerCompany ? `شركة: ${quotation.customerCompany}` : 'عرض سعر معتمد',
    serviceType: primaryService,
    specifications: primarySpecs,
    quantity: saleLines.reduce((s, it) => s + it.quantity, 0) || 1,
    unitType: saleLines[0]?.unitType || 'طلب',
    unitPrice: quotation.subtotal,
    itemTotal: quotation.subtotal,
    invoiceTotal: quotation.subtotal,
    discount: quotation.discount,
    discountType: quotation.discountType || 'amount',
    discountPercent: quotation.discountPercent,
    netTotal: quotation.netTotal,
    paymentMethod: 'تحويل بنكي',
    paidAmount: 0,
    remainingAmount: quotation.netTotal,
    paymentStatus: '🔴 غير مسدد',
    receiptDate: today,
    deliveryDate: '',
    orderStatus: 'قيد التنفيذ',
    assignedTo: '',
    delayDays: '',
    notes: `تم إنشاء الطلب بناءً على اعتماد عرض السعر رقم: ${quotation.quotationNo} بتاريخ ${quotation.issueDate}. ${quotation.notes || ''}`,
    items: saleLines,
    isTaxInvoice: quotation.isTaxIncluded,
    taxRate: quotation.taxRate || 15,
    taxAmount: quotation.taxAmount || 0,
    subtotalBeforeTax: quotation.subtotal - quotation.discount,
    customerVatNumber: quotation.customerVatNumber || '',
    revenueSource: quotation.revenueSource || 'المحل المباشر',
    audit: quotation.audit,
  };
}

export const INITIAL_QUOTATIONS: QuotationItem[] = [
  {
    id: 'quote-1',
    quotationNo: `QT-${new Date().getFullYear()}-001`,
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
    quotationNo: `QT-${new Date().getFullYear()}-002`,
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

export const LOCAL_STORAGE_KEY_VOUCHERS = 'adv_accounting_vouchers';
export const LOCAL_STORAGE_KEY_PRICE_LIST = 'adv_accounting_price_list';

export const INITIAL_VOUCHERS: VoucherItem[] = [
  {
    id: 'vouch-1',
    voucherNo: 'RC-1001',
    type: 'receipt',
    date: new Date().toISOString().split('T')[0],
    amount: 1500,
    amountInWords: 'ألف وخمسمائة ريال سعودي فقط لا غير',
    partyName: 'مؤسسة أفق التقنية للتجارة',
    partyPhone: '0551234567',
    paymentMethod: 'شبكة مدى',
    referenceNo: 'TXN-984210',
    relatedInvoiceNo: 'INV-1001',
    description: 'دفعة مقدمة لحساب تصميم وطباعة بنرات ولوحات إعلانية لمقر الفرع',
    receivedBy: 'أمين الصندوق',
    approvedBy: 'المدير المالي',
    notes: 'تم إيداع المبلغ في حساب نقاط البيع مدى.',
  },
  {
    id: 'vouch-2',
    voucherNo: 'PV-1001',
    type: 'payment',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    amount: 850,
    amountInWords: 'ثمانمائة وخمسون ريال سعودي فقط لا غير',
    partyName: 'شركة النجم لمواد وأحبار الطباعة',
    partyPhone: '0569876543',
    paymentMethod: 'تحويل بنكي',
    referenceNo: 'TR-77210',
    relatedInvoiceNo: 'SUP-401',
    description: 'سداد قيمة توريد رولات بنر واستيكر ألماني لاصق 50 متر',
    receivedBy: 'مندوب المورد',
    approvedBy: 'المدير العام',
    notes: 'تم التحويل من حساب الراجحي للشركة.',
  },
];

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


