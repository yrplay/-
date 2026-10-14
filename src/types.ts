export type NavigationTab =
  | 'dashboard'
  | 'quotations'
  | 'sales'
  | 'vouchers'
  | 'purchases'
  | 'expenses'
  | 'inventory'
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
  quotationNo: string; // e.g. "QT-1001"
  customerName: string;
  customerPhone?: string;
  customerCompany?: string;
  customerEmail?: string;
  customerVatNumber?: string;
  issueDate: string; // YYYY-MM-DD
  validityDays?: number | ''; // e.g. 15 or 30 days (اختياري وقابل للحذف)
  expiryDate?: string; // YYYY-MM-DD
  status: QuotationStatus;
  items: QuotationLineItem[];
  subtotal: number;
  discount: number;
  discountType?: 'amount' | 'percentage'; // نوع الخصم: مبلغ محدد أو نسبة مئوية
  discountPercent?: number; // النسبة المئوية إذا تم اختيار نسبة
  isTaxIncluded: boolean; // هل تشمل الضريبة
  taxRate?: number;
  taxAmount?: number;
  netTotal: number;
  paymentTerms?: string; // شروط الدفع، مثلاً 50% مقدم و50% عند الاستلام
  executionDays?: string; // مدة التنفيذ بعد الاعتماد
  notes?: string;
  includeCustomerApproval?: boolean; // بند الاعتماد والتعميد اختياري يحدده المستخدم
  convertedSaleId?: string; // معرف الفاتورة إذا تم اعتماده
  convertedDate?: string;
  revenueSource?: string; // جهة الدخل / قناة المبيعات (المحل، المتجر، المندوب، وسائل التواصل...)
  audit?: AuditMeta; // سجل المنشئ والتعديل
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
  action: 'إنشاء' | 'تعديل' | 'حذف' | 'اعتماد وتعميد' | 'CREATE' | 'UPDATE' | 'DELETE' | 'CONVERT_TO_SALE';
  entity?: 'فاتورة مبيعات' | 'عرض سعر' | 'مشتريات' | 'مصروفات' | 'مخزون' | 'إعدادات' | string;
  entityType?: 'QUOTATION' | 'INVOICE' | 'PURCHASE' | 'EXPENSE' | 'INVENTORY' | 'SETTINGS' | string;
  entityId?: string;
  entityNumber?: string;
  customerOrSupplier?: string;
  userName: string;
  userEmail: string;
  userRole?: string;
  timestamp: string;
  details?: string;
}

export type UserRole = 'owner' | 'admin' | 'accountant' | 'sales' | 'warehouse' | 'editor' | 'viewer';

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
  discountType?: 'amount' | 'percentage'; // نوع الخصم: مبلغ محدد أو نسبة مئوية
  discountPercent?: number; // النسبة المئوية إذا تم اختيار نسبة
  netTotal: number; // M: K - L (or K - L + tax if tax applied)
  paymentMethod: string; // N
  paidAmount: number; // O
  remainingAmount: number; // P: M - O
  paymentStatus: string; // Q: "✅ مسدد" | "🟡 مسدد جزئي" | "🔴 غير مسدد"
  receiptDate: string; // R: YYYY-MM-DD
  deliveryDate: string; // S: YYYY-MM-DD
  orderStatus: string; // T
  assignedTo: string; // U
  delayDays: number | ''; // V
  notes: string; // W
  // Optional Multi-items support
  items?: SaleLineItem[];
  // Optional Tax fields (فقط عند طلب العميل فاتورة ضريبية)
  isTaxInvoice?: boolean;
  taxRate?: number; // e.g. 15% (default 15)
  taxAmount?: number; // Net before tax * 15% or invoice total * 15%
  subtotalBeforeTax?: number;
  customerVatNumber?: string; // الرقم الضريبي للعميل
  agencyVatNumber?: string; // الرقم الضريبي للوكالة/المحل
  revenueSource?: string; // جهة الدخل / قناة البيع
  audit?: AuditMeta; // تتبع الإنشاء والتعديل
}

export interface SaleLineItem {
  id: string;
  serviceType: string;
  specifications: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  itemTotal: number;
}

export type AppLanguage = 'ar' | 'en';

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatarUrl?: string | null; // شعار أو صورة الموظف الخاصة
  language?: AppLanguage; // لغة واجهة الموظف المفضلة (عربي أو إنجليزي)
}

export type VoucherType = 'receipt' | 'payment'; // سند قبض (استلام) أو سند صرف (دفع)

export interface VoucherItem {
  id: string;
  voucherNo: string; // e.g. "RC-1001" or "PV-1001"
  type: VoucherType;
  date: string; // YYYY-MM-DD
  amount: number;
  amountInWords?: string; // تفقيط المبلغ بالكلمات
  partyName: string; // اسم العميل أو المورد أو المستلم
  partyPhone?: string;
  paymentMethod: string; // كاش نقدي / تحويل بنكي / شبكة مدى / شيك
  referenceNo?: string; // رقم الشيك / رقم الحوالة / رقم المرجع
  relatedInvoiceNo?: string; // رقم الفاتورة المرتبطة إن وجدت
  isInvoiceSettlement?: boolean; // تسوية دفعة لفاتورة مبيعات - لمنع تكرار الاحتساب في الخزينة والصندوق
  autoUpdatedInvoice?: boolean; // هل تم تحديث الفاتورة تلقائياً عند حفظ السند
  description: string; // البيان: وذلك عن...
  receivedBy?: string; // المستلم / أمين الصندوق
  approvedBy?: string; // المعتمد / المدير
  notes?: string;
  audit?: AuditMeta;
}

export interface PriceListItem {
  id: string;
  materialName: string; // اسم الخامة أو الخدمة (بنر، فليكس، ستيكر، كانفاس...)
  category: string; // خامات عريضة / مطبوعات رقمية / ليزر وأكريليك / خدمات
  unit: string; // متر مربع / متر طولي / قطعة / كرتون
  sellingPrice: number; // سعر البيع للعميل
  costPrice: number; // التكلفة التقريبية
  minOrder?: number; // الحد الأدنى للطلب
  notes?: string; // ملاحظات أو دقة
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
  customPermissions?: ('dashboard' | 'quotations' | 'sales' | 'purchases' | 'expenses' | 'inventory' | 'vouchers' | 'pricing')[];
  addedAt: string;
  status: 'نشط' | 'دعوة معلقة';
}

export interface AgencySettings {
  agencyName: string;
  agencySubtitle: string;
  appShortName?: string; // الاسم المختصر عند التثبيت في الجوال أو سطح المكتب
  agencyCountry?: string; // الدولة / المنطقة (المملكة العربية السعودية، قابلة للتعديل أو الإخفاء)
  agencyVatNumber: string;
  showVatNumber?: boolean; // خيار إظهار أو إخفاء الرقم الضريبي في المطبوعات والفواتير العادية
  agencyPhone: string;
  agencyAddress: string;
  agencyLogoUrl: string | null; // data URL or image link
  agencyStampUrl?: string | null; // صورة ختم المحل / المؤسسة
  invoiceFooterText?: string; // تذييل أسفل الفاتورة (شروط أو شكر)
  showQrCode?: boolean; // إظهار كود QR في الفواتير وعروض الأسعار
  customQrUrl?: string | null; // صورة أو رابط QR مخصص
  invoiceLockApproved?: boolean; // قفل الفواتير بعد السداد والاعتماد
  userProfile?: UserProfile;
  collaborators?: Collaborator[];
  ownerEmail?: string; // البريد الإلكتروني للمالك الأساسي للنظام
  priceList?: PriceListItem[]; // قائمة أسعار الوكالة
  appLanguage?: AppLanguage; // لغة النظام الافتراضية
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
  supplierType?: string; // مورد خامات أو مورد خدمات وتنفيذ
  paymentMethod: string; // I
  paidAmount: number; // J
  remainingAmount: number; // K: G - J
  paymentStatus: string; // L: "✅ مسدد" | "🟡 مسدد جزئي" | "🔴 غير مسدد"
  notes?: string; // خانة ملاحظات مع كل مشترى
  items?: PurchaseLineItem[]; // دعم إضافة أكثر من منتج/خدمة عند الشراء من مورد واحد
  // Tax fields (مع ضريبة 15% أو بدون ضريبة 0%)
  isTaxInvoice?: boolean;
  taxRate?: number; // e.g. 15%
  taxAmount?: number; // قيمة الضريبة
  subtotalBeforeTax?: number; // الإجمالي قبل الضريبة
  supplierVatNumber?: string; // الرقم الضريبي للمورد
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
}

export interface InventoryItem {
  id: string;
  item: string; // A
  type: string; // B
  color: string; // C
  unit: string; // D
  currentQty: number; // E
  minQty: number; // F
  status: string; // G: "🛒 طلب شراء" | "🟡 منخفض" | "🟢 كافي"
  notes: string; // H
}

export interface DashboardMetrics {
  totalSales: number; // إجمالي المبيعات
  totalPurchases: number; // إجمالي المشتريات
  totalExpenses: number; // إجمالي المصروفات
  netProfit: number; // صافي الربح
  customerReceivables: number; // المستحقات من العملاء
  supplierPayables: number; // المستحقات للموردين
  expectedCashFlow: number; // التدفق النقدي المتوقع
  unpaidInvoicesCount: number; // فواتير غير مسددة
  partiallyPaidCount: number;
  paidCount: number;
  ordersInProgressCount: number;
  lowStockItemsCount: number;
}

// Dropdown constants required by prompt
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
  // خامات
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
  // خدمات وتنفيذ خارجي
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
