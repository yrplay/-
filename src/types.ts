export type NavigationTab =
  | 'dashboard'
  | 'quotations'
  | 'sales'
  | 'returns'
  | 'vouchers'
  | 'purchases'
  | 'expenses'
  | 'inventory'
  | 'hr'
  | 'pricing';

export type QuotationStatus = 'بانتظار الاعتماد' | 'معتمد ومحول لطلب' | 'مرفوض' | 'منتهي الصلاحية';

export interface QuotationLineItem {
  id: string;
  serviceType: string;
  specifications: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  itemTotal: number;
}

export interface QuotationItem {
  id: string;
  quotationNo: string; // e.g. "QT-2026-0001"
  customerName: string;
  customerPhone?: string;
  customerCompany?: string;
  customerEmail?: string;
  customerVatNumber?: string;
  issueDate: string; // YYYY-MM-DD
  validityDays?: number | ''; // e.g. 15 or 30 days
  expiryDate?: string; // YYYY-MM-DD
  status: QuotationStatus;
  items: QuotationLineItem[];
  subtotal: number;
  discount: number;
  discountType?: 'amount' | 'percentage';
  discountPercent?: number;
  isTaxIncluded: boolean;
  taxRate?: number;
  taxAmount?: number;
  netTotal: number;
  paymentTerms?: string;
  executionDays?: string;
  notes?: string;
  includeCustomerApproval?: boolean;
  convertedSaleId?: string;
  convertedDate?: string;
  revenueSource?: string;
  audit?: AuditMeta;
}

export interface AuditMeta {
  createdByName?: string;
  createdByEmail?: string;
  createdAt?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  updatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  action:
    | 'إنشاء'
    | 'تعديل'
    | 'حذف'
    | 'اعتماد وتعميد'
    | 'إشعار دائن / مرتجع'
    | 'اعتماد مسير رواتب'
    | 'حركة مخزون'
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'CONVERT_TO_SALE'
    | 'RETURN'
    | 'PAYROLL'
    | 'STOCK_MOVEMENT';
  entity?: string;
  entityType?:
    | 'QUOTATION'
    | 'INVOICE'
    | 'PURCHASE'
    | 'EXPENSE'
    | 'INVENTORY'
    | 'VOUCHER'
    | 'RETURN'
    | 'HR'
    | 'SETTINGS'
    | string;
  entityId?: string;
  entityNumber?: string;
  customerOrSupplier?: string;
  userName: string;
  userEmail: string;
  userRole?: string;
  timestamp: string;
  details?: string;
  prevHash?: string;
  hash?: string;
}

export type UserRole = 'owner' | 'admin' | 'accountant' | 'sales' | 'warehouse' | 'editor' | 'viewer';

export type PaymentStatusCode = 'paid' | 'partial' | 'unpaid';

export interface MaterialConsumptionItem {
  inventoryId: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitCost?: number;
}

export interface SaleItem {
  id: string;
  invoiceNo: string; // A
  customerName: string; // B
  customerPhone: string; // C
  customerSource: string; // D
  serviceType: string; // E
  specifications: string; // F
  quantity: number; // G
  unitType: string; // H
  unitPrice: number; // I
  itemTotal: number; // J: G * I
  invoiceTotal: number; // K: gross total
  discount: number; // L
  discountType?: 'amount' | 'percentage';
  discountPercent?: number;
  netTotal: number; // M: K - L (+ tax if tax applied)
  paymentMethod: string; // N
  paidAmount: number; // O (initial/direct payment + settled vouchers)
  initialPaidAmount?: number; // المبلغ المدفوع مباشرة عند إصدار الفاتورة قبل سندات التسوية
  remainingAmount: number; // P: M - O - returnedAmount
  returnedAmount?: number; // إجمالي قيمة المرتجعات / إشعارات الدائن المرتبطة بهذه الفاتورة
  paymentStatus: string; // Q: "✅ مسدد" | "🟡 مسدد جزئي" | "🔴 غير مسدد"
  paymentStatusCode?: PaymentStatusCode;
  receiptDate: string; // R: YYYY-MM-DD
  deliveryDate: string; // S: YYYY-MM-DD
  orderStatus: string; // T
  assignedTo: string; // U
  delayDays: number | ''; // V
  notes: string; // W
  items?: SaleLineItem[];
  isTaxInvoice?: boolean;
  taxRate?: number;
  taxAmount?: number;
  subtotalBeforeTax?: number;
  customerVatNumber?: string;
  agencyVatNumber?: string;
  revenueSource?: string;
  deductFromInventory?: boolean;
  consumedMaterials?: MaterialConsumptionItem[];
  audit?: AuditMeta;
}

export interface SaleLineItem {
  id: string;
  serviceType: string;
  specifications: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  itemTotal: number;
  inventoryItemId?: string;
}

export type AppLanguage = 'ar' | 'en';

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatarUrl?: string | null;
  language?: AppLanguage;
  displayName?: string;
}

export type VoucherType = 'receipt' | 'payment';

export interface VoucherItem {
  id: string;
  voucherNo: string; // e.g. "RC-2026-0001" or "PV-2026-0001"
  type: VoucherType;
  date: string; // YYYY-MM-DD
  amount: number;
  amountInWords?: string;
  partyName: string;
  partyPhone?: string;
  paymentMethod: string;
  referenceNo?: string;
  relatedInvoiceNo?: string; // رقم الفاتورة المرتبطة (مبيعات أو مشتريات)
  relatedDocId?: string; // معرف الفاتورة المرتبطة (sale.id أو purchase.id)
  relatedDocType?: 'sale' | 'purchase' | 'return' | 'payroll';
  isInvoiceSettlement?: boolean;
  autoUpdatedInvoice?: boolean;
  description: string;
  receivedBy?: string;
  approvedBy?: string;
  notes?: string;
  audit?: AuditMeta;
}

// ==========================================
// نظام المرتجعات وإشعارات الدائن (Returns & Credit Notes)
// ==========================================
export type ReturnKind = 'sale_return' | 'purchase_return';
export type ReturnActionType = 'full' | 'partial' | 'exchange' | 'defect';

export interface ReturnLineItem {
  id: string;
  originalLineId?: string;
  itemName: string;
  specifications?: string;
  unitType: string;
  soldOrPurchasedQty: number;
  returnQty: number;
  unitPrice: number;
  lineTotal: number;
  restockInventoryId?: string;
  restockQty?: number;
}

export interface ReturnRecord {
  id: string;
  returnNo: string; // مثل CN-2026-0001 لإشعار الدائن أو PR-2026-0001 لمرتجع الشراء
  kind: ReturnKind; // sale_return (إشعار دائن مبيعات) أو purchase_return (مرتجع مشتريات)
  returnType: ReturnActionType; // كامل | جزئي | استبدال | تالف طباعة
  date: string; // YYYY-MM-DD
  originalDocId: string; // معرف الفاتورة الأصلية
  originalDocNo: string; // رقم الفاتورة الأصلية
  partyName: string; // اسم العميل أو المورد
  partyPhone?: string;
  partyVatNumber?: string;
  items: ReturnLineItem[];
  subtotalBeforeTax: number;
  isTaxIncluded: boolean;
  taxRate: number;
  taxAmount: number;
  totalRefundAmount: number; // الإجمالي شاملاً الضريبة
  refundMethod: 'cash_voucher' | 'account_deduction' | 'exchange_replacement';
  paymentMethod: string; // كاش / تحويل / شبكة
  generatedVoucherId?: string; // معرف سند الصرف/القبض الآلي إن وجد
  generatedVoucherNo?: string;
  restockToInventory: boolean; // هل يتم إرجاع/خصم الكمية من المخزون
  reason: string; // سبب الإرجاع (عيب طباعة، اختلاف مقاس، إلغاء جزء من الطلب...)
  notes?: string;
  audit?: AuditMeta;
}

// ==========================================
// حركات المخزون والهالك والتالف (Inventory Movements & Wastage)
// ==========================================
export type StockMovementType =
  | 'purchase_in' // توريد من فاتورة شراء
  | 'sale_out' // صرف لفاتورة مبيعات / إنتاج
  | 'sale_return_in' // إرجاع من مرتجع مبيعات
  | 'purchase_return_out' // خصم لمرتجع مشتريات للمورد
  | 'wastage_out' // هالك وتالف طباعة وقص
  | 'adjustment'; // تسوية جردية

export interface InventoryMovement {
  id: string;
  movementNo: string;
  date: string;
  inventoryId: string;
  itemName: string;
  unit: string;
  type: StockMovementType;
  quantityChange: number; // موجب للإضافة، سالب للخصم
  previousQty: number;
  newQty: number;
  unitCost?: number;
  totalCost?: number;
  referenceDocNo?: string;
  referenceDocId?: string;
  reason?: string;
  performedBy?: string;
}

// ==========================================
// الموارد البشرية والحضور ومسيرات الرواتب (HR, Attendance & Payroll)
// ==========================================
export type EmployeeStatus = 'نشط' | 'إجازة' | 'موقوف';
export type ContractSalaryType = 'monthly' | 'daily';

export interface EmployeeItem {
  id: string;
  employeeCode: string; // EMP-001
  name: string;
  jobTitle: string; // مصمم جرافيك، فني طباعة، فني تركيب، محاسب، مندوب مبيعات...
  department: string; // التصميم، الإنتاج والطباعة، التركيب، الإدارة، المبيعات
  phone: string;
  nationalIdOrIqama?: string;
  joinDate: string;
  salaryType: ContractSalaryType;
  baseSalary: number; // الراتب الأساسي الشهري أو الأجر اليومي
  housingAllowance: number; // بدل سكن
  transportAllowance: number; // بدل نقل
  otherAllowance: number; // بدلات أخرى
  workingDaysPerMonth: number; // افتراضياً 26 أو 30 يوماً
  dailyWorkHours: number; // افتراضياً 8 ساعات
  bankName?: string;
  iban?: string;
  status: EmployeeStatus;
  notes?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'excused';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string; // HH:mm
  checkOut?: string; // HH:mm
  workedHours: number;
  overtimeHours: number;
  lateMinutes: number;
  notes?: string;
}

export interface PayrollEmployeeLine {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  jobTitle: string;
  baseSalary: number;
  totalAllowances: number;
  presentDays: number;
  absentDays: number;
  lateMinutes: number;
  overtimeHours: number;
  absenceDeduction: number; // خصم الغياب والتأخير الآلي
  otherDeductions: number; // سلف أو جزاءات أخرى
  overtimePay: number; // مقابل الساعات الإضافية
  bonuses: number; // مكافآت وعمولات
  netSalary: number; // صافي الراتب المستحق
  notes?: string;
}

export interface PayrollRun {
  id: string;
  payrollNo: string; // PAY-2026-09
  month: string; // YYYY-MM
  issueDate: string;
  status: 'draft' | 'approved_paid';
  paymentMethod: string;
  lines: PayrollEmployeeLine[];
  totalBaseAndAllowances: number;
  totalDeductions: number;
  totalOvertimeAndBonuses: number;
  totalNetPayroll: number;
  generatedExpenseId?: string;
  generatedVoucherIds?: string[];
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  audit?: AuditMeta;
}

export interface PriceListItem {
  id: string;
  materialName: string;
  category: string;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  minOrder?: number;
  notes?: string;
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role:
    | 'مالك (Owner)'
    | 'مدير (Admin)'
    | 'محاسب (Accountant)'
    | 'مسوق ومندوب مبيعات (Sales Rep)'
    | 'أمين مستودع (Warehouse Keeper)'
    | 'محرر (Editor)'
    | 'مشاهد (Viewer)'
    | 'مخصص (Custom)';
  customPermissions?: NavigationTab[];
  addedAt: string;
  status: 'نشط' | 'دعوة معلقة';
}

export interface PartyRecord {
  id: string;
  name: string;
  type: 'customer' | 'supplier' | 'both';
  phone: string;
  company?: string;
  vatNumber?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface AgencySettings {
  agencyName: string;
  agencySubtitle: string;
  appShortName?: string;
  agencyCountry?: string;
  agencyVatNumber: string;
  showVatNumber?: boolean;
  defaultTaxRate?: number; // نسبة الضريبة الافتراضية القابلة للتعديل (مثلاً 15%)
  agencyPhone: string;
  agencyAddress: string;
  agencyLogoUrl: string | null;
  agencyStampUrl?: string | null;
  invoiceFooterText?: string;
  showQrCode?: boolean;
  customQrUrl?: string | null;
  invoiceLockApproved?: boolean;
  userProfile?: UserProfile;
  collaborators?: Collaborator[];
  ownerEmail?: string;
  priceList?: PriceListItem[];
  parties?: PartyRecord[];
  appLanguage?: AppLanguage;
}

export const REVENUE_SOURCES = [
  'المحل / المعرض',
  'المتجر الإلكتروني',
  'مندوب مبيعات',
  'وسائل تواصل اجتماعي',
  'واتساب',
  'عميل مباشر',
  'أخرى',
] as const;

export interface PurchaseLineItem {
  id: string;
  item: string;
  unitType: string;
  quantity: number;
  purchasePrice: number;
  total: number;
  notes?: string;
  inventoryItemId?: string;
}

export interface PurchaseItem {
  id: string;
  date: string; // A
  supplierInvoiceNo: string; // B
  item: string; // C
  unitType: string; // D
  quantity: number; // E
  purchasePrice: number; // F
  total: number; // G: E * F (or total with tax)
  supplier: string; // H
  supplierType?: string;
  paymentMethod: string; // I
  paidAmount: number; // J
  initialPaidAmount?: number;
  remainingAmount: number; // K: G - J - returnedAmount
  returnedAmount?: number;
  paymentStatus: string; // L: "✅ مسدد" | "🟡 مسدد جزئي" | "🔴 غير مسدد"
  paymentStatusCode?: PaymentStatusCode;
  notes?: string;
  items?: PurchaseLineItem[];
  isTaxInvoice?: boolean;
  taxRate?: number;
  taxAmount?: number;
  subtotalBeforeTax?: number;
  supplierVatNumber?: string;
  addToInventory?: boolean;
  audit?: AuditMeta;
}

export interface ExpenseItem {
  id: string;
  date: string; // A
  expenseType: string; // B
  category: string; // C
  amount: number; // D
  paymentMethod: string; // E
  notes: string; // F
  relatedPayrollId?: string;
}

export interface InventoryItem {
  id: string;
  item: string; // A
  type: string; // B
  color: string; // C
  unit: string; // D
  currentQty: number; // E
  minQty: number; // F
  unitCost?: number; // متوسط تكلفة الوحدة لاحتساب الهالك وتكلفة الخامات المستهلكة
  status: string; // G: "🛒 طلب شراء" | "🟡 منخفض" | "🟢 كافي"
  statusCode?: 'reorder' | 'low' | 'ok';
  notes: string; // H
}

export interface DashboardMetrics {
  totalSales: number; // إجمالي المبيعات قبل المرتجعات
  totalSaleReturns: number; // إجمالي مرتجعات المبيعات (إشعارات الدائن)
  netSalesAfterReturns: number; // صافي المبيعات الفعلي
  totalPurchases: number; // إجمالي المشتريات
  totalPurchaseReturns: number; // إجمالي مرتجعات المشتريات
  netPurchasesAfterReturns: number; // صافي المشتريات الفعلي
  totalExpenses: number; // إجمالي المصروفات التشغيلية (بما فيها الرواتب المعتمدة)
  wastageCost: number; // تكلفة الهالك والتالف من الخامات
  netProfit: number; // صافي الربح الدقيق
  customerReceivables: number; // المستحقات الفعلية من العملاء
  supplierPayables: number; // المستحقات الفعلية للموردين
  expectedCashFlow: number; // التدفق النقدي المتوقع
  unpaidInvoicesCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  ordersInProgressCount: number;
  lowStockItemsCount: number;
  outputVatTotal?: number; // ضريبة المخرجات بعد خصم إشعارات الدائن
  inputVatTotal?: number; // ضريبة المدخلات بعد خصم مرتجعات المشتريات
  netVatPayable?: number; // صافي الضريبة المستحقة للهيئة
}

// Dropdown constants
export const CUSTOMER_SOURCES = [
  'عميل مباشر',
  'توصية',
  'وسائل تواصل',
  'عميل سابق',
  'أخرى',
] as const;

export const SERVICE_TYPES = [
  'تصميم جرافيك',
  'طباعة ملصقات',
  'طباعة بروشورات',
  'بطاقات عمل',
  'لافتات فينيل',
  'ستاندات عرض',
  'طباعة فنيل',
  'تركيب',
  'استشارة',
  'أخرى',
] as const;

export const SALES_UNIT_TYPES = [
  'متر',
  'قطعة',
  'ساعة',
  'تصميم',
  'رول',
  'مجموعة',
] as const;

export const SALES_PAYMENT_METHODS = [
  'كاش',
  'شبكة',
  'تحويل',
  'آجل',
  'جزء كاش وباقي آجل',
] as const;

export const ORDER_STATUSES = [
  'بانتظار التفاصيل',
  'قيد التصميم',
  'جاهز للطباعة',
  'قيد الطباعة',
  'جاهز للتركيب',
  'قيد التركيب',
  'جاهز للتسليم',
  'تم التسليم',
  'ملغى',
] as const;

export const SUPPLIER_TYPES = [
  'مورد خامات ومستلزمات',
  'مورد خدمات وتنفيذ خارجي',
  'مورد عام',
  'أخرى',
] as const;

export const PURCHASE_ITEMS = [
  'ورق A4',
  'ورق كوشيه',
  'فينيل لاصق',
  'فينيل غير لاصق',
  'أحبار طابعات',
  'استيكر فينيل',
  'بانر وفلكس',
  'ألواح أكريليك',
  'ألواح فوم وبلاستيك',
  'كلادينج وألمنيوم',
  'مواد لاصقة وتثبيت',
  'قص وتشكيل ليزر',
  'تفريز وحفر سي إن سي (CNC)',
  'تشكيل وتطعيج نيون LED',
  'قص وتطعيج أكريليك',
  'طباعة أوفست كميات كبرى',
  'تجليد وسلفنة حرارية',
  'فريق تركيب خارجي',
  'أخرى',
] as const;

export const PURCHASE_UNIT_TYPES = [
  'متر',
  'رول',
  'علبة',
  'كيلو',
  'لتر',
  'قطعة',
  'رزمة',
  'طابعة',
] as const;

export const PURCHASE_PAYMENT_METHODS = [
  'كاش',
  'شبكة',
  'تحويل',
  'آجل',
] as const;

export const EXPENSE_TYPES = [
  'إيجار المقر',
  'فواتير الكهرباء',
  'فواتير المياه',
  'فواتير الإنترنت',
  'رواتب موظفين',
  'صيانة معدات',
  'مواصلات',
  'مواد مكتبية',
  'إعلانات وتسويق',
  'أخرى',
] as const;

export const EXPENSE_CATEGORIES = [
  'تشغيلية',
  'إدارية',
  'تسويقية',
  'رواتب وأجور',
  'طارئة',
] as const;

export const EXPENSE_PAYMENT_METHODS = [
  'كاش',
  'شبكة',
  'تحويل',
] as const;

export const INVENTORY_ITEMS = [
  'فينيل',
  'استيكر',
  'بانر',
  'ورق طباعة',
  'حبر',
  'لافتات PVC',
  'مواد لاصقة',
  'مستلزمات طباعة',
  'أخرى',
] as const;

export const INVENTORY_SUBTYPES = [
  'لاصق',
  'غير لاصق',
  'عاكس',
  'مات',
  'لامع',
  'قابل للإزالة',
  'مقاوم للماء',
  'عادي',
] as const;

export const INVENTORY_COLORS = [
  'أبيض',
  'أسود',
  'شفاف',
  'فضي',
  'ذهبي',
  'أزرق',
  'أحمر',
  'أخضر',
  'متعدد الألوان',
  'أخرى',
] as const;

export const INVENTORY_UNITS = [
  'رول',
  'متر',
  'لوح',
  'علبة',
  'لتر',
  'كيلو',
  'قطعة',
  'رزمة',
] as const;
