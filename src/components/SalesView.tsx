import React, { useState } from 'react';
import {
  Search,
  Plus,
  Printer,
  Trash2,
  Edit,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  FileCheck2,
  Receipt,
  ChevronDown,
  ChevronUp,
  PackagePlus,
  Lock,
  History,
  Eye,
  EyeOff,
  ArrowUpDown,
  X,
} from 'lucide-react';
import {
  SaleItem,
  SaleLineItem,
  AgencySettings,
  UserRole,
  CUSTOMER_SOURCES,
  SERVICE_TYPES,
  SALES_UNIT_TYPES,
  SALES_PAYMENT_METHODS,
  ORDER_STATUSES,
} from '../types';
import { computeSaleDerivedFields, DEFAULT_AGENCY_SETTINGS } from '../lib/dataStore';
import { EditableSelect } from './EditableSelect';
import { AuditTimelineModal } from './AuditTimelineModal';
import { DateFilterBar } from './DateFilterBar';
import {
  DateFilterPreset,
  computeDateRange,
  isDateWithinRange,
  extractAvailableMonths,
} from '../lib/dateFilterUtils';
import {
  matchesPaymentMethodFilter,
  getPaymentMethodDetails,
  normalizePaymentMethod,
} from '../lib/paymentUtils';
import { getTranslations } from '../lib/translations';

interface SalesViewProps {
  sales: SaleItem[];
  agencySettings?: AgencySettings;
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  onAddSale: (sale: SaleItem) => void;
  onUpdateSale: (sale: SaleItem) => void;
  onDeleteSale: (id: string) => void;
  onPrintInvoice: (sale: SaleItem) => void;
  onIssueReceiptVoucher?: (sale: SaleItem) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  sales,
  agencySettings = DEFAULT_AGENCY_SETTINGS,
  userRole = 'owner',
  currentLang = (agencySettings.userProfile?.language || agencySettings.appLanguage || 'ar') as 'ar' | 'en',
  onAddSale,
  onUpdateSale,
  onDeleteSale,
  onPrintInvoice,
  onIssueReceiptVoucher,
  isModalOpen,
  setIsModalOpen,
}) => {
  const t = getTranslations(currentLang);
  const isEn = currentLang === 'en';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterTax, setFilterTax] = useState<string>('ALL');
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [editingSale, setEditingSale] = useState<SaleItem | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [selectedSaleForTimeline, setSelectedSaleForTimeline] = useState<SaleItem | null>(null);
  const [showAllTimelineModal, setShowAllTimelineModal] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'AMOUNT_ASC' | 'CUSTOMER_ASC'>('NEWEST');
  const [showSummaries, setShowSummaries] = useState<boolean>(() => {
    return localStorage.getItem('sales_show_summaries') !== 'false';
  });

  // Date Filtering State
  const [filterPreset, setFilterPreset] = useState<DateFilterPreset>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Available months from actual sales data
  const availableMonths = React.useMemo(() => {
    return extractAvailableMonths(sales.map((s) => s.receiptDate));
  }, [sales]);

  // Compute effective date boundaries and label
  const { startDate, endDate, filterLabel } = React.useMemo(() => {
    return computeDateRange(
      filterPreset,
      selectedMonth,
      selectedDate,
      customStartDate,
      customEndDate
    );
  }, [filterPreset, selectedMonth, selectedDate, customStartDate, customEndDate]);

  // Available sales channels
  const availableChannels = React.useMemo(() => {
    const set = new Set<string>();
    ['المحل المباشر', 'المتجر الإلكتروني', 'مندوب / مسوق', 'سوشل ميديا (واتساب/إنستغرام)'].forEach((c) =>
      set.add(c)
    );
    sales.forEach((s) => {
      if (s.revenueSource && s.revenueSource.trim()) {
        set.add(s.revenueSource.trim());
      }
    });
    return Array.from(set);
  }, [sales]);

  // Form State with Multi-items Support
  const [formData, setFormData] = useState<Partial<SaleItem>>({
    customerName: '',
    customerPhone: '',
    customerSource: 'عميل مباشر',
    customerVatNumber: '',
    serviceType: 'تصميم جرافيك',
    specifications: '',
    quantity: 1,
    unitType: 'قطعة',
    unitPrice: 150,
    invoiceTotal: 150,
    discount: 0,
    paymentMethod: 'شبكة',
    paidAmount: 150,
    isTaxInvoice: false,
    taxRate: 15,
    agencyVatNumber: agencySettings?.agencyVatNumber || '310123456700003',
    receiptDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    orderStatus: 'قيد التصميم',
    assignedTo: 'فني الطباعة',
    notes: '',
    items: [
      {
        id: 'line-1',
        serviceType: 'تصميم جرافيك',
        specifications: '',
        quantity: 1,
        unitType: 'قطعة',
        unitPrice: 150,
        itemTotal: 150,
      },
    ],
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingSale(null);
    setFormData({
      customerName: '',
      customerPhone: '',
      customerSource: '',
      customerVatNumber: '',
      revenueSource: 'المحل المباشر',
      serviceType: '',
      specifications: '',
      quantity: 0,
      unitType: '',
      unitPrice: 0,
      invoiceTotal: 0,
      discount: 0,
      discountType: 'amount',
      discountPercent: 0,
      paymentMethod: '',
      paidAmount: 0,
      isTaxInvoice: false,
      taxRate: 15,
      agencyVatNumber: agencySettings?.agencyVatNumber || '',
      receiptDate: new Date().toISOString().split('T')[0],
      deliveryDate: '',
      orderStatus: '',
      assignedTo: '',
      notes: '',
      items: [
        {
          id: `line-${Date.now()}`,
          serviceType: '',
          specifications: '',
          quantity: 0,
          unitType: '',
          unitPrice: 0,
          itemTotal: 0,
        },
      ],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (sale: SaleItem) => {
    setEditingSale(sale);
    const existingItems: SaleLineItem[] =
      sale.items && sale.items.length > 0
        ? sale.items
        : [
            {
              id: `line-${Date.now()}`,
              serviceType: sale.serviceType,
              specifications: sale.specifications,
              quantity: sale.quantity,
              unitType: sale.unitType,
              unitPrice: sale.unitPrice,
              itemTotal: sale.itemTotal || sale.invoiceTotal,
            },
          ];

    setFormData({
      ...sale,
      items: existingItems,
    });
    setIsModalOpen(true);
  };

  // Helper to update line item in multi-item form
  const handleUpdateLineItem = (index: number, updatedFields: Partial<SaleLineItem>) => {
    const currentLines = [...(formData.items || [])];
    const target = currentLines[index];
    if (!target) return;

    const newQuantity =
      updatedFields.quantity !== undefined ? Number(updatedFields.quantity) || 0 : target.quantity;
    const newPrice =
      updatedFields.unitPrice !== undefined
        ? Number(updatedFields.unitPrice) || 0
        : target.unitPrice;

    currentLines[index] = {
      ...target,
      ...updatedFields,
      quantity: newQuantity,
      unitPrice: newPrice,
      itemTotal: newQuantity * newPrice,
    };

    const newInvoiceTotal = currentLines.reduce((sum, it) => sum + it.itemTotal, 0);

    setFormData({
      ...formData,
      items: currentLines,
      invoiceTotal: newInvoiceTotal,
      paidAmount: formData.paidAmount !== undefined ? formData.paidAmount : newInvoiceTotal,
    });
  };

  const handleAddLineItem = () => {
    const currentLines = [...(formData.items || [])];
    const newLine: SaleLineItem = {
      id: `line-${Date.now()}-${currentLines.length + 1}`,
      serviceType: '',
      specifications: '',
      quantity: 0,
      unitType: '',
      unitPrice: 0,
      itemTotal: 0,
    };
    const updated = [...currentLines, newLine];
    const newInvoiceTotal = updated.reduce((sum, it) => sum + it.itemTotal, 0);
    setFormData({
      ...formData,
      items: updated,
      invoiceTotal: newInvoiceTotal,
    });
  };

  const handleRemoveLineItem = (index: number) => {
    const currentLines = [...(formData.items || [])];
    if (currentLines.length <= 1) return;
    currentLines.splice(index, 1);
    const newInvoiceTotal = currentLines.reduce((sum, it) => sum + it.itemTotal, 0);
    setFormData({
      ...formData,
      items: currentLines,
      invoiceTotal: newInvoiceTotal,
    });
  };

  // Live calculation for preview inside form
  const livePreview = computeSaleDerivedFields(
    formData,
    editingSale ? sales.findIndex((s) => s.id === editingSale.id) : sales.length
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) {
      alert('يرجى إدخال اسم العميل');
      return;
    }

    const existingNos = sales.map((s) => s.invoiceNo);
    if (editingSale) {
      const updated = computeSaleDerivedFields(
        { ...formData, id: editingSale.id, invoiceNo: editingSale.invoiceNo },
        sales.findIndex((s) => s.id === editingSale.id),
        existingNos
      );
      onUpdateSale(updated);
    } else {
      const newSale = computeSaleDerivedFields(formData, sales.length, existingNos);
      onAddSale(newSale);
    }
    setIsModalOpen(false);
  };

  // Sales matching the current date range & channel (used for accurate breakdown)
  const periodSales = React.useMemo(() => {
    return sales.filter((item) => {
      const matchesChannel = filterChannel === 'ALL' || (item.revenueSource || '') === filterChannel;
      const matchesDate = isDateWithinRange(item.receiptDate, startDate, endDate);
      return matchesChannel && matchesDate;
    });
  }, [sales, filterChannel, startDate, endDate]);

  // Payment methods breakdown in current period
  const paymentMethodBreakdown = React.useMemo(() => {
    let cashPaid = 0;
    let cashTotal = 0;
    let cashCount = 0;

    let networkPaid = 0;
    let networkTotal = 0;
    let networkCount = 0;

    let transferPaid = 0;
    let transferTotal = 0;
    let transferCount = 0;

    let deferredRemaining = 0;
    let deferredTotal = 0;
    let deferredCount = 0;

    periodSales.forEach((s) => {
      const cat = normalizePaymentMethod(s.paymentMethod);
      const paid = s.paidAmount || 0;
      const net = s.netTotal || 0;

      if (cat === 'CASH') {
        cashPaid += paid;
        cashTotal += net;
        cashCount++;
      } else if (cat === 'NETWORK') {
        networkPaid += paid;
        networkTotal += net;
        networkCount++;
      } else if (cat === 'TRANSFER') {
        transferPaid += paid;
        transferTotal += net;
        transferCount++;
      } else if (cat === 'DEFERRED') {
        deferredTotal += net;
        deferredCount++;
      }

      if (s.remainingAmount > 0) {
        deferredRemaining += s.remainingAmount;
        if (cat !== 'DEFERRED') {
          deferredCount++;
        }
      }
    });

    return {
      cashPaid,
      cashTotal,
      cashCount,
      networkPaid,
      networkTotal,
      networkCount,
      transferPaid,
      transferTotal,
      transferCount,
      deferredRemaining,
      deferredTotal,
      deferredCount,
    };
  }, [periodSales]);

  // Filter & Sort logic
  const filteredSales = React.useMemo(() => {
    const list = sales.filter((item) => {
      const matchesSearch =
        (item.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customerPhone || '').includes(searchTerm) ||
        (item.invoiceNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.serviceType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPayment =
        filterPayment === 'ALL' ||
        (filterPayment === 'PAID' && item.paymentStatus.includes('✅')) ||
        (filterPayment === 'PARTIAL' && item.paymentStatus.includes('🟡')) ||
        (filterPayment === 'UNPAID' && item.paymentStatus.includes('🔴'));

      const matchesPaymentMethod = matchesPaymentMethodFilter(item.paymentMethod, filterPaymentMethod);

      const matchesStatus = filterStatus === 'ALL' || item.orderStatus === filterStatus;
      const matchesTax =
        filterTax === 'ALL' ||
        (filterTax === 'TAX' && item.isTaxInvoice) ||
        (filterTax === 'STANDARD' && !item.isTaxInvoice);

      const matchesChannel = filterChannel === 'ALL' || (item.revenueSource || '') === filterChannel;
      const matchesDate = isDateWithinRange(item.receiptDate, startDate, endDate);

      return matchesSearch && matchesPayment && matchesPaymentMethod && matchesStatus && matchesTax && matchesChannel && matchesDate;
    });

    return list.sort((a, b) => {
      if (sortBy === 'NEWEST') {
        const d = new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime();
        if (d !== 0) return d;
        return (b.invoiceNo || '').localeCompare(a.invoiceNo || '');
      }
      if (sortBy === 'OLDEST') {
        const d = new Date(a.receiptDate).getTime() - new Date(b.receiptDate).getTime();
        if (d !== 0) return d;
        return (a.invoiceNo || '').localeCompare(b.invoiceNo || '');
      }
      if (sortBy === 'AMOUNT_DESC') {
        return (b.netTotal || 0) - (a.netTotal || 0);
      }
      if (sortBy === 'AMOUNT_ASC') {
        return (a.netTotal || 0) - (b.netTotal || 0);
      }
      if (sortBy === 'CUSTOMER_ASC') {
        return (a.customerName || '').localeCompare(b.customerName || '', 'ar');
      }
      return 0;
    });
  }, [
    sales,
    searchTerm,
    filterPayment,
    filterPaymentMethod,
    filterStatus,
    filterTax,
    filterChannel,
    startDate,
    endDate,
    sortBy,
  ]);

  // Period totals calculation for the selected period & channel
  const periodTotals = React.useMemo(() => {
    const total = filteredSales.reduce((sum, s) => sum + (s.netTotal || 0), 0);
    const paid = filteredSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
    const remaining = filteredSales.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);
    const tax = filteredSales.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
    return {
      total,
      paid,
      remaining,
      tax,
      count: filteredSales.length,
      taxableCount: filteredSales.filter((s) => s.isTaxInvoice).length,
    };
  }, [filteredSales]);

  const isFilterActive =
    filterPreset !== 'ALL' ||
    Boolean(selectedMonth) ||
    Boolean(selectedDate) ||
    Boolean(customStartDate) ||
    Boolean(customEndDate) ||
    filterChannel !== 'ALL' ||
    filterPayment !== 'ALL' ||
    filterPaymentMethod !== 'ALL' ||
    filterStatus !== 'ALL' ||
    filterTax !== 'ALL' ||
    Boolean(searchTerm);

  const handleResetFilters = () => {
    setFilterPreset('ALL');
    setSelectedMonth('');
    setSelectedDate('');
    setCustomStartDate('');
    setCustomEndDate('');
    setFilterChannel('ALL');
    setFilterPayment('ALL');
    setFilterPaymentMethod('ALL');
    setFilterStatus('ALL');
    setFilterTax('ALL');
    setSearchTerm('');
  };

  // Tax breakdown metrics for Sales
  const taxableSales = filteredSales.filter((s) => s.isTaxInvoice);
  const nonTaxableSales = filteredSales.filter((s) => !s.isTaxInvoice);
  const taxableSalesSubtotal = taxableSales.reduce(
    (sum, s) => sum + (s.subtotalBeforeTax || s.invoiceTotal - s.discount),
    0
  );
  const taxableSalesTaxCollected = taxableSales.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
  const nonTaxableSalesTotal = nonTaxableSales.reduce((sum, s) => sum + s.netTotal, 0);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const activeFiltersCount = [
    filterPayment !== 'ALL',
    filterPaymentMethod !== 'ALL',
    filterStatus !== 'ALL',
    filterTax !== 'ALL',
    filterChannel !== 'ALL',
    filterPreset !== 'ALL',
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Viewer Mode Notice */}
      {userRole === 'viewer' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-bold shadow-xs">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{t.viewerReadOnlyNotice}</span>
        </div>
      )}

      {/* Top Controls Bar - Compact & Spacious Search */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Expanded & Highly Readable Search Input */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className={`w-5 h-5 text-slate-400 absolute ${isEn ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 pointer-events-none`} />
            <input
              id="input-sales-search"
              type="text"
              placeholder={isEn ? 'Search by customer name, phone, invoice #, or service...' : 'بحث باسم العميل، رقم الجوال، الفاتورة، أو الخدمة...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full ${isEn ? 'pl-11 pr-9' : 'pr-11 pl-9'} py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/60 font-medium text-slate-900 transition placeholder:text-slate-400`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={`absolute ${isEn ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer`}
                title={isEn ? 'Clear search' : 'مسح البحث'}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Essential Controls */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Filter Drawer Toggle Button */}
            <button
              type="button"
              id="btn-toggle-sales-filters"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              title={isEn ? 'Filters & Advanced criteria' : 'تصفية وفلاتر متقدمة'}
            >
              <Filter className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isEn ? 'Sales Filters' : 'فلاتر المبيعات'}</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Sort Filter - Quick Compact Dropdown */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl px-2 py-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="select-sales-sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs py-1 bg-transparent border-none font-bold text-slate-800 cursor-pointer outline-none"
              >
                <option value="NEWEST">{isEn ? 'Newest First' : 'الأحدث أولاً'}</option>
                <option value="OLDEST">{isEn ? 'Oldest First' : 'الأقدم أولاً'}</option>
                <option value="AMOUNT_DESC">{isEn ? 'Highest Amount' : 'الأعلى مبلغاً'}</option>
                <option value="AMOUNT_ASC">{isEn ? 'Lowest Amount' : 'الأقل مبلغاً'}</option>
                <option value="CUSTOMER_ASC">{isEn ? 'Customer Name (A-Z)' : 'اسم العميل (أ-ي)'}</option>
              </select>
            </div>

            {/* Toggle Summaries Button */}
            <button
              type="button"
              onClick={() => {
                setShowSummaries((prev) => {
                  const next = !prev;
                  localStorage.setItem('sales_show_summaries', String(next));
                  return next;
                });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
              title={showSummaries ? (isEn ? 'Hide Totals & Indicators' : 'إخفاء الإجماليات والمؤشرات') : (isEn ? 'Show Totals' : 'إظهار الإجماليات')}
            >
              {showSummaries ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden xl:inline">{isEn ? 'Hide Totals' : 'إخفاء الإجماليات'}</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden xl:inline">{isEn ? 'Show Totals' : 'إظهار الإجماليات'}</span>
                </>
              )}
            </button>

            {/* Add Sale Button - Hidden for Viewers */}
            {userRole !== 'viewer' && (
              <button
                id="btn-add-sale"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'New Invoice' : 'فاتورة جديدة'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Filters Drawer - Saves screen space */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs text-slate-600 animate-fadeIn">
            {/* Payment Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">{isEn ? 'Payment:' : 'الدفع:'}</span>
              <select
                id="select-filter-payment"
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">{isEn ? 'All' : 'الكل'}</option>
                <option value="PAID">✅ {isEn ? 'Paid' : 'مسدد'}</option>
                <option value="PARTIAL">🟡 {isEn ? 'Partially Paid' : 'مسدد جزئي'}</option>
                <option value="UNPAID">🔴 {isEn ? 'Unpaid' : 'غير مسدد'}</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">{isEn ? 'Payment Method:' : 'طريقة الدفع:'}</span>
              <select
                id="select-filter-payment-method"
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">{isEn ? '💳 All Methods' : '💳 جميع الطرق'}</option>
                <option value="CASH">{isEn ? '💵 Cash' : '💵 كاش (نقد)'}</option>
                <option value="NETWORK">{isEn ? '💳 Card (POS)' : '💳 شبكة'}</option>
                <option value="TRANSFER">{isEn ? '🏦 Bank Transfer' : '🏦 تحويل بنكي'}</option>
                <option value="DEFERRED">{isEn ? '⏳ Credit / Deferred' : '⏳ آجل'}</option>
              </select>
            </div>

            {/* Order Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">{isEn ? 'Status:' : 'الحالة:'}</span>
              <select
                id="select-filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">{isEn ? 'All Statuses' : 'جميع الحالات'}</option>
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Tax Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">{isEn ? 'Tax:' : 'الضريبة:'}</span>
              <select
                id="select-filter-tax"
                value={filterTax}
                onChange={(e) => setFilterTax(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">{isEn ? 'All' : 'الكل'}</option>
                <option value="TAX">🧾 {isEn ? 'Tax Invoice (15%)' : 'ضريبية (15%)'}</option>
                <option value="STANDARD">📄 {isEn ? 'Non-Tax (0%)' : 'غير ضريبية (0%)'}</option>
              </select>
            </div>

            {/* Channel Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">{isEn ? 'Channel:' : 'القناة:'}</span>
              <select
                id="select-filter-channel"
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">{isEn ? 'All Channels' : 'جميع القنوات'}</option>
                {availableChannels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilterPayment('ALL');
                  setFilterPaymentMethod('ALL');
                  setFilterStatus('ALL');
                  setFilterTax('ALL');
                  setFilterChannel('ALL');
                  setFilterPreset('ALL');
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1 cursor-pointer underline"
              >
                {isEn ? 'Reset Filters' : 'إعادة ضبط الفلاتر'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Date & Channel Filtering Bar (مثل لوحة التحكم) */}
      <DateFilterBar
        idPrefix="sales-date-filter"
        filterPreset={filterPreset}
        onFilterPresetChange={setFilterPreset}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        availableMonths={availableMonths}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        customStartDate={customStartDate}
        onCustomStartDateChange={setCustomStartDate}
        customEndDate={customEndDate}
        onCustomEndDateChange={setCustomEndDate}
        filterLabel={filterLabel}
        totalCount={filteredSales.length}
        countLabel={isEn ? 'Invoices' : 'فاتورة'}
        onReset={handleResetFilters}
        isFilterActive={isFilterActive}
        channelLabel={isEn ? 'Channel:' : 'القناة:'}
        selectedChannel={filterChannel}
        onChannelChange={setFilterChannel}
        availableChannels={availableChannels}
        allChannelsLabel={isEn ? '🏷️ All Channels' : '🏷️ جميع القنوات'}
        paymentMethodLabel={isEn ? 'Payment Method:' : 'طريقة الدفع:'}
        selectedPaymentMethod={filterPaymentMethod}
        onPaymentMethodChange={setFilterPaymentMethod}
        currentLang={currentLang}
      />

      {/* Period Totals & Payment Breakdown Cards (إجماليات الفترة) */}
      {showSummaries && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">
            {isEn ? 'Period Sales Total' : 'إجمالي مبيعات الفترة'}
          </span>
          <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">
            {periodTotals.total.toFixed(2)} <span className="text-xs font-sans text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{filterLabel}</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-xs text-emerald-800 font-medium block">
            {isEn ? 'Collected (Cash/Card/Transfer)' : 'المحصل نقداً/شبكة/تحويل'}
          </span>
          <span className="text-base sm:text-lg font-bold text-emerald-700 font-mono">
            {periodTotals.paid.toFixed(2)} <span className="text-xs font-sans text-emerald-600">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-emerald-600 block mt-0.5">
            {isEn ? 'In drawers and bank accounts' : 'في الصناديق والحسابات'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-xs text-amber-800 font-medium block">
            {isEn ? 'Remaining (Credit Receivables)' : 'المتبقي (الآجل المستحق)'}
          </span>
          <span
            className={`text-base sm:text-lg font-bold font-mono ${
              periodTotals.remaining > 0 ? 'text-amber-700' : 'text-slate-700'
            }`}
          >
            {periodTotals.remaining.toFixed(2)} <span className="text-xs font-sans text-amber-600">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-amber-600 block mt-0.5">
            {isEn ? 'Due from customers' : 'مستحقات عند العملاء'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-xs">
          <span className="text-xs text-indigo-800 font-medium block">
            {isEn ? 'Total VAT (15%)' : 'إجمالي الضريبة (15%)'}
          </span>
          <span className="text-base sm:text-lg font-bold text-indigo-700 font-mono">
            {periodTotals.tax.toFixed(2)} <span className="text-xs font-sans text-indigo-600">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-indigo-600 block mt-0.5">
            {isEn ? `From ${periodTotals.taxableCount} tax invoices` : `من ${periodTotals.taxableCount} فاتورة ضريبية`}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 font-medium block">
            {isEn ? 'Invoices Count' : 'عدد الفواتير'}
          </span>
          <span className="text-base sm:text-lg font-bold text-slate-800 font-mono">
            {periodTotals.count} <span className="text-xs font-sans text-slate-500">{isEn ? 'invoices' : 'فاتورة'}</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {isEn ? 'Within selected period' : 'ضمن الفترة المحددة'}
          </span>
        </div>
      </div>

      {/* Interactive Payment Methods Cards Strip - فلترة سريعة ومباشرة حسب طريقة الدفع */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span>{isEn ? '💳 Payment & Collection Totals' : '💳 إجماليات طرق الدفع والتحصيل'}</span>
            </span>
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {isEn ? 'Click any method to filter invoices and view breakdown' : 'اضغط على أي طريقة لتصفية الفواتير فوراً ومعرفة المبالغ الدقيقة'}
            </span>
          </div>
          {filterPaymentMethod !== 'ALL' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {isEn ? 'Filtered by: ' : 'مفلتر حالياً: '}
                {filterPaymentMethod === 'CASH'
                  ? (isEn ? '💵 Cash' : '💵 كاش')
                  : filterPaymentMethod === 'NETWORK'
                  ? (isEn ? '💳 Card (POS)' : '💳 شبكة')
                  : filterPaymentMethod === 'TRANSFER'
                  ? (isEn ? '🏦 Bank Transfer' : '🏦 تحويل')
                  : filterPaymentMethod === 'DEFERRED'
                  ? (isEn ? '⏳ Credit / Deferred' : '⏳ آجل')
                  : filterPaymentMethod}
              </span>
              <button
                type="button"
                id="btn-clear-sales-payment-method-filter"
                onClick={() => setFilterPaymentMethod('ALL')}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 cursor-pointer transition"
              >
                {isEn ? 'Show All Methods ✕' : 'عرض كل الطرق ✕'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Cash Card */}
          <button
            type="button"
            id="card-filter-cash"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'CASH' ? 'ALL' : 'CASH')}
            className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
              filterPaymentMethod === 'CASH'
                ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400'
                : 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200/90 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-xs font-bold flex items-center gap-1 ${filterPaymentMethod === 'CASH' ? 'text-white' : 'text-emerald-900'}`}>
                <span>💵</span>
                <span>{isEn ? 'Cash (Drawer)' : 'كاش (نقدي)'}</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                filterPaymentMethod === 'CASH' ? 'bg-emerald-800/80 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {paymentMethodBreakdown.cashCount} {isEn ? 'invoices' : 'فاتورة'}
              </span>
            </div>
            <div className="mt-2 font-mono font-black text-base sm:text-xl">
              {paymentMethodBreakdown.cashPaid.toFixed(2)}{' '}
              <span className={`text-[11px] font-sans font-normal ${filterPaymentMethod === 'CASH' ? 'text-emerald-100' : 'text-slate-500'}`}>
                {isEn ? 'SAR' : 'ر.س'}
              </span>
            </div>
            <div className={`mt-1 text-[10px] flex items-center justify-between pt-1 border-t ${
              filterPaymentMethod === 'CASH' ? 'border-emerald-500 text-emerald-100' : 'border-emerald-100 text-emerald-700'
            }`}>
              <span>{isEn ? 'Collected in drawer' : 'محصل فعلي في الدرج'}</span>
              <span className="font-semibold underline">
                {filterPaymentMethod === 'CASH' ? (isEn ? 'Selected ✓' : 'محدد حالياً ✓') : (isEn ? 'Filter →' : 'تصفية ←')}
              </span>
            </div>
          </button>

          {/* 2. Network Card */}
          <button
            type="button"
            id="card-filter-network"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'NETWORK' ? 'ALL' : 'NETWORK')}
            className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
              filterPaymentMethod === 'NETWORK'
                ? 'bg-gradient-to-br from-sky-600 to-sky-700 text-white border-sky-600 shadow-md ring-2 ring-sky-400'
                : 'bg-sky-50/40 hover:bg-sky-50/80 border-sky-200/90 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-xs font-bold flex items-center gap-1 ${filterPaymentMethod === 'NETWORK' ? 'text-white' : 'text-sky-900'}`}>
                <span>💳</span>
                <span>{isEn ? 'Card / POS' : 'شبكة (مدى/بطاقة)'}</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                filterPaymentMethod === 'NETWORK' ? 'bg-sky-800/80 text-sky-100' : 'bg-sky-100 text-sky-800'
              }`}>
                {paymentMethodBreakdown.networkCount} {isEn ? 'invoices' : 'فاتورة'}
              </span>
            </div>
            <div className="mt-2 font-mono font-black text-base sm:text-xl">
              {paymentMethodBreakdown.networkPaid.toFixed(2)}{' '}
              <span className={`text-[11px] font-sans font-normal ${filterPaymentMethod === 'NETWORK' ? 'text-sky-100' : 'text-slate-500'}`}>
                {isEn ? 'SAR' : 'ر.س'}
              </span>
            </div>
            <div className={`mt-1 text-[10px] flex items-center justify-between pt-1 border-t ${
              filterPaymentMethod === 'NETWORK' ? 'border-sky-500 text-sky-100' : 'border-sky-100 text-sky-700'
            }`}>
              <span>{isEn ? 'POS terminal account' : 'محصل في نقاط البيع'}</span>
              <span className="font-semibold underline">
                {filterPaymentMethod === 'NETWORK' ? (isEn ? 'Selected ✓' : 'محدد حالياً ✓') : (isEn ? 'Filter →' : 'تصفية ←')}
              </span>
            </div>
          </button>

          {/* 3. Transfer Card */}
          <button
            type="button"
            id="card-filter-transfer"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'TRANSFER' ? 'ALL' : 'TRANSFER')}
            className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
              filterPaymentMethod === 'TRANSFER'
                ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white border-purple-600 shadow-md ring-2 ring-purple-400'
                : 'bg-purple-50/40 hover:bg-purple-50/80 border-purple-200/90 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-xs font-bold flex items-center gap-1 ${filterPaymentMethod === 'TRANSFER' ? 'text-white' : 'text-purple-900'}`}>
                <span>🏦</span>
                <span>{isEn ? 'Bank Transfer' : 'تحويل بنكي'}</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                filterPaymentMethod === 'TRANSFER' ? 'bg-purple-800/80 text-purple-100' : 'bg-purple-100 text-purple-800'
              }`}>
                {paymentMethodBreakdown.transferCount} {isEn ? 'invoices' : 'فاتورة'}
              </span>
            </div>
            <div className="mt-2 font-mono font-black text-base sm:text-xl">
              {paymentMethodBreakdown.transferPaid.toFixed(2)}{' '}
              <span className={`text-[11px] font-sans font-normal ${filterPaymentMethod === 'TRANSFER' ? 'text-purple-100' : 'text-slate-500'}`}>
                {isEn ? 'SAR' : 'ر.س'}
              </span>
            </div>
            <div className={`mt-1 text-[10px] flex items-center justify-between pt-1 border-t ${
              filterPaymentMethod === 'TRANSFER' ? 'border-purple-500 text-purple-100' : 'border-purple-100 text-purple-700'
            }`}>
              <span>{isEn ? 'Corporate bank account' : 'محصل في الحساب البنكي'}</span>
              <span className="font-semibold underline">
                {filterPaymentMethod === 'TRANSFER' ? (isEn ? 'Selected ✓' : 'محدد حالياً ✓') : (isEn ? 'Filter →' : 'تصفية ←')}
              </span>
            </div>
          </button>

          {/* 4. Deferred Card */}
          <button
            type="button"
            id="card-filter-deferred"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'DEFERRED' ? 'ALL' : 'DEFERRED')}
            className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
              filterPaymentMethod === 'DEFERRED'
                ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
                : 'bg-amber-50/40 hover:bg-amber-50/80 border-amber-200/90 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-xs font-bold flex items-center gap-1 ${filterPaymentMethod === 'DEFERRED' ? 'text-white' : 'text-amber-900'}`}>
                <span>⏳</span>
                <span>{isEn ? 'Credit / Deferred' : 'آجل / ذمم مستحقة'}</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                filterPaymentMethod === 'DEFERRED' ? 'bg-amber-800/80 text-amber-100' : 'bg-amber-100 text-amber-800'
              }`}>
                {paymentMethodBreakdown.deferredCount} {isEn ? 'due' : 'مستحق'}
              </span>
            </div>
            <div className="mt-2 font-mono font-black text-base sm:text-xl text-amber-700 group-hover:text-amber-800">
              <span className={filterPaymentMethod === 'DEFERRED' ? 'text-white' : 'text-amber-700'}>
                {paymentMethodBreakdown.deferredRemaining.toFixed(2)}{' '}
              </span>
              <span className={`text-[11px] font-sans font-normal ${filterPaymentMethod === 'DEFERRED' ? 'text-amber-100' : 'text-slate-500'}`}>
                {isEn ? 'SAR' : 'ر.س'}
              </span>
            </div>
            <div className={`mt-1 text-[10px] flex items-center justify-between pt-1 border-t ${
              filterPaymentMethod === 'DEFERRED' ? 'border-amber-500 text-amber-100' : 'border-amber-100 text-amber-700'
            }`}>
              <span>{isEn ? 'Due from customers' : 'متبقي عند العملاء'}</span>
              <span className="font-semibold underline">
                {filterPaymentMethod === 'DEFERRED' ? (isEn ? 'Selected ✓' : 'محدد حالياً ✓') : (isEn ? 'Filter →' : 'تصفية ←')}
              </span>
            </div>
          </button>
        </div>
      </div>
        </>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span className="font-bold text-xs text-slate-800">
              {isEn ? 'Sales & Invoices Ledger' : 'جدول المبيعات والفواتير (يدعم بنود متعددة لكل فاتورة)'}
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
              {filteredSales.length} {isEn ? 'records' : 'سجل'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {isEn ? 'Standard Accounting & Invoicing' : 'الأعمدة مطابقة لمعايير الحسابات والفوترة'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse min-w-[1700px]">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 text-[11px] font-bold select-none">
                <th className="p-2.5 w-10 text-center">#</th>
                <th className="p-2.5 font-bold">{isEn ? 'A: Invoice #' : 'A: رقم الفاتورة'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'B: Customer Name' : 'B: اسم العميل'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'C: Phone Number' : 'C: رقم الجوال'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'D: Customer Source' : 'D: مصدر العميل'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'E: Services & Items' : 'E: الخدمات والمنتجات'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'F: Specifications' : 'F: المواصفات'}</th>
                <th className="p-2.5 font-bold text-center">{isEn ? 'G: Qty' : 'G: الكمية'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'H: Unit' : 'H: القياس'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'I: Unit Price' : 'I: سعر الوحدة'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'J: Order Total' : 'J: إجمالي الطلب'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'K: Invoice Total' : 'K: الفاتورة'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'L: Discount' : 'L: الخصم'}</th>
                <th className="p-2.5 font-bold bg-emerald-50 text-emerald-900">{isEn ? 'M: Net Total' : 'M: الصافي'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'N: Payment Method' : 'N: طريقة الدفع'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'O: Paid' : 'O: المدفوع'}</th>
                <th className="p-2.5 font-bold text-rose-700">{isEn ? 'P: Remaining' : 'P: المتبقي'}</th>
                <th className="p-2.5 font-bold text-center">{isEn ? 'Q: Payment Status' : 'Q: حالة الدفع'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'R: Receipt Date' : 'R: الاستلام'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'S: Delivery Date' : 'S: التسليم'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'T: Order Status' : 'T: حالة الطلب'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'U: Assigned To' : 'U: المسؤول'}</th>
                <th className="p-2.5 font-bold text-center">{isEn ? 'V: Delay Days' : 'V: أيام التأخير'}</th>
                <th className="p-2.5 font-bold">{isEn ? 'W: Notes' : 'W: ملاحظات'}</th>
                <th className="p-2.5 font-bold text-center sticky left-0 bg-slate-100 shadow-sm">{isEn ? 'Actions' : 'إجراءات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={25} className="py-12 text-center text-slate-400">
                    {isEn ? 'No sales invoices match current search filters' : 'لا توجد فواتير مبيعات مطابقة لمعايير البحث الحالية'}
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale, idx) => {
                  const isExpanded = expandedSaleId === sale.id;
                  const hasMultiItems = sale.items && sale.items.length > 1;

                  return (
                    <React.Fragment key={sale.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrintInvoice(sale);
                              }}
                              className="font-mono font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 px-2 py-1 rounded-md text-xs inline-flex items-center gap-1 cursor-pointer shadow-2xs transition"
                              title="اضغط لمعاينة وطباعة وتصدير الفاتورة"
                            >
                              <Receipt className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{sale.invoiceNo}</span>
                            </button>
                            {sale.isTaxInvoice && (
                              <span
                                className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-sans font-bold border border-emerald-300 flex items-center gap-0.5"
                                title={`فاتورة ضريبية (15% = ${(sale.taxAmount || 0).toFixed(2)} ر.س)`}
                              >
                                <FileCheck2 className="w-2.5 h-2.5" />
                                <span>ضريبية</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{sale.customerName}</td>
                        <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{sale.customerPhone}</td>
                        <td className="p-2.5 text-slate-600 whitespace-nowrap">{sale.customerSource}</td>
                        <td className="p-2.5 font-medium text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{sale.serviceType}</span>
                            {hasMultiItems && (
                              <button
                                type="button"
                                onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                                className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 transition"
                              >
                                <span>{sale.items?.length} خدمات</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 text-slate-600 max-w-[200px] truncate" title={sale.specifications}>
                          {sale.specifications || '—'}
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-800">{sale.quantity}</td>
                        <td className="p-2.5 text-slate-600">{sale.unitType}</td>
                        <td className="p-2.5 font-mono text-slate-800">{sale.unitPrice.toFixed(2)}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">{sale.itemTotal.toFixed(2)}</td>
                        <td className="p-2.5 font-mono text-slate-800">{sale.invoiceTotal.toFixed(2)}</td>
                        <td className="p-2.5 font-mono text-slate-500">{sale.discount.toFixed(2)}</td>
                        <td className="p-2.5 font-mono font-extrabold text-emerald-800 bg-emerald-50/60">
                          {sale.netTotal.toFixed(2)}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {(() => {
                            const details = getPaymentMethodDetails(sale.paymentMethod);
                            const isSelected = filterPaymentMethod === details.category;
                            return (
                              <button
                                type="button"
                                onClick={() => setFilterPaymentMethod(isSelected ? 'ALL' : details.category)}
                                title={`اضغط لتصفية الفواتير حسب: ${details.label}`}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer hover:shadow-xs ${
                                  isSelected ? details.activeClass : details.badgeClass
                                }`}
                              >
                                <span>{details.icon}</span>
                                <span>{details.shortLabel}</span>
                              </button>
                            );
                          })()}
                        </td>
                        <td className="p-2.5 font-mono text-slate-800">{sale.paidAmount.toFixed(2)}</td>
                        <td className="p-2.5 font-mono font-bold text-rose-700">
                          {sale.remainingAmount > 0 ? sale.remainingAmount.toFixed(2) : '0.00'}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              sale.paymentStatus.includes('✅')
                                ? 'bg-emerald-100 text-emerald-800'
                                : sale.paymentStatus.includes('🟡')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {sale.paymentStatus}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{sale.receiptDate}</td>
                        <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{sale.deliveryDate || '—'}</td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {sale.orderStatus}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-700 whitespace-nowrap">{sale.assignedTo || '—'}</td>
                        <td className="p-2.5 text-center">
                          {typeof sale.delayDays === 'number' && sale.delayDays > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-rose-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">
                              <Clock className="w-3 h-3" />
                              {sale.delayDays} يوم
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-500 max-w-[150px] truncate" title={sale.notes}>
                          {sale.notes || '—'}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap sticky left-0 bg-white/95 shadow-sm">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrintInvoice(sale);
                              }}
                              title="فتح الفاتورة للطباعة أو التصدير PDF"
                              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>فاتورة</span>
                            </button>

                            {/* View Row Timeline */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSaleForTimeline(sale);
                              }}
                              title={`عرض الخط الزمني (أنشأها: ${sale.audit?.createdByName || 'حساب النظام'})`}
                              className="p-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            {(() => {
                              const isApprovedOrPaid = sale.paymentStatus.includes('✅') || sale.orderStatus === 'تم التسليم';
                              const isLocked = Boolean(agencySettings?.invoiceLockApproved && isApprovedOrPaid);
                              const canEdit = userRole === 'owner' || userRole === 'admin' || (!isLocked && userRole !== 'viewer');
                              const canDelete = userRole === 'owner' || userRole === 'admin' || (!isLocked && userRole !== 'viewer' && userRole !== 'sales');

                              return (
                                <>
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditModal(sale);
                                      }}
                                      title="تعديل الفاتورة"
                                      className="p-1 rounded text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  ) : isLocked ? (
                                    <span
                                      title="الفاتورة مقفلة (مسددة/معتمدة). التعديل محصور بالإدارة والمالك"
                                      className="p-1 text-slate-400 cursor-not-allowed inline-flex items-center"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                    </span>
                                  ) : null}

                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(sale.id);
                                      }}
                                      title="حذف الفاتورة"
                                      className="p-1 rounded text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>

                      {/* Multi-items Expanded Sub-table */}
                      {isExpanded && sale.items && sale.items.length > 0 && (
                        <tr className="bg-emerald-50/40">
                          <td colSpan={25} className="p-3 pr-12">
                            <div className="bg-white rounded-lg p-3 border border-emerald-200 shadow-xs space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-emerald-950 border-b border-emerald-100 pb-1.5 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onPrintInvoice(sale)}
                                    className="px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>طباعة الفاتورة</span>
                                  </button>
                                  <span>تفاصيل الخدمات والمنتجات ({sale.items.length} بنود):</span>
                                </div>
                                <span>العميل: {sale.customerName} - {sale.invoiceNo}</span>
                              </div>
                              <table className="w-full text-right text-xs">
                                <thead>
                                  <tr className="text-slate-500 border-b border-slate-100">
                                    <th className="py-1">#</th>
                                    <th className="py-1">الخدمة / المنتج</th>
                                    <th className="py-1">المواصفات الفنية</th>
                                    <th className="py-1 text-center">الكمية</th>
                                    <th className="py-1">نوع القياس</th>
                                    <th className="py-1">سعر الوحدة</th>
                                    <th className="py-1 font-bold">الإجمالي</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sale.items.map((line, lIdx) => (
                                    <tr key={line.id || lIdx} className="border-b border-slate-50 text-slate-700">
                                      <td className="py-1 font-mono text-slate-400">{lIdx + 1}</td>
                                      <td className="py-1 font-bold text-slate-900">{line.serviceType}</td>
                                      <td className="py-1 text-slate-600">{line.specifications || '—'}</td>
                                      <td className="py-1 text-center font-bold">{line.quantity}</td>
                                      <td className="py-1 text-slate-500">{line.unitType}</td>
                                      <td className="py-1 font-mono">{line.unitPrice.toFixed(2)} ر.س</td>
                                      <td className="py-1 font-mono font-bold text-emerald-900">{line.itemTotal.toFixed(2)} ر.س</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form for Add/Edit Sale with Multiple Line Items */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] my-auto">
            <div className="p-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base">
                  {editingSale ? 'تعديل فاتورة مبيعات' : 'إضافة فاتورة مبيعات جديدة'}
                </h3>
                <p className="text-xs text-slate-300">
                  يمكنك إضافة أكثر من خدمة أو منتج لنفس العميل في فاتورة واحدة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto flex flex-col overscroll-contain">
              <div className="p-5 space-y-4 flex-1">
                {/* Section 1: Customer Data */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1">
                  بيانات العميل
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      اسم العميل (B) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customerName || ''}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="اسم العميل أو الجهة"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      رقم الجوال (C)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={formData.customerPhone || ''}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      placeholder="05XXXXXXXX"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      مصدر العميل (D)
                    </label>
                    <EditableSelect
                      id="sale-customer-source"
                      value={formData.customerSource || ''}
                      onChange={(val) => setFormData({ ...formData, customerSource: val })}
                      options={CUSTOMER_SOURCES}
                      storageKey="customer_sources"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      قناة البيع / جهة الدخل
                    </label>
                    <EditableSelect
                      id="sale-revenue-source"
                      value={formData.revenueSource || ''}
                      onChange={(val) => setFormData({ ...formData, revenueSource: val })}
                      options={[
                        'المحل المباشر',
                        'المتجر الإلكتروني',
                        'مندوب / مسوق',
                        'سوشل ميديا (واتساب/إنستغرام)',
                        'عقد سنوي / جهة خاصة',
                        'أخرى',
                      ]}
                      storageKey="sales_channels"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      الرقم الضريبي للعميل (اختياري)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={formData.customerVatNumber || ''}
                      onChange={(e) => setFormData({ ...formData, customerVatNumber: e.target.value })}
                      placeholder="3XXXXXXXXXXXX03"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Multiple Services/Products in Single Invoice */}
              <div className="border border-emerald-200 rounded-xl p-3.5 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <PackagePlus className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-950">
                      الخدمات والمنتجات المطلوبة ({formData.items?.length || 1})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة خدمة / منتج آخر للفاتورة +</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {(formData.items || []).map((lineItem, index) => (
                    <div
                      key={lineItem.id || index}
                      className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs space-y-2 relative"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 border-b border-slate-100 pb-1">
                        <span>البند #{index + 1}</span>
                        {(formData.items?.length || 0) > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(index)}
                            className="text-rose-500 hover:text-rose-700 text-[11px] flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف البند</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            نوع الخدمة / المنتج
                          </label>
                          <EditableSelect
                            value={lineItem.serviceType}
                            onChange={(val) => handleUpdateLineItem(index, { serviceType: val })}
                            options={SERVICE_TYPES}
                            storageKey="sales_service_types"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            المواصفات الفنية للبند
                          </label>
                          <input
                            type="text"
                            value={lineItem.specifications || ''}
                            onChange={(e) => handleUpdateLineItem(index, { specifications: e.target.value })}
                            placeholder="الأبعاد، نوع الخامة، دقة الطباعة، خيارات التشطيب..."
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">الكمية</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            value={lineItem.quantity === 0 ? '' : lineItem.quantity}
                            onChange={(e) =>
                              handleUpdateLineItem(index, { quantity: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">نوع القياس</label>
                          <EditableSelect
                            value={lineItem.unitType}
                            onChange={(val) => handleUpdateLineItem(index, { unitType: val })}
                            options={SALES_UNIT_TYPES}
                            storageKey="sales_unit_types"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">سعر الوحدة</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            value={lineItem.unitPrice === 0 ? '' : lineItem.unitPrice}
                            onChange={(e) =>
                              handleUpdateLineItem(index, { unitPrice: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="text-left font-mono text-xs font-bold text-emerald-900 bg-emerald-50/70 p-2 rounded-lg">
                          الإجمالي: {lineItem.itemTotal.toFixed(2)} ر.س
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Payment & Calculations */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1">
                  السداد والحسابات التلقائية (محسوبة بالمعادلات)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 sm:col-span-1 bg-white p-2 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700">الخصم (L)</label>
                      <div className="inline-flex rounded-md p-0.5 bg-slate-100 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const total = Number(formData.invoiceTotal) || 0;
                            const p = total > 0 ? Math.round(((Number(formData.discount) || 0) / total) * 100 * 10) / 10 : 0;
                            setFormData({
                              ...formData,
                              discountType: 'amount',
                              discountPercent: p,
                            });
                          }}
                          className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            (formData.discountType || 'amount') === 'amount'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ر.س
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const total = Number(formData.invoiceTotal) || 0;
                            const p =
                              formData.discountPercent && Number(formData.discountPercent) > 0
                                ? Number(formData.discountPercent)
                                : total > 0
                                ? Math.round(((Number(formData.discount) || 0) / total) * 100 * 10) / 10
                                : 0;
                            const calcDiscount = Math.round(((total * p) / 100) * 100) / 100;
                            setFormData({
                              ...formData,
                              discountType: 'percentage',
                              discountPercent: p,
                              discount: calcDiscount,
                            });
                          }}
                          className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            formData.discountType === 'percentage'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          %
                        </button>
                      </div>
                    </div>

                    {formData.discountType === 'percentage' ? (
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={formData.discountPercent ?? ''}
                            onChange={(e) => {
                              const p = parseFloat(e.target.value) || 0;
                              const total = Number(formData.invoiceTotal) || 0;
                              const calcDiscount = Math.round(((total * p) / 100) * 100) / 100;
                              setFormData({
                                ...formData,
                                discountPercent: p,
                                discount: calcDiscount,
                              });
                            }}
                            placeholder="0"
                            className="w-full text-xs p-1.5 pl-6 rounded-md border border-slate-300 focus:ring-1 focus:ring-emerald-500 bg-white font-mono"
                          />
                          <span className="absolute left-2 top-1.5 text-xs font-bold text-slate-400 pointer-events-none">
                            %
                          </span>
                        </div>
                        <span className="text-[10px] text-rose-600 font-mono block mt-0.5">
                          -{(Number(formData.discount) || 0).toFixed(2)} ر.س
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={formData.discount ?? 0}
                            onChange={(e) => {
                              const d = parseFloat(e.target.value) || 0;
                              const total = Number(formData.invoiceTotal) || 0;
                              const p = total > 0 ? Math.round(((d / total) * 100) * 10) / 10 : 0;
                              setFormData({
                                ...formData,
                                discount: d,
                                discountPercent: p,
                              });
                            }}
                            className="w-full text-xs p-1.5 pl-8 rounded-md border border-slate-300 focus:ring-1 focus:ring-emerald-500 bg-white font-mono"
                          />
                          <span className="absolute left-2 top-1.5 text-[11px] font-bold text-slate-400 pointer-events-none">
                            ر.س
                          </span>
                        </div>
                        {Boolean(Number(formData.discount)) && (
                          <span className="text-[10px] text-emerald-700 font-mono block mt-0.5">
                            نسبة: {(((Number(formData.discount) || 0) / (Number(formData.invoiceTotal) || 1)) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">طريقة الدفع (N)</label>
                    <EditableSelect
                      id="sale-payment-method"
                      value={formData.paymentMethod || ''}
                      onChange={(val) => setFormData({ ...formData, paymentMethod: val })}
                      options={SALES_PAYMENT_METHODS}
                      storageKey="sales_payment_methods"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      المدفوع نقداً/شبكة (O)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.paidAmount ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                    />
                  </div>

                  {/* Calculated summary pill */}
                  <div className="flex flex-col justify-end">
                    <span className="text-[11px] text-slate-500 mb-1">حالة السداد المحسوبة (Q)</span>
                    <span
                      className={`text-center py-1.5 px-2 rounded-lg text-xs font-bold border ${
                        livePreview.paymentStatus.includes('✅')
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : livePreview.paymentStatus.includes('🟡')
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                    >
                      {livePreview.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Instant Calculation Bar */}
                <div className="pt-2 mt-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-700">
                  <div>
                    مجموع البنود: <strong className="font-mono text-slate-900">{livePreview.invoiceTotal.toFixed(2)} ر.س</strong>
                  </div>
                  <div>
                    الصافي بعد الخصم: <strong className="font-mono text-emerald-800 font-bold">{livePreview.netTotal.toFixed(2)} ر.س</strong>
                  </div>
                  <div>
                    المتبقي على العميل: <strong className="font-mono text-rose-700 font-bold">{livePreview.remainingAmount.toFixed(2)} ر.س</strong>
                  </div>
                </div>

                {/* Tax Invoice Toggle & VAT Breakdown */}
                <div className="mt-3 pt-3 border-t border-slate-200 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.isTaxInvoice)}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isTaxInvoice: e.target.checked,
                            agencyVatNumber:
                              formData.agencyVatNumber ||
                              agencySettings?.agencyVatNumber ||
                              '310123456700003',
                          })
                        }
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 focus:ring-2"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-emerald-700" />
                        إصدار فاتورة ضريبية (ضريبة القيمة المضافة 15%)
                      </span>
                    </label>
                    {formData.isTaxInvoice && (
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        فاتورة ضريبية نشطة
                      </span>
                    )}
                  </div>

                  {formData.isTaxInvoice && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-emerald-200/60 text-xs">
                      <div className="bg-white p-2 rounded-lg border border-emerald-200">
                        <span className="text-[11px] text-slate-500 block">المبلغ قبل الضريبة:</span>
                        <span className="font-bold text-slate-800">
                          {(livePreview.subtotalBeforeTax || livePreview.netTotal / 1.15).toFixed(2)} ر.س
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-200">
                        <span className="text-[11px] text-slate-500 block">قيمة الضريبة (15%):</span>
                        <span className="font-bold text-emerald-700">
                          {(livePreview.taxAmount || livePreview.netTotal - livePreview.netTotal / 1.15).toFixed(2)} ر.س
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-200">
                        <span className="text-[11px] text-slate-500 block">الرقم الضريبي للمنشأة:</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={formData.agencyVatNumber || agencySettings?.agencyVatNumber || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, agencyVatNumber: e.target.value })
                          }
                          placeholder="310123456700003"
                          className="w-full text-xs p-1 border border-slate-200 rounded font-mono mt-0.5 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Execution & Dates */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">
                  التنفيذ والمواعيد
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ الاستلام (R)</label>
                    <input
                      type="date"
                      value={formData.receiptDate || ''}
                      onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ التسليم (S)</label>
                    <input
                      type="date"
                      value={formData.deliveryDate || ''}
                      onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">حالة الطلب (T)</label>
                    <EditableSelect
                      id="sale-order-status"
                      value={formData.orderStatus || ''}
                      onChange={(val) => setFormData({ ...formData, orderStatus: val })}
                      options={ORDER_STATUSES}
                      storageKey="order_statuses"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">مسؤول التنفيذ (U)</label>
                    <EditableSelect
                      id="sale-assigned-to"
                      value={formData.assignedTo || ''}
                      onChange={(val) => setFormData({ ...formData, assignedTo: val })}
                      options={['فني الطباعة', 'المصمم الأول', 'فريق القص والليزر', 'مسؤول التركيبات']}
                      storageKey="assigned_staff"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات التنفيذ (W)</label>
                  <input
                    type="text"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="ملاحظات التسليم، رقم التوصيل، أو تفاصيل العقد"
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

              {/* Action Buttons Sticky Footer */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  {editingSale ? 'حفظ التعديلات' : 'إصدار الفاتورة وحفظها'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Destructive Delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900">تأكيد حذف فاتورة المبيعات</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إعادة حساب إجماليات المبيعات والأرباح والمتبقي تلقائياً. لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  onDeleteSale(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                نعم، احذف الفاتورة
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Audit Timeline Modals */}
      <AuditTimelineModal
        isOpen={Boolean(selectedSaleForTimeline)}
        onClose={() => setSelectedSaleForTimeline(null)}
        targetSale={selectedSaleForTimeline}
      />

      <AuditTimelineModal
        isOpen={showAllTimelineModal}
        onClose={() => setShowAllTimelineModal(false)}
        viewMode="all"
      />
    </div>
  );
};
