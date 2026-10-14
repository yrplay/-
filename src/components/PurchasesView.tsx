import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Filter,
  AlertCircle,
  ShoppingBag,
  Building2,
  Wrench,
  FileText,
  ChevronDown,
  ChevronUp,
  PackagePlus,
  Coins,
  Receipt,
  Eye,
  EyeOff,
  ArrowUpDown,
  X,
} from 'lucide-react';
import {
  PurchaseItem,
  PurchaseLineItem,
  PURCHASE_ITEMS,
  PURCHASE_UNIT_TYPES,
  PURCHASE_PAYMENT_METHODS,
  SUPPLIER_TYPES,
  UserRole,
} from '../types';
import { computePurchaseDerivedFields } from '../lib/dataStore';
import { EditableSelect } from './EditableSelect';
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

interface PurchasesViewProps {
  purchases: PurchaseItem[];
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  onAddPurchase: (item: PurchaseItem) => void;
  onUpdatePurchase: (item: PurchaseItem) => void;
  onDeletePurchase: (id: string) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

interface SupplierSummary {
  supplier: string;
  supplierType: string;
  totalPurchases: number;
  totalPaid: number;
  totalRemaining: number;
  ordersCount: number;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchases,
  userRole = 'owner',
  currentLang = 'ar',
  onAddPurchase,
  onUpdatePurchase,
  onDeletePurchase,
  isModalOpen,
  setIsModalOpen,
}) => {
  const t = getTranslations(currentLang);
  const isEn = currentLang === 'en';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('ALL');
  const [filterSupplier, setFilterSupplier] = useState<string>('ALL');
  const [filterSupplierType, setFilterSupplierType] = useState<string>('ALL');
  const [filterTax, setFilterTax] = useState<string>('ALL'); // 'ALL' | 'TAX' | 'STANDARD'
  const [editingItem, setEditingItem] = useState<PurchaseItem | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [showSupplierStatsModal, setShowSupplierStatsModal] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'AMOUNT_ASC' | 'SUPPLIER_ASC'>('NEWEST');
  const [showSummaries, setShowSummaries] = useState<boolean>(() => {
    return localStorage.getItem('purchases_show_summaries') !== 'false';
  });

  // Date Filtering State
  const [filterPreset, setFilterPreset] = useState<DateFilterPreset>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Available months from actual purchases data
  const availableMonths = React.useMemo(() => {
    return extractAvailableMonths(purchases.map((p) => p.date));
  }, [purchases]);

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

  // Extract unique supplier names from existing purchases
  const existingSuppliers = Array.from(
    new Set(purchases.map((p) => p.supplier).filter((s) => Boolean(s && s.trim())))
  );

  // Form State
  const [formData, setFormData] = useState<Partial<PurchaseItem>>({
    date: new Date().toISOString().split('T')[0],
    supplierInvoiceNo: '',
    supplier: '',
    supplierType: 'مورد خامات ومستلزمات',
    item: 'فينيل لاصق',
    unitType: 'رول',
    quantity: 1,
    purchasePrice: 150,
    paymentMethod: 'تحويل',
    paidAmount: 172.5,
    isTaxInvoice: true,
    taxRate: 15,
    supplierVatNumber: '',
    notes: '',
    items: [
      {
        id: 'line-1',
        item: 'فينيل لاصق',
        unitType: 'رول',
        quantity: 1,
        purchasePrice: 150,
        total: 150,
        notes: '',
      },
    ],
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      supplierInvoiceNo: '',
      supplier: '',
      supplierType: '',
      item: '',
      unitType: '',
      quantity: 0,
      purchasePrice: 0,
      paymentMethod: '',
      paidAmount: 0,
      isTaxInvoice: true,
      taxRate: 15,
      supplierVatNumber: '',
      notes: '',
      items: [
        {
          id: `line-${Date.now()}`,
          item: '',
          unitType: '',
          quantity: 0,
          purchasePrice: 0,
          total: 0,
          notes: '',
        },
      ],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: PurchaseItem) => {
    setEditingItem(item);
    const existingItems: PurchaseLineItem[] =
      item.items && item.items.length > 0
        ? item.items
        : [
            {
              id: `line-${Date.now()}`,
              item: item.item,
              unitType: item.unitType,
              quantity: item.quantity,
              purchasePrice: item.purchasePrice,
              total: item.total,
              notes: item.notes || '',
            },
          ];

    setFormData({
      ...item,
      isTaxInvoice: item.isTaxInvoice ?? false,
      taxRate: item.taxRate ?? 15,
      supplierVatNumber: item.supplierVatNumber || '',
      items: existingItems,
    });
    setIsModalOpen(true);
  };

  // Helper to update line items in form
  const handleUpdateLineItem = (index: number, updatedFields: Partial<PurchaseLineItem>) => {
    const currentLines = [...(formData.items || [])];
    const target = currentLines[index];
    if (!target) return;

    const newQuantity =
      updatedFields.quantity !== undefined ? Number(updatedFields.quantity) || 0 : target.quantity;
    const newPrice =
      updatedFields.purchasePrice !== undefined
        ? Number(updatedFields.purchasePrice) || 0
        : target.purchasePrice;

    currentLines[index] = {
      ...target,
      ...updatedFields,
      quantity: newQuantity,
      purchasePrice: newPrice,
      total: newQuantity * newPrice,
    };

    const newTotal = currentLines.reduce((sum, it) => sum + it.total, 0);

    setFormData({
      ...formData,
      items: currentLines,
      quantity: currentLines.reduce((s, it) => s + it.quantity, 0),
      total: newTotal,
      paidAmount: formData.paidAmount !== undefined ? formData.paidAmount : newTotal,
    });
  };

  const handleAddLineItem = () => {
    const currentLines = [...(formData.items || [])];
    const newLine: PurchaseLineItem = {
      id: `line-${Date.now()}-${currentLines.length + 1}`,
      item: '',
      unitType: '',
      quantity: 0,
      purchasePrice: 0,
      total: 0,
      notes: '',
    };
    const updated = [...currentLines, newLine];
    const newTotal = updated.reduce((sum, it) => sum + it.total, 0);
    setFormData({
      ...formData,
      items: updated,
      total: newTotal,
    });
  };

  const handleRemoveLineItem = (index: number) => {
    const currentLines = [...(formData.items || [])];
    if (currentLines.length <= 1) return;
    currentLines.splice(index, 1);
    const newTotal = currentLines.reduce((sum, it) => sum + it.total, 0);
    setFormData({
      ...formData,
      items: currentLines,
      total: newTotal,
    });
  };

  const livePreview = computePurchaseDerivedFields(formData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      const updated = computePurchaseDerivedFields({ ...formData, id: editingItem.id });
      onUpdatePurchase(updated);
    } else {
      const newItem = computePurchaseDerivedFields(formData);
      onAddPurchase(newItem);
    }
    setIsModalOpen(false);
  };

  // Supplier-specific analytics calculation
  const supplierSummaryMap = purchases.reduce((acc, p) => {
    const supp = (p.supplier || 'غير محدد').trim();
    if (!acc[supp]) {
      acc[supp] = {
        supplier: supp,
        supplierType: p.supplierType || 'مورد خامات ومستلزمات',
        totalPurchases: 0,
        totalPaid: 0,
        totalRemaining: 0,
        ordersCount: 0,
      };
    }
    acc[supp].totalPurchases += p.total;
    acc[supp].totalPaid += p.paidAmount;
    acc[supp].totalRemaining += p.remainingAmount;
    acc[supp].ordersCount += 1;
    return acc;
  }, {} as Record<string, { supplier: string; supplierType: string; totalPurchases: number; totalPaid: number; totalRemaining: number; ordersCount: number }>);

  const supplierList: SupplierSummary[] = (Object.values(supplierSummaryMap) as SupplierSummary[]).sort(
    (a, b) => b.totalRemaining - a.totalRemaining
  );

  // Purchases matching active date range
  const periodPurchases = React.useMemo(() => {
    return purchases.filter((p) => isDateWithinRange(p.date, startDate, endDate));
  }, [purchases, startDate, endDate]);

  // Payment methods breakdown for purchases
  const purchasePaymentBreakdown = React.useMemo(() => {
    let cashPaid = 0, cashCount = 0;
    let transferPaid = 0, transferCount = 0;
    let networkPaid = 0, networkCount = 0;
    let deferredRemaining = 0, deferredCount = 0;

    periodPurchases.forEach((p) => {
      const cat = normalizePaymentMethod(p.paymentMethod);
      const paid = p.paidAmount || 0;

      if (cat === 'CASH') {
        cashPaid += paid;
        cashCount++;
      } else if (cat === 'TRANSFER') {
        transferPaid += paid;
        transferCount++;
      } else if (cat === 'NETWORK') {
        networkPaid += paid;
        networkCount++;
      }

      if (p.remainingAmount > 0 || cat === 'DEFERRED') {
        deferredRemaining += p.remainingAmount || 0;
        deferredCount++;
      }
    });

    return {
      cashPaid,
      cashCount,
      transferPaid,
      transferCount,
      networkPaid,
      networkCount,
      deferredRemaining,
      deferredCount,
    };
  }, [periodPurchases]);

  // Filter & Sort logic
  const filteredPurchases = React.useMemo(() => {
    const list = purchases.filter((p) => {
      const matchesSearch =
        (p.item || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.supplierInvoiceNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPayment =
        filterPayment === 'ALL' ||
        (filterPayment === 'PAID' && p.paymentStatus.includes('✅')) ||
        (filterPayment === 'PARTIAL' && p.paymentStatus.includes('🟡')) ||
        (filterPayment === 'UNPAID' && p.paymentStatus.includes('🔴'));

      const matchesPayMethod = matchesPaymentMethodFilter(p.paymentMethod, filterPaymentMethod);

      const matchesSupplier =
        filterSupplier === 'ALL' || (p.supplier || '').trim() === filterSupplier.trim();

      const matchesSupplierType =
        filterSupplierType === 'ALL' ||
        (filterSupplierType === 'MATERIALS' && (p.supplierType || '').includes('خامات')) ||
        (filterSupplierType === 'SERVICES' && (p.supplierType || '').includes('خدمات'));

      const matchesTax =
        filterTax === 'ALL' ||
        (filterTax === 'TAX' && p.isTaxInvoice) ||
        (filterTax === 'STANDARD' && !p.isTaxInvoice);

      const matchesDate = isDateWithinRange(p.date, startDate, endDate);

      return matchesSearch && matchesPayment && matchesPayMethod && matchesSupplier && matchesSupplierType && matchesTax && matchesDate;
    });

    return list.sort((a, b) => {
      if (sortBy === 'NEWEST') {
        const d = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (d !== 0) return d;
        return (b.supplierInvoiceNo || '').localeCompare(a.supplierInvoiceNo || '');
      }
      if (sortBy === 'OLDEST') {
        const d = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (d !== 0) return d;
        return (a.supplierInvoiceNo || '').localeCompare(b.supplierInvoiceNo || '');
      }
      if (sortBy === 'AMOUNT_DESC') {
        return (b.total || 0) - (a.total || 0);
      }
      if (sortBy === 'AMOUNT_ASC') {
        return (a.total || 0) - (b.total || 0);
      }
      if (sortBy === 'SUPPLIER_ASC') {
        return (a.supplier || '').localeCompare(b.supplier || '', 'ar');
      }
      return 0;
    });
  }, [
    purchases,
    searchTerm,
    filterPayment,
    filterPaymentMethod,
    filterSupplier,
    filterSupplierType,
    filterTax,
    startDate,
    endDate,
    sortBy,
  ]);

  // Period totals calculation for the selected period
  const periodTotals = React.useMemo(() => {
    const total = filteredPurchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const paid = filteredPurchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const remaining = filteredPurchases.reduce((sum, p) => sum + (p.remainingAmount || 0), 0);
    const inputTax = filteredPurchases.reduce((sum, p) => sum + (p.taxAmount || 0), 0);
    return {
      total,
      paid,
      remaining,
      inputTax,
      count: filteredPurchases.length,
      taxableCount: filteredPurchases.filter((p) => p.isTaxInvoice).length,
    };
  }, [filteredPurchases]);

  const isFilterActive =
    filterPreset !== 'ALL' ||
    Boolean(selectedMonth) ||
    Boolean(selectedDate) ||
    Boolean(customStartDate) ||
    Boolean(customEndDate) ||
    filterSupplier !== 'ALL' ||
    filterSupplierType !== 'ALL' ||
    filterPayment !== 'ALL' ||
    filterPaymentMethod !== 'ALL' ||
    filterTax !== 'ALL' ||
    Boolean(searchTerm);

  const handleResetFilters = () => {
    setFilterPreset('ALL');
    setSelectedMonth('');
    setSelectedDate('');
    setCustomStartDate('');
    setCustomEndDate('');
    setFilterSupplier('ALL');
    setFilterSupplierType('ALL');
    setFilterPayment('ALL');
    setFilterPaymentMethod('ALL');
    setFilterTax('ALL');
    setSearchTerm('');
  };

  const totalPurchasesSum = filteredPurchases.reduce((sum, p) => sum + p.total, 0);
  const totalPaidSum = filteredPurchases.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalPayablesSum = filteredPurchases.reduce((sum, p) => sum + p.remainingAmount, 0);

  // Tax metrics for purchases
  const taxablePurchases = filteredPurchases.filter((p) => p.isTaxInvoice);
  const nonTaxablePurchases = filteredPurchases.filter((p) => !p.isTaxInvoice);
  const taxablePurchasesSubtotal = taxablePurchases.reduce(
    (sum, p) => sum + (p.subtotalBeforeTax || p.total),
    0
  );
  const taxablePurchasesInputTax = taxablePurchases.reduce((sum, p) => sum + (p.taxAmount || 0), 0);
  const nonTaxablePurchasesTotal = nonTaxablePurchases.reduce((sum, p) => sum + p.total, 0);

  // Selected supplier stats if filtered
  const selectedSupplierStats = filterSupplier !== 'ALL' ? supplierSummaryMap[filterSupplier] : null;

  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const activeFiltersCount = [
    filterSupplier !== 'ALL',
    filterSupplierType !== 'ALL',
    filterPayment !== 'ALL',
    filterPaymentMethod !== 'ALL',
    filterTax !== 'ALL',
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

      {/* Top Bar with Search & Filters - Compact & Spacious */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Expanded Search Input */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="بحث بالصنف، المورد، رقم الفاتورة أو الملاحظات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-11 pl-9 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/60 font-medium text-slate-900 transition placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Filter Drawer Toggle Button */}
            <button
              type="button"
              id="btn-toggle-purchases-filters"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-300 shadow-2xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              title="تصفية وفلاتر المشتريات"
            >
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>فلاتر المشتريات</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Sort Filter - Quick Compact Dropdown */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl px-2 py-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="select-filter-purchase-sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs py-1 bg-transparent border-none font-bold text-slate-800 cursor-pointer outline-none"
              >
                <option value="NEWEST">الأحدث أولاً</option>
                <option value="OLDEST">الأقدم أولاً</option>
                <option value="AMOUNT_DESC">الأعلى مبلغاً</option>
                <option value="AMOUNT_ASC">الأقل مبلغاً</option>
                <option value="SUPPLIER_ASC">اسم المورد (أ-ي)</option>
              </select>
            </div>

            {/* Toggle Summaries Button */}
            <button
              type="button"
              onClick={() => {
                setShowSummaries((prev) => {
                  const next = !prev;
                  localStorage.setItem('purchases_show_summaries', String(next));
                  return next;
                });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
              title={showSummaries ? 'إخفاء الإجماليات' : 'إظهار الإجماليات'}
            >
              {showSummaries ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden xl:inline">إخفاء الإجماليات</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden xl:inline">إظهار الإجماليات</span>
                </>
              )}
            </button>

            {/* Supplier Dues Quick Modal Button - Compact */}
            <button
              id="btn-supplier-dues-summary"
              onClick={() => setShowSupplierStatsModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200 transition cursor-pointer"
              title="عرض كشف حساب مستحقات جميع الموردين ومقارنتها"
            >
              <Coins className="w-3.5 h-3.5 text-purple-600" />
              <span>كشف الموردين ({supplierList.length})</span>
            </button>

            {/* Add Purchase Button - Hidden for Viewer */}
            {userRole !== 'viewer' && (
              <button
                id="btn-add-purchase"
                onClick={openAddModal}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.newPurchase}</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Detailed Filters Bar - Saves screen space */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs text-slate-600 animate-fadeIn">
            {/* Supplier Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">المورد:</span>
              <select
                id="select-filter-supplier"
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer max-w-[180px]"
              >
                <option value="ALL">جميع الموردين ({supplierList.length})</option>
                {supplierList.map((s) => (
                  <option key={s.supplier} value={s.supplier}>
                    {s.supplier} {s.totalRemaining > 0 ? `(متبقي: ${s.totalRemaining} ر.س)` : '✅'}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier Type Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">النوع:</span>
              <select
                id="select-filter-supplier-type"
                value={filterSupplierType}
                onChange={(e) => setFilterSupplierType(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">الكل</option>
                <option value="MATERIALS">📦 خامات</option>
                <option value="SERVICES">⚙️ خدمات تنفيذ</option>
              </select>
            </div>

            {/* Payment Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">السداد:</span>
              <select
                id="select-filter-purchase-payment"
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="PAID">✅ مسدد</option>
                <option value="PARTIAL">🟡 مسدد جزئي</option>
                <option value="UNPAID">🔴 غير مسدد</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">طريقة الدفع:</span>
              <select
                id="select-filter-purchase-payment-method"
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">💳 جميع الطرق</option>
                <option value="TRANSFER">🏦 تحويل بنكي</option>
                <option value="CASH">💵 كاش (نقد)</option>
                <option value="NETWORK">💳 شبكة</option>
                <option value="DEFERRED">⏳ آجل</option>
              </select>
            </div>

            {/* Tax Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="font-semibold text-slate-700">الضريبة:</span>
              <select
                id="select-filter-purchase-tax"
                value={filterTax}
                onChange={(e) => setFilterTax(e.target.value)}
                className="text-xs bg-transparent border-none font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">الكل</option>
                <option value="TAX">🧾 مع ضريبة (15%)</option>
                <option value="STANDARD">📄 بدون ضريبة (0%)</option>
              </select>
            </div>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1 cursor-pointer underline"
              >
                إعادة ضبط الفلاتر
              </button>
            )}
          </div>
        )}
      </div>

      {/* Date & Supplier Filter Bar (مثل لوحة التحكم) */}
      <DateFilterBar
        idPrefix="purchases-date-filter"
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
        totalCount={filteredPurchases.length}
        countLabel={isEn ? 'Purchase Invoices' : 'فاتورة شراء'}
        onReset={handleResetFilters}
        isFilterActive={isFilterActive}
        paymentMethodLabel={isEn ? 'Payment Method:' : 'طريقة الدفع:'}
        selectedPaymentMethod={filterPaymentMethod}
        onPaymentMethodChange={setFilterPaymentMethod}
        currentLang={currentLang}
      />

      {/* Period Totals Summary Cards */}
      {showSummaries && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">
            {isEn ? 'Period Purchases Total' : 'إجمالي مشتريات الفترة'}
          </span>
          <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">
            {periodTotals.total.toFixed(2)} <span className="text-xs font-sans text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{filterLabel}</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-xs">
          <span className="text-xs text-indigo-800 font-medium block">
            {isEn ? 'Paid to Suppliers' : 'المدفوع للموردين'}
          </span>
          <span className="text-base sm:text-lg font-bold text-indigo-700 font-mono">
            {periodTotals.paid.toFixed(2)} <span className="text-xs font-sans text-indigo-600">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-indigo-600 block mt-0.5">
            {isEn ? 'Paid Cash / Transfer' : 'مسدد نقداً / تحويل'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <span className="text-xs text-rose-800 font-medium block">
            {isEn ? 'Remaining to Suppliers' : 'المتبقي للموردين'}
          </span>
          <span
            className={`text-base sm:text-lg font-bold font-mono ${
              periodTotals.remaining > 0 ? 'text-rose-700' : 'text-slate-700'
            }`}
          >
            {periodTotals.remaining.toFixed(2)} <span className="text-xs font-sans text-rose-600">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-rose-600 block mt-0.5">
            {isEn ? 'Accounts Payable Due' : 'ذمم دائنة مستحقة السداد'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
          <span className="text-xs text-purple-800 font-medium block">
            {isEn ? 'Input VAT (15%)' : 'ضريبة المدخلات (15%)'}
          </span>
          <span className="text-base sm:text-lg font-bold text-purple-700 font-mono">
            {periodTotals.inputTax.toFixed(2)} <span className="text-xs font-sans text-purple-600">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-purple-600 block mt-0.5">
            {isEn ? `from ${periodTotals.taxableCount} tax invoices` : `من ${periodTotals.taxableCount} فاتورة ضريبية`}
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

      {/* Payment Method Breakdown & Quick Filter for Purchases */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <span>{isEn ? '💳 Supplier Payment Methods:' : '💳 طرق سداد المشتريات للموردين:'}</span>
          </span>
          {filterPaymentMethod !== 'ALL' && (
            <button
              onClick={() => setFilterPaymentMethod('ALL')}
              className="text-rose-600 hover:text-rose-700 font-bold text-[11px] cursor-pointer"
            >
              {isEn ? 'Clear Payment Filter ✕' : 'إلغاء تصفية الدفع ✕'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* Transfer */}
          <button
            type="button"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'TRANSFER' ? 'ALL' : 'TRANSFER')}
            className={`p-2.5 rounded-lg border text-right transition cursor-pointer flex flex-col justify-between ${
              filterPaymentMethod === 'TRANSFER'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-400'
                : 'bg-purple-50/40 hover:bg-purple-50/80 border-purple-200 text-slate-800'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <span className={`font-bold ${filterPaymentMethod === 'TRANSFER' ? 'text-white' : 'text-purple-900'}`}>
                {isEn ? '🏦 Bank Transfer' : '🏦 تحويل بنكي'}
              </span>
              <span className={`text-[10px] ${filterPaymentMethod === 'TRANSFER' ? 'text-purple-100' : 'text-slate-500'}`}>
                {purchasePaymentBreakdown.transferCount} {isEn ? 'invoices' : 'فواتير'}
              </span>
            </div>
            <span className="font-mono font-black text-sm sm:text-base mt-1">
              {purchasePaymentBreakdown.transferPaid.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}
            </span>
          </button>

          {/* Cash */}
          <button
            type="button"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'CASH' ? 'ALL' : 'CASH')}
            className={`p-2.5 rounded-lg border text-right transition cursor-pointer flex flex-col justify-between ${
              filterPaymentMethod === 'CASH'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-400'
                : 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200 text-slate-800'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <span className={`font-bold ${filterPaymentMethod === 'CASH' ? 'text-white' : 'text-emerald-900'}`}>
                {isEn ? '💵 Cash' : '💵 كاش (نقد)'}
              </span>
              <span className={`text-[10px] ${filterPaymentMethod === 'CASH' ? 'text-emerald-100' : 'text-slate-500'}`}>
                {purchasePaymentBreakdown.cashCount} {isEn ? 'invoices' : 'فواتير'}
              </span>
            </div>
            <span className="font-mono font-black text-sm sm:text-base mt-1">
              {purchasePaymentBreakdown.cashPaid.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}
            </span>
          </button>

          {/* Network */}
          <button
            type="button"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'NETWORK' ? 'ALL' : 'NETWORK')}
            className={`p-2.5 rounded-lg border text-right transition cursor-pointer flex flex-col justify-between ${
              filterPaymentMethod === 'NETWORK'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-400'
                : 'bg-sky-50/40 hover:bg-sky-50/80 border-sky-200 text-slate-800'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <span className={`font-bold ${filterPaymentMethod === 'NETWORK' ? 'text-white' : 'text-sky-900'}`}>
                {isEn ? '💳 Card' : '💳 شبكة'}
              </span>
              <span className={`text-[10px] ${filterPaymentMethod === 'NETWORK' ? 'text-sky-100' : 'text-slate-500'}`}>
                {purchasePaymentBreakdown.networkCount} {isEn ? 'invoices' : 'فواتير'}
              </span>
            </div>
            <span className="font-mono font-black text-sm sm:text-base mt-1">
              {purchasePaymentBreakdown.networkPaid.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}
            </span>
          </button>

          {/* Deferred */}
          <button
            type="button"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'DEFERRED' ? 'ALL' : 'DEFERRED')}
            className={`p-2.5 rounded-lg border text-right transition cursor-pointer flex flex-col justify-between ${
              filterPaymentMethod === 'DEFERRED'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-400'
                : 'bg-amber-50/40 hover:bg-amber-50/80 border-amber-200 text-slate-800'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <span className={`font-bold ${filterPaymentMethod === 'DEFERRED' ? 'text-white' : 'text-amber-900'}`}>
                {isEn ? '⏳ Deferred Supplier Payables' : '⏳ متبقي آجل للموردين'}
              </span>
              <span className={`text-[10px] ${filterPaymentMethod === 'DEFERRED' ? 'text-amber-100' : 'text-slate-500'}`}>
                {purchasePaymentBreakdown.deferredCount} {isEn ? 'due' : 'مستحق'}
              </span>
            </div>
            <span className="font-mono font-black text-sm sm:text-base mt-1">
              {purchasePaymentBreakdown.deferredRemaining.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}
            </span>
          </button>
        </div>
      </div>

      {/* Selected Supplier Dues Quick Card */}
      {selectedSupplierStats && (
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-purple-200">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm">{selectedSupplierStats.supplier}</h3>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full">
                  {selectedSupplierStats.supplierType}
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                إجمالي المعاملات: {selectedSupplierStats.ordersCount} فاتورة شراء
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs">
            <div className="bg-white/10 px-3 py-1.5 rounded-lg text-center">
              <span className="text-purple-200 block text-[11px]">إجمالي المشتريات</span>
              <strong className="text-sm font-bold">{selectedSupplierStats.totalPurchases.toFixed(2)} ر.س</strong>
            </div>
            <div className="bg-white/10 px-3 py-1.5 rounded-lg text-center">
              <span className="text-purple-200 block text-[11px]">المدفوع له</span>
              <strong className="text-sm font-bold text-emerald-300">{selectedSupplierStats.totalPaid.toFixed(2)} ر.س</strong>
            </div>
            <div className="bg-amber-400/20 border border-amber-400/40 px-3.5 py-1.5 rounded-lg text-center">
              <span className="text-amber-200 block text-[11px]">المستحقات المتبقية له</span>
              <strong className="text-base font-black text-amber-300">
                {selectedSupplierStats.totalRemaining.toFixed(2)} ر.س
              </strong>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Purchases Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              {isEn ? 'Purchases & Supplies Ledger' : 'سجل المشتريات وتوريد الخامات والخدمات'}
            </span>
            <span className="bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full text-[11px]">
              {filteredPurchases.length} {isEn ? 'invoices' : 'فاتورة'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span>
              {isEn ? 'Total Purchases:' : 'إجمالي المشتريات:'} <strong className="text-slate-900">{totalPurchasesSum.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}</strong>
            </span>
            <span>
              {isEn ? 'Paid:' : 'المدفوع:'} <strong className="text-emerald-700">{totalPaidSum.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}</strong>
            </span>
            <span>
              {isEn ? 'Supplier Payables:' : 'مستحقات الموردين:'} <strong className="text-purple-700">{totalPayablesSum.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse min-w-[1150px]">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 text-[11px] font-bold select-none">
                <th className="p-2.5 w-8 text-center">#</th>
                <th className="p-2.5">{isEn ? 'Date' : 'التاريخ'}</th>
                <th className="p-2.5">{isEn ? 'Invoice #' : 'رقم الفاتورة'}</th>
                <th className="p-2.5">{isEn ? 'Supplier & Type' : 'المورد والنوع'}</th>
                <th className="p-2.5">{isEn ? 'Purchased Items / Services' : 'الأصناف / الخدمات المشتراة'}</th>
                <th className="p-2.5 text-center">{isEn ? 'Qty' : 'الكمية'}</th>
                <th className="p-2.5">{isEn ? 'Unit Price' : 'سعر الوحدة'}</th>
                <th className="p-2.5 font-extrabold bg-indigo-50 text-indigo-900">{isEn ? 'Total' : 'الإجمالي'}</th>
                <th className="p-2.5">{isEn ? 'Payment Method' : 'طريقة الدفع'}</th>
                <th className="p-2.5">{isEn ? 'Paid' : 'المدفوع'}</th>
                <th className="p-2.5 text-purple-700 font-bold">{isEn ? 'Remaining' : 'المتبقي (المستحق)'}</th>
                <th className="p-2.5 text-center">{isEn ? 'Payment Status' : 'حالة السداد'}</th>
                <th className="p-2.5">{isEn ? 'Notes' : 'الملاحظات'}</th>
                <th className="p-2.5 text-center sticky left-0 bg-slate-100">{isEn ? 'Actions' : 'إجراءات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    {isEn ? 'No purchase invoices match filter options' : 'لا توجد فواتير مشتريات مطابقة لخيارات الفلترة'}
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((item, idx) => {
                  const isExpanded = expandedInvoiceId === item.id;
                  const hasMultiItems = item.items && item.items.length > 1;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">{item.date}</td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-800">
                              {item.supplierInvoiceNo || '—'}
                            </span>
                            {item.isTaxInvoice ? (
                              <span
                                className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold inline-flex items-center gap-0.5"
                                title={`فاتورة ضريبية 15% | قبل الضريبة: ${(item.subtotalBeforeTax || item.total).toFixed(2)} ر.س | الضريبة: ${(item.taxAmount || 0).toFixed(2)} ر.س ${item.supplierVatNumber ? `| الرقم الضريبي: ${item.supplierVatNumber}` : ''}`}
                              >
                                <span>🧾 ضريبية 15%</span>
                              </span>
                            ) : (
                              <span
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium"
                                title="مشتريات بدون احتساب ضريبة (0%)"
                              >
                                📄 بدون ضريبة
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{item.supplier || 'مورد عام'}</div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                            {item.supplierType?.includes('خدمات') ? (
                              <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 flex items-center gap-0.5">
                                <Wrench className="w-2.5 h-2.5" />
                                {item.supplierType}
                              </span>
                            ) : (
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 flex items-center gap-0.5">
                                <ShoppingBag className="w-2.5 h-2.5" />
                                {item.supplierType || 'مورد خامات'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{item.item}</span>
                            {hasMultiItems && (
                              <button
                                type="button"
                                onClick={() => setExpandedInvoiceId(isExpanded ? null : item.id)}
                                className="inline-flex items-center gap-0.5 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 transition"
                              >
                                <span>{item.items?.length} بنود</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{item.unitType}</div>
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-800">{item.quantity}</td>
                        <td className="p-2.5 font-mono text-slate-800">{item.purchasePrice.toFixed(2)}</td>
                        <td className="p-2.5 font-mono">
                          <div className="font-extrabold text-indigo-950 bg-indigo-50/70 px-1.5 py-0.5 rounded inline-block">
                            {item.total.toFixed(2)}
                          </div>
                          {item.isTaxInvoice ? (
                            <div className="text-[10px] text-indigo-700 font-semibold mt-0.5" title={`شامل ضريبة 15% بقيمة ${(item.taxAmount || 0).toFixed(2)} ر.س`}>
                              ضريبة: {(item.taxAmount || 0).toFixed(2)}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 mt-0.5">0% بدون ضريبة</div>
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {(() => {
                            const details = getPaymentMethodDetails(item.paymentMethod);
                            const isSelected = filterPaymentMethod === details.category;
                            return (
                              <button
                                type="button"
                                onClick={() => setFilterPaymentMethod(isSelected ? 'ALL' : details.category)}
                                title={`تصفية المشتريات حسب: ${details.label}`}
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
                        <td className="p-2.5 font-mono text-slate-800">{item.paidAmount.toFixed(2)}</td>
                        <td className="p-2.5 font-mono font-bold text-purple-700">
                          {item.remainingAmount.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              item.paymentStatus.includes('✅')
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.paymentStatus.includes('🟡')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.paymentStatus}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 max-w-[160px] truncate" title={item.notes || ''}>
                          {item.notes ? (
                            <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{item.notes}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap sticky left-0 bg-white/95 shadow-sm">
                          {userRole === 'viewer' ? (
                            <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded">
                              {currentLang === 'en' ? 'View Only' : 'مشاهدة فقط'}
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditModal(item)}
                                title="تعديل"
                                className="p-1 rounded text-slate-600 hover:text-indigo-700 hover:bg-indigo-50"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(item.id)}
                                title="حذف"
                                className="p-1 rounded text-slate-600 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Multi-items Expanded Row */}
                      {isExpanded && item.items && item.items.length > 0 && (
                        <tr className="bg-indigo-50/40">
                          <td colSpan={14} className="p-3 pr-12">
                            <div className="bg-white rounded-lg p-3 border border-indigo-200 shadow-xs space-y-3">
                              <div className="flex items-center justify-between text-xs font-bold text-indigo-900 border-b border-indigo-100 pb-1.5 flex-wrap gap-2">
                                <span>تفاصيل الأصناف والخدمات في هذه الفاتورة ({item.items.length} بنود):</span>
                                <span>المورد: {item.supplier}</span>
                              </div>
                              <table className="w-full text-right text-xs">
                                <thead>
                                  <tr className="text-slate-500 border-b border-slate-100">
                                    <th className="py-1">#</th>
                                    <th className="py-1">الصنف / الخدمة</th>
                                    <th className="py-1">الوحدة</th>
                                    <th className="py-1 text-center">الكمية</th>
                                    <th className="py-1">السعر</th>
                                    <th className="py-1">الإجمالي</th>
                                    <th className="py-1">ملاحظة البند</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.items.map((line, lIdx) => (
                                    <tr key={line.id || lIdx} className="border-b border-slate-50 text-slate-700">
                                      <td className="py-1 font-mono text-slate-400">{lIdx + 1}</td>
                                      <td className="py-1 font-bold">{line.item}</td>
                                      <td className="py-1 text-slate-500">{line.unitType}</td>
                                      <td className="py-1 text-center font-bold">{line.quantity}</td>
                                      <td className="py-1 font-mono">{line.purchasePrice.toFixed(2)} ر.س</td>
                                      <td className="py-1 font-mono font-bold text-indigo-900">{line.total.toFixed(2)} ر.س</td>
                                      <td className="py-1 text-slate-500 text-[11px]">{line.notes || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {/* Invoice Tax Details Summary */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-100 text-xs text-slate-600 bg-slate-50/70 p-2 rounded-md">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span>
                                    نوع الفاتورة:{' '}
                                    <strong className="text-indigo-900 font-bold">
                                      {item.isTaxInvoice ? '🧾 فاتورة ضريبية' : '📄 بدون ضريبة'}
                                    </strong>
                                  </span>
                                  {item.isTaxInvoice && item.supplierVatNumber && (
                                    <span>
                                      الرقم الضريبي للمورد:{' '}
                                      <strong className="font-mono text-slate-800 font-bold">
                                        {item.supplierVatNumber}
                                      </strong>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 font-mono text-xs flex-wrap">
                                  {item.isTaxInvoice ? (
                                    <>
                                      <span>
                                        قبل الضريبة:{' '}
                                        <strong className="text-slate-800">
                                          {(item.subtotalBeforeTax || item.total).toFixed(2)} ر.س
                                        </strong>
                                      </span>
                                      <span>
                                        الضريبة (15%):{' '}
                                        <strong className="text-indigo-700 font-bold">
                                          {(item.taxAmount || 0).toFixed(2)} ر.س
                                        </strong>
                                      </span>
                                      <span>
                                        الإجمالي شامل الضريبة:{' '}
                                        <strong className="text-indigo-950 font-black">
                                          {item.total.toFixed(2)} ر.س
                                        </strong>
                                      </span>
                                    </>
                                  ) : (
                                    <span>
                                      الإجمالي الكلي (بدون ضريبة):{' '}
                                      <strong className="text-slate-900 font-black">
                                        {item.total.toFixed(2)} ر.س
                                      </strong>
                                    </span>
                                  )}
                                </div>
                              </div>
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

      {/* Supplier Payables Breakdown Modal */}
      {showSupplierStatsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-purple-200" />
                <div>
                  <h3 className="font-bold text-base">كشف حساب مستحقات الموردين</h3>
                  <p className="text-xs text-purple-200">
                    متابعة ديون ومستحقات كل مورد (خامات وخدمات وتنفيذ خارجي)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSupplierStatsModal(false)}
                className="text-purple-200 hover:text-white p-1 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3 overscroll-contain">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">إجمالي مشتريات كل الموردين</span>
                  <strong className="text-slate-900 text-sm">{purchases.reduce((s, p) => s + p.total, 0).toFixed(2)} ر.س</strong>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <span className="text-emerald-700 block text-[11px]">إجمالي المسدد لهم</span>
                  <strong className="text-emerald-800 text-sm">{purchases.reduce((s, p) => s + p.paidAmount, 0).toFixed(2)} ر.س</strong>
                </div>
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                  <span className="text-purple-700 block text-[11px]">إجمالي المستحقات المتبقية</span>
                  <strong className="text-purple-900 text-sm font-black">
                    {purchases.reduce((s, p) => s + p.remainingAmount, 0).toFixed(2)} ر.س
                  </strong>
                </div>
              </div>

              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold">
                    <th className="p-2.5">المورد</th>
                    <th className="p-2.5">النوع</th>
                    <th className="p-2.5 text-center">عدد الفواتير</th>
                    <th className="p-2.5">إجمالي المشتريات</th>
                    <th className="p-2.5">المدفوع</th>
                    <th className="p-2.5 text-purple-700 font-black">المستحقات المتبقية</th>
                    <th className="p-2.5 text-center">تصفية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierList.map((sup) => (
                    <tr key={sup.supplier} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{sup.supplier}</td>
                      <td className="p-2.5 text-[11px] text-slate-500">{sup.supplierType}</td>
                      <td className="p-2.5 text-center font-mono">{sup.ordersCount}</td>
                      <td className="p-2.5 font-mono">{sup.totalPurchases.toFixed(2)} ر.س</td>
                      <td className="p-2.5 font-mono text-emerald-700">{sup.totalPaid.toFixed(2)} ر.س</td>
                      <td className="p-2.5 font-mono font-bold text-purple-700">
                        {sup.totalRemaining > 0 ? (
                          <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded font-black">
                            {sup.totalRemaining.toFixed(2)} ر.س
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">✅ مسدد</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => {
                            setFilterSupplier(sup.supplier);
                            setShowSupplierStatsModal(false);
                          }}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-bold"
                        >
                          عرض فواتيره ←
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Purchase with Multiple Line Items Support */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] my-auto">
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base">
                  {editingItem ? 'تعديل فاتورة مشتريات' : 'تسجيل فاتورة مشتريات من مورد (خامات أو خدمات)'}
                </h3>
                <p className="text-xs text-indigo-200">
                  يمكنك إضافة أكثر من منتج أو خدمة من نفس المورد مع الملاحظات
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

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col overscroll-contain">
              <div className="p-5 space-y-4 flex-1">
                {/* Section 1: General & Supplier Info */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">بيانات المورد والفاتورة:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">التاريخ</label>
                    <input
                      type="date"
                      value={formData.date || ''}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">رقم فاتورة المورد</label>
                    <input
                      type="text"
                      value={formData.supplierInvoiceNo || ''}
                      onChange={(e) => setFormData({ ...formData, supplierInvoiceNo: e.target.value })}
                      placeholder="مثال: SUP-8821"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">نوع المورد</label>
                    <EditableSelect
                      id="purchase-supplier-type"
                      value={formData.supplierType || ''}
                      onChange={(val) => setFormData({ ...formData, supplierType: val })}
                      options={SUPPLIER_TYPES}
                      storageKey="supplier_types"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      اسم المورد (اختر أو اكتب يدوياً)
                    </label>
                    <EditableSelect
                      id="purchase-supplier-name"
                      value={formData.supplier || ''}
                      onChange={(val) => setFormData({ ...formData, supplier: val })}
                      options={existingSuppliers.length > 0 ? existingSuppliers : ['مؤسسة الخامات المتقدمة', 'مطابع النخبة للأوفست', 'ورشة الليزر والنيون']}
                      storageKey="suppliers_list"
                      placeholder="اختر أو اكتب اسم المورد..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ملاحظات على الفاتورة ككل (يدوياً)
                    </label>
                    <input
                      type="text"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="مثال: توريد دفعة الصباح، تم الاستلام في المستودع..."
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Multiple Line Items from Supplier */}
              <div className="border border-indigo-200 rounded-xl p-3.5 bg-indigo-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <PackagePlus className="w-4 h-4 text-indigo-700" />
                    <span className="text-xs font-bold text-indigo-950">
                      الأصناف والخدمات المشتراة من هذا المورد ({formData.items?.length || 1})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة منتج / خدمة أخرى +</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {(formData.items || []).map((lineItem, index) => (
                    <div
                      key={lineItem.id || index}
                      className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs space-y-2 relative"
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
                            الصنف / الخدمة
                          </label>
                          <EditableSelect
                            value={lineItem.item}
                            onChange={(val) => handleUpdateLineItem(index, { item: val })}
                            options={PURCHASE_ITEMS}
                            storageKey="purchase_items"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            نوع القياس
                          </label>
                          <EditableSelect
                            value={lineItem.unitType}
                            onChange={(val) => handleUpdateLineItem(index, { unitType: val })}
                            options={PURCHASE_UNIT_TYPES}
                            storageKey="purchase_units"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
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
                              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">السعر</label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="0.00"
                              value={lineItem.purchasePrice === 0 ? '' : lineItem.purchasePrice}
                              onChange={(e) =>
                                handleUpdateLineItem(index, {
                                  purchasePrice: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center pt-1 text-xs">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            placeholder="ملاحظات خاصة بهذا الصنف/الخدمة (اختياري)..."
                            value={lineItem.notes || ''}
                            onChange={(e) => handleUpdateLineItem(index, { notes: e.target.value })}
                            className="w-full text-[11px] p-1.5 rounded-lg border border-slate-200 text-slate-600 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="text-left font-mono text-xs font-bold text-indigo-900 bg-indigo-50/70 p-1.5 rounded-lg">
                          الإجمالي: {lineItem.total.toFixed(2)} ر.س
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2.5: Tax Settings (ضريبية أو بدون ضريبة) */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="checkbox-purchase-is-tax"
                      checked={Boolean(formData.isTaxInvoice)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({
                          ...formData,
                          isTaxInvoice: checked,
                          taxRate: checked ? formData.taxRate || 15 : 0,
                        });
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>فاتورة مشتريات خاضعة للضريبة (مع احتساب ضريبة القيمة المضافة)</span>
                  </label>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      formData.isTaxInvoice
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {formData.isTaxInvoice ? '🧾 خاضعة للضريبة 15%' : '📄 مشتريات بدون ضريبة (0%)'}
                  </span>
                </div>

                {formData.isTaxInvoice && (
                  <div className="pt-2.5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        الرقم الضريبي للمورد (اختياري / 15 رقم)
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        placeholder="3xxxxxxxxxxxxxx3"
                        value={formData.supplierVatNumber || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, supplierVatNumber: e.target.value })
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        نسبة الضريبة (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.taxRate ?? 15}
                        onChange={(e) =>
                          setFormData({ ...formData, taxRate: Number(e.target.value) || 0 })
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Payment & Dues */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">طريقة الدفع</label>
                  <EditableSelect
                    id="purchase-payment-method"
                    value={formData.paymentMethod || ''}
                    onChange={(val) => setFormData({ ...formData, paymentMethod: val })}
                    options={PURCHASE_PAYMENT_METHODS}
                    storageKey="purchase_payment_methods"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ المدفوع للمورد</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.paidAmount ?? 0}
                    onChange={(e) =>
                      setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                  />
                </div>
              </div>

              {/* Summary Bar */}
              <div className="flex flex-wrap items-center justify-between text-xs bg-indigo-50 p-3 rounded-xl text-indigo-950 border border-indigo-200 gap-2">
                {formData.isTaxInvoice ? (
                  <>
                    <span>
                      قبل الضريبة: <strong>{(livePreview.subtotalBeforeTax || 0).toFixed(2)} ر.س</strong>
                    </span>
                    <span>
                      الضريبة ({livePreview.taxRate || 15}%):{' '}
                      <strong className="text-indigo-700 font-bold">
                        {(livePreview.taxAmount || 0).toFixed(2)} ر.س
                      </strong>
                    </span>
                    <span>
                      الإجمالي النهائي:{' '}
                      <strong className="text-indigo-950 text-sm font-black">
                        {livePreview.total.toFixed(2)} ر.س
                      </strong>
                    </span>
                  </>
                ) : (
                  <span>
                    إجمالي الفاتورة (بدون ضريبة):{' '}
                    <strong className="text-slate-900 text-sm font-black">
                      {livePreview.total.toFixed(2)} ر.س
                    </strong>
                  </span>
                )}
                <span>
                  المدفوع: <strong>{(formData.paidAmount || 0).toFixed(2)} ر.س</strong>
                </span>
                <span>
                  المستحق للمورد:{' '}
                  <strong className="text-purple-700 font-bold">
                    {livePreview.remainingAmount.toFixed(2)} ر.س
                  </strong>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                    livePreview.paymentStatus.includes('✅')
                      ? 'bg-emerald-100 text-emerald-800'
                      : livePreview.paymentStatus.includes('🟡')
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {livePreview.paymentStatus}
                </span>
              </div>

              </div>

              {/* Form Action Buttons Sticky Footer */}
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
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  حفظ الفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900">تأكيد حذف فاتورة المشتريات</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إعادة حساب إجمالي المشتريات والمستحقات للموردين تلقائياً.
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
                  onDeletePurchase(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                نعم، احذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
