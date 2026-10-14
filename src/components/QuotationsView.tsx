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
  FileText,
  ChevronDown,
  ChevronUp,
  PackagePlus,
  ArrowRightLeft,
  XCircle,
  Building2,
  Sparkles,
  Lock,
  History,
  Eye,
  EyeOff,
  ArrowUpDown,
} from 'lucide-react';
import {
  QuotationItem,
  QuotationLineItem,
  QuotationStatus,
  SERVICE_TYPES,
  SALES_UNIT_TYPES,
  AgencySettings,
  UserRole,
} from '../types';
import { computeQuotationDerivedFields, DEFAULT_AGENCY_SETTINGS } from '../lib/dataStore';
import { getTranslations } from '../lib/translations';
import { EditableSelect } from './EditableSelect';
import { AuditTimelineModal } from './AuditTimelineModal';

interface QuotationsViewProps {
  quotations: QuotationItem[];
  agencySettings?: AgencySettings;
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  onAddQuotation: (quotation: QuotationItem) => void;
  onUpdateQuotation: (quotation: QuotationItem) => void;
  onDeleteQuotation: (id: string) => void;
  onPrintQuotation: (quotation: QuotationItem) => void;
  onConvertQuotationToSale: (quotation: QuotationItem) => void;
}

export const QuotationsView: React.FC<QuotationsViewProps> = ({
  quotations,
  agencySettings = DEFAULT_AGENCY_SETTINGS,
  userRole = 'owner',
  currentLang = (agencySettings.userProfile?.language || agencySettings.appLanguage || 'ar') as 'ar' | 'en',
  onAddQuotation,
  onUpdateQuotation,
  onDeleteQuotation,
  onPrintQuotation,
  onConvertQuotationToSale,
}) => {
  const t = getTranslations(currentLang);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<QuotationItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [selectedQuoteForTimeline, setSelectedQuoteForTimeline] = useState<QuotationItem | null>(null);
  const [showAllTimelineModal, setShowAllTimelineModal] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'AMOUNT_ASC' | 'CUSTOMER_ASC'>('NEWEST');
  const [showSummaries, setShowSummaries] = useState<boolean>(() => {
    return localStorage.getItem('quotations_show_summaries') !== 'false';
  });

  // Available sales channels for quotations
  const availableChannels = React.useMemo(() => {
    const set = new Set<string>();
    ['المحل المباشر', 'المتجر الإلكتروني', 'مندوب / مسوق', 'سوشل ميديا (واتساب/إنستغرام)'].forEach((c) =>
      set.add(c)
    );
    quotations.forEach((q) => {
      if (q.revenueSource && q.revenueSource.trim()) {
        set.add(q.revenueSource.trim());
      }
    });
    return Array.from(set);
  }, [quotations]);

  // Form State: strictly EMPTY by default per user rule
  const [formData, setFormData] = useState<Partial<QuotationItem>>({
    customerName: '',
    customerPhone: '',
    customerCompany: '',
    customerEmail: '',
    customerVatNumber: '',
    issueDate: new Date().toISOString().split('T')[0],
    validityDays: '',
    status: 'بانتظار الاعتماد',
    discount: 0,
    discountType: 'amount',
    discountPercent: 0,
    isTaxIncluded: true,
    paymentTerms: '',
    executionDays: '',
    notes: '',
    includeCustomerApproval: false,
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

  const openAddModal = () => {
    setEditingQuotation(null);
    setFormData({
      customerName: '',
      customerPhone: '',
      customerCompany: '',
      customerEmail: '',
      customerVatNumber: '',
      revenueSource: 'المحل المباشر',
      issueDate: new Date().toISOString().split('T')[0],
      validityDays: '',
      status: 'بانتظار الاعتماد',
      discount: 0,
      discountType: 'amount',
      discountPercent: 0,
      isTaxIncluded: true,
      paymentTerms: '',
      executionDays: '',
      notes: '',
      includeCustomerApproval: false,
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

  const openEditModal = (quote: QuotationItem) => {
    setEditingQuotation(quote);
    setFormData({
      ...quote,
      items:
        quote.items && quote.items.length > 0
          ? [...quote.items]
          : [
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

  const handleLineItemChange = (
    index: number,
    updatedFields: Partial<QuotationLineItem>
  ) => {
    const currentLines = [...(formData.items || [])];
    const target = currentLines[index] || {
      id: `line-${Date.now()}-${index}`,
      serviceType: '',
      specifications: '',
      quantity: 0,
      unitType: '',
      unitPrice: 0,
      itemTotal: 0,
    };

    const newQuantity =
      updatedFields.quantity !== undefined
        ? Number(updatedFields.quantity) || 0
        : target.quantity;
    const newPrice =
      updatedFields.unitPrice !== undefined
        ? Number(updatedFields.unitPrice) || 0
        : target.unitPrice;

    currentLines[index] = {
      ...target,
      ...updatedFields,
      quantity: newQuantity,
      unitPrice: newPrice,
      itemTotal: Number((newQuantity * newPrice).toFixed(2)),
    };

    setFormData({
      ...formData,
      items: currentLines,
    });
  };

  const handleAddLineItem = () => {
    const currentLines = [...(formData.items || [])];
    currentLines.push({
      id: `line-${Date.now()}-${currentLines.length + 1}`,
      serviceType: '',
      specifications: '',
      quantity: 0,
      unitType: '',
      unitPrice: 0,
      itemTotal: 0,
    });
    setFormData({
      ...formData,
      items: currentLines,
    });
  };

  const handleRemoveLineItem = (index: number) => {
    const currentLines = [...(formData.items || [])];
    if (currentLines.length <= 1) return;
    currentLines.splice(index, 1);
    setFormData({
      ...formData,
      items: currentLines,
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) {
      alert('يرجى كتابة اسم العميل');
      return;
    }

    if (editingQuotation) {
      const updated = computeQuotationDerivedFields(
        { ...formData, id: editingQuotation.id, quotationNo: editingQuotation.quotationNo },
        quotations.findIndex((q) => q.id === editingQuotation.id)
      );
      onUpdateQuotation(updated);
    } else {
      const newQuote = computeQuotationDerivedFields(formData, quotations.length);
      onAddQuotation(newQuote);
    }
    setIsModalOpen(false);
  };

  // Filter & Sort logic
  const filteredQuotations = React.useMemo(() => {
    const list = quotations.filter((item) => {
      const matchesSearch =
        (item.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customerPhone || '').includes(searchTerm) ||
        (item.customerCompany || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.quotationNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;
      const matchesChannel = filterChannel === 'ALL' || (item.revenueSource || '') === filterChannel;
      return matchesSearch && matchesStatus && matchesChannel;
    });

    return list.sort((a, b) => {
      if (sortBy === 'NEWEST') {
        const d = new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
        if (d !== 0) return d;
        return (b.quotationNo || '').localeCompare(a.quotationNo || '');
      }
      if (sortBy === 'OLDEST') {
        const d = new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime();
        if (d !== 0) return d;
        return (a.quotationNo || '').localeCompare(b.quotationNo || '');
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
  }, [quotations, searchTerm, filterStatus, filterChannel, sortBy]);

  // KPI Metrics
  const totalCount = quotations.length;
  const pendingCount = quotations.filter((q) => q.status === 'بانتظار الاعتماد').length;
  const approvedCount = quotations.filter((q) => q.status === 'معتمد ومحول لطلب').length;
  const totalValue = quotations.reduce((sum, q) => sum + (q.netTotal || 0), 0);

  return (
    <div className="space-y-4">
      {/* Viewer Mode Notice */}
      {userRole === 'viewer' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-bold shadow-xs">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{t.viewerReadOnlyNotice}</span>
        </div>
      )}

      {/* Top Metrics Cards */}
      {showSummaries && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 font-medium">
              {currentLang === 'en' ? 'Total Quotations' : 'إجمالي عروض الأسعار'}
            </div>
            <div className="text-xl font-black text-slate-900 mt-1 font-mono">{totalCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {currentLang === 'en' ? 'Submitted quotes ledger' : 'سجل العروض المقدمة'}
            </div>
          </div>

          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 shadow-xs">
            <div className="text-xs text-amber-800 font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>{currentLang === 'en' ? 'Pending Approval' : 'بانتظار الاعتماد'}</span>
            </div>
            <div className="text-xl font-black text-amber-900 mt-1 font-mono">{pendingCount}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              {currentLang === 'en' ? 'Awaiting client approval' : 'قبل اعتماد العميل للطلب'}
            </div>
          </div>

          <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 shadow-xs">
            <div className="text-xs text-emerald-800 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{currentLang === 'en' ? 'Approved & Converted' : 'معتمدة ومحولة لطلبات'}</span>
            </div>
            <div className="text-xl font-black text-emerald-900 mt-1 font-mono">{approvedCount}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              {currentLang === 'en' ? 'Approved & moved to execution' : 'تم اعتمادها ونقلها للتنفيذ'}
            </div>
          </div>

          <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-xs">
            <div className="text-xs text-slate-400 font-medium">
              {currentLang === 'en' ? 'Total Value' : 'القيمة المالية الإجمالية'}
            </div>
            <div className="text-xl font-black text-emerald-400 mt-1 font-mono">
              {totalValue.toLocaleString(currentLang === 'en' ? 'en-US' : 'ar-SA', { minimumFractionDigits: 2 })} {currentLang === 'en' ? 'SAR' : 'ر.س'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {currentLang === 'en' ? 'All recorded quotes' : 'لكافة العروض المسجلة'}
            </div>
          </div>
        </div>
      )}

      {/* Top Search & Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className={`w-4 h-4 text-slate-400 absolute ${currentLang === 'en' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 pointer-events-none`} />
          <input
            id="input-quotations-search"
            type="text"
            placeholder={currentLang === 'en' ? 'Search by quote #, customer, company, phone...' : 'بحث برقم عرض السعر، اسم العميل، الشركة، الجوال...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${currentLang === 'en' ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500`}
          />
        </div>

        {/* Filter & Action */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentLang === 'en' ? 'Status:' : 'الحالة:'}</span>
            <select
              id="select-filter-quote-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs py-1.5 px-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="ALL">{currentLang === 'en' ? 'All Quotations' : 'جميع العروض'}</option>
              <option value="بانتظار الاعتماد">🟡 {currentLang === 'en' ? 'Pending Approval' : 'بانتظار الاعتماد'}</option>
              <option value="معتمد ومحول لطلب">🟢 {currentLang === 'en' ? 'Approved & Converted' : 'معتمد ومحول لطلب'}</option>
              <option value="مرفوض">🔴 {currentLang === 'en' ? 'Rejected' : 'مرفوض'}</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>{currentLang === 'en' ? 'Channel:' : 'القناة:'}</span>
            <select
              id="select-filter-quote-channel"
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="text-xs py-1.5 px-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="ALL">{currentLang === 'en' ? 'All Channels' : 'جميع القنوات'}</option>
              {availableChannels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter - Default: Newest first */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentLang === 'en' ? 'Sort:' : 'ترتيب:'}</span>
            <select
              id="select-quote-sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
            >
              <option value="NEWEST">{currentLang === 'en' ? 'Newest First' : 'الأحدث أولاً (تلقائي)'}</option>
              <option value="OLDEST">{currentLang === 'en' ? 'Oldest First' : 'الأقدم أولاً'}</option>
              <option value="AMOUNT_DESC">{currentLang === 'en' ? 'Highest Amount' : 'الأعلى مبلغاً'}</option>
              <option value="AMOUNT_ASC">{currentLang === 'en' ? 'Lowest Amount' : 'الأقل مبلغاً'}</option>
              <option value="CUSTOMER_ASC">{currentLang === 'en' ? 'Customer Name (A-Z)' : 'اسم العميل (أ - ي)'}</option>
            </select>
          </div>

          {/* Toggle Summaries Button */}
          <button
            type="button"
            onClick={() => {
              setShowSummaries((prev) => {
                const next = !prev;
                localStorage.setItem('quotations_show_summaries', String(next));
                return next;
              });
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
            title={showSummaries ? (currentLang === 'en' ? 'Hide KPI' : 'إخفاء الإجماليات') : (currentLang === 'en' ? 'Show KPI' : 'إظهار الإجماليات')}
          >
            {showSummaries ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{currentLang === 'en' ? 'Hide KPI' : 'إخفاء الإجماليات'}</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{currentLang === 'en' ? 'Show KPI' : 'إظهار الإجماليات'}</span>
              </>
            )}
          </button>

          {userRole !== 'viewer' && (
            <button
              id="btn-add-new-quotation"
              type="button"
              onClick={openAddModal}
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.newQuotation}</span>
            </button>
          )}
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 whitespace-nowrap">
                <th className="p-2.5 font-bold text-center w-10">#</th>
                <th className="p-2.5 font-bold">{t.quoteNo}</th>
                <th className="p-2.5 font-bold">{t.customerName}</th>
                <th className="p-2.5 font-bold">{t.customerPhone}</th>
                <th className="p-2.5 font-bold">{t.quoteDate}</th>
                <th className="p-2.5 font-bold text-rose-700">{t.expiryDate}</th>
                <th className="p-2.5 font-bold">{currentLang === 'en' ? 'Items & Services' : 'البنود والخدمات'}</th>
                <th className="p-2.5 font-bold font-mono">{currentLang === 'en' ? 'Subtotal' : 'الإجمالي قبل الخصم'}</th>
                <th className="p-2.5 font-bold font-mono text-rose-600">{t.discount}</th>
                <th className="p-2.5 font-bold font-mono bg-amber-50 text-amber-950">{t.net}</th>
                <th className="p-2.5 font-bold text-center">{t.quoteStatus}</th>
                <th className="p-2.5 font-bold">{t.notes}</th>
                <th className="p-2.5 font-bold text-center sticky left-0 bg-slate-100 shadow-sm">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    لا توجد عروض أسعار مطابقة لمعايير البحث
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quote, idx) => {
                  const isExpanded = expandedQuoteId === quote.id;
                  const hasMultiItems = quote.items && quote.items.length > 0;

                  return (
                    <React.Fragment key={quote.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPrintQuotation(quote);
                            }}
                            className="font-mono font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2 py-1 rounded-md text-xs inline-flex items-center gap-1 cursor-pointer shadow-2xs transition"
                            title="اضغط لمعاينة وطباعة وتصدير عرض السعر"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{quote.quotationNo}</span>
                          </button>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                          <div>
                            <span>{quote.customerName}</span>
                            {quote.customerCompany && (
                              <div className="text-[11px] font-normal text-slate-500">
                                {quote.customerCompany}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                          {quote.customerPhone || '—'}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                          {quote.issueDate}
                        </td>
                        <td className="p-2.5 font-mono text-rose-700 font-semibold whitespace-nowrap">
                          {quote.expiryDate}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-700 font-medium">
                              {quote.items?.[0]?.serviceType || 'خدمات متنوعة'}
                            </span>
                            {hasMultiItems && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedQuoteId(isExpanded ? null : quote.id)
                                }
                                className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200 transition cursor-pointer"
                              >
                                <span>{quote.items.length} بنود</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-mono text-slate-700">
                          {quote.subtotal.toFixed(2)}
                        </td>
                        <td className="p-2.5 font-mono text-rose-600">
                          {quote.discount > 0 ? `-${quote.discount.toFixed(2)}` : '0.00'}
                        </td>
                        <td className="p-2.5 font-mono font-extrabold text-amber-900 bg-amber-50/70 whitespace-nowrap">
                          {quote.netTotal.toFixed(2)} ر.س
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              quote.status === 'معتمد ومحول لطلب'
                                ? 'bg-emerald-100 text-emerald-800'
                                : quote.status === 'مرفوض'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {quote.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-500 max-w-[150px] truncate" title={quote.notes}>
                          {quote.notes || '—'}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap sticky left-0 bg-white/95 shadow-sm">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Print / View */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrintQuotation(quote);
                              }}
                              title="معاينة وطباعة عرض السعر وتصديره"
                              className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>عرض وطباعة</span>
                            </button>

                            {/* View Row Timeline */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedQuoteForTimeline(quote);
                              }}
                              title={`عرض الخط الزمني (أنشأه: ${quote.audit?.createdByName || 'حساب النظام'})`}
                              className="p-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            {/* Convert to Sale Button */}
                            {quote.status !== 'معتمد ومحول لطلب' && userRole !== 'viewer' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onConvertQuotationToSale(quote);
                                }}
                                title="اعتماد العرض وتحويله إلى طلب مبيعات رسمي"
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>اعتماد</span>
                              </button>
                            )}

                            {/* Edit & Delete with Permissions & Lock */}
                            {(() => {
                              const isLocked = Boolean(agencySettings?.invoiceLockApproved && quote.status === 'معتمد ومحول لطلب');
                              const canEdit = userRole === 'owner' || userRole === 'admin' || (!isLocked && userRole !== 'viewer');
                              const canDelete = userRole === 'owner' || userRole === 'admin' || (!isLocked && userRole !== 'viewer' && userRole !== 'sales');

                              return (
                                <>
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditModal(quote);
                                      }}
                                      title="تعديل عرض السعر"
                                      className="p-1 rounded text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  ) : isLocked ? (
                                    <span
                                      title="عرض السعر معتمد ومحول لطلب مقفل. التعديل محصور بالإدارة والمالك"
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
                                        setConfirmDeleteId(quote.id);
                                      }}
                                      title="حذف"
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

                      {/* Expanded Sub-table */}
                      {isExpanded && quote.items && quote.items.length > 0 && (
                        <tr className="bg-amber-50/40">
                          <td colSpan={15} className="p-3 pr-12">
                            <div className="bg-white rounded-lg p-3 border border-amber-200 shadow-xs space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-amber-950 border-b border-amber-100 pb-1.5 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onPrintQuotation(quote)}
                                    className="px-2 py-0.5 rounded bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>طباعة عرض السعر</span>
                                  </button>
                                  <span>تفاصيل بنود عرض السعر ({quote.items.length} بنود):</span>
                                </div>
                                <span>العميل: {quote.customerName} - {quote.quotationNo}</span>
                              </div>
                              <table className="w-full text-right text-xs">
                                <thead>
                                  <tr className="text-slate-500 border-b border-slate-100">
                                    <th className="py-1">#</th>
                                    <th className="py-1">الخدمة / المنتج</th>
                                    <th className="py-1">المواصفات الفنية ومقاسات التنفيذ</th>
                                    <th className="py-1 text-center">الكمية</th>
                                    <th className="py-1 text-center">الوحدة</th>
                                    <th className="py-1 text-center">سعر الوحدة</th>
                                    <th className="py-1 text-left font-bold">الإجمالي</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {quote.items.map((line, lIdx) => (
                                    <tr key={line.id || lIdx} className="border-b border-slate-50 text-slate-700">
                                      <td className="py-1 font-mono text-slate-400">{lIdx + 1}</td>
                                      <td className="py-1 font-bold text-slate-900">{line.serviceType}</td>
                                      <td className="py-1 text-slate-600">{line.specifications || '—'}</td>
                                      <td className="py-1 text-center font-bold">{line.quantity}</td>
                                      <td className="py-1 text-center text-slate-500">{line.unitType}</td>
                                      <td className="py-1 text-center font-mono">{line.unitPrice.toFixed(2)} ر.س</td>
                                      <td className="py-1 text-left font-mono font-bold text-amber-900">
                                        {line.itemTotal.toFixed(2)} ر.س
                                      </td>
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

      {/* Modal Form for Add/Edit Quotation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] my-auto">
            <div className="p-4 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base">
                  {editingQuotation ? 'تعديل عرض سعر' : 'إضافة عرض سعر جديد'}
                </h3>
                <p className="text-xs text-amber-200">
                  إعداد عرض أسعار ومواصفات لتقديمه للعميل قبل اعتماد الطلب
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
                {/* Customer Info Box */}
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>بيانات العميل والمؤسسة</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        اسم العميل <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.customerName || ''}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        placeholder="اسم العميل أو جهة الاتصال"
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        رقم الجوال
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.customerPhone || ''}
                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                        placeholder="05XXXXXXXX"
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-right focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          البريد الإلكتروني للعميل (اختياري)
                        </label>
                        {formData.customerEmail ? (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, customerEmail: '' })}
                            className="text-[10px] text-rose-600 hover:underline cursor-pointer font-bold"
                          >
                            حذف الإيميل ✕
                          </button>
                        ) : null}
                      </div>
                      <input
                        type="email"
                        dir="ltr"
                        value={formData.customerEmail || ''}
                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                        placeholder="client@example.com (اتركه فارغاً إذا لا يوجد)"
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-right focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        اسم الشركة أو المؤسسة (اختياري)
                      </label>
                      <input
                        type="text"
                        value={formData.customerCompany || ''}
                        onChange={(e) => setFormData({ ...formData, customerCompany: e.target.value })}
                        placeholder="مثال: شركة التطوير الحديثة"
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        الرقم الضريبي للعميل (إن وجد)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.customerVatNumber || ''}
                        onChange={(e) => setFormData({ ...formData, customerVatNumber: e.target.value })}
                        placeholder="الرقم الضريبي للجهة 15 رقماً"
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-right focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        قناة البيع / جهة الدخل
                      </label>
                      <EditableSelect
                        id="quotation-revenue-source"
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
                  </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      تاريخ إصدار العرض
                    </label>
                    <input
                      type="date"
                      value={formData.issueDate || ''}
                      onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        مدة سريان العرض (بالأيام)
                      </label>
                      {formData.validityDays ? (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, validityDays: '' })}
                          className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                        >
                          حذف المدة
                        </button>
                      ) : null}
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={formData.validityDays ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          validityDays: e.target.value ? Number(e.target.value) : '',
                        })
                      }
                      placeholder="اختياري (اتركه فارغاً إذا لا ترغب بتحديد مدة)"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {formData.validityDays
                        ? `سيكتب في الشروط: ساري لمدة ${formData.validityDays} يوماً`
                        : 'بدون تاريخ انتهاء (لن يظهر شرط السريان)'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      حالة العرض
                    </label>
                    <select
                      value={formData.status || 'بانتظار الاعتماد'}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as QuotationStatus })
                      }
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="بانتظار الاعتماد">🟡 بانتظار الاعتماد</option>
                      <option value="معتمد ومحول لطلب">🟢 معتمد ومحول لطلب</option>
                      <option value="مرفوض">🔴 مرفوض</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Line Items Repeater */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-1.5">
                    <PackagePlus className="w-4 h-4 text-amber-700" />
                    <h4 className="text-xs font-bold text-slate-800">
                      بنود عرض السعر والخدمات المطلوبة ({formData.items?.length || 0} بنود)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بند آخر</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {(formData.items || []).map((line, index) => (
                    <div
                      key={line.id || index}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 relative"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-b border-slate-100 pb-1">
                        <span>بند رقم {index + 1}</span>
                        {(formData.items || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(index)}
                            className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف البند</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            الخدمة / المنتج
                          </label>
                          <EditableSelect
                            options={SERVICE_TYPES}
                            value={line.serviceType}
                            onChange={(val) => handleLineItemChange(index, { serviceType: val })}
                            placeholder="اختر أو اكتب نوع الخدمة/المنتج..."
                            className="text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            المواصفات الفنية والمقاسات
                          </label>
                          <input
                            type="text"
                            value={line.specifications}
                            onChange={(e) =>
                              handleLineItemChange(index, { specifications: e.target.value })
                            }
                            placeholder="مقاسات، نوع خامات، إضاءة، ألوان..."
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            الكمية
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.quantity || ''}
                            onChange={(e) =>
                              handleLineItemChange(index, {
                                quantity: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder="0"
                            className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white text-center font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            الوحدة
                          </label>
                          <EditableSelect
                            options={SALES_UNIT_TYPES}
                            value={line.unitType}
                            onChange={(val) => handleLineItemChange(index, { unitType: val })}
                            placeholder="الوحدة..."
                            className="text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            سعر الوحدة
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.unitPrice || ''}
                            onChange={(e) =>
                              handleLineItemChange(index, {
                                unitPrice: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder="0.00"
                            className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white text-center font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            إجمالي البند
                          </label>
                          <div className="w-full text-xs p-1.5 rounded-lg bg-amber-50 text-amber-950 font-bold border border-amber-200 text-center font-mono">
                            {(line.itemTotal || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terms, Discount & Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      مدة التنفيذ المقترحة بعد الاعتماد
                    </label>
                    <input
                      type="text"
                      value={formData.executionDays || ''}
                      onChange={(e) => setFormData({ ...formData, executionDays: e.target.value })}
                      placeholder="مثال: 3 إلى 5 أيام عمل بعد الاعتماد"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      شروط وطريقة الدفع
                    </label>
                    <input
                      type="text"
                      value={formData.paymentTerms || ''}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      placeholder="مثال: 50% دفعة مقدمة و 50% عند التسليم"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ملاحظات وشروط إضافية
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="أي شروط خاصة بالتركيب، الضمان، أو متطلبات العمل..."
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  {/* Optional Customer Approval Section Toggle */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 transition">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.includeCustomerApproval)}
                        onChange={(e) =>
                          setFormData({ ...formData, includeCustomerApproval: e.target.checked })
                        }
                        className="w-4 h-4 mt-0.5 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          تضمين بند اعتماد وتعميد العميل (التوقيع والختم)
                        </span>
                        <span className="text-[10px] text-slate-500 block leading-normal mt-0.5">
                          اختياري: حدد هذا الخيار لإظهار خانة مخصصة لتوقيع وختم العميل في أسفل العرض
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Financial Totals */}
                <div className="space-y-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-800">
                        طريقة الخصم الممنوح
                      </label>
                      <div className="inline-flex rounded-lg p-0.5 bg-slate-200 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            const subtotal = (formData.items || []).reduce(
                              (s, it) => s + (it.itemTotal || 0),
                              0
                            );
                            const p =
                              subtotal > 0
                                ? Math.round(((Number(formData.discount) || 0) / subtotal) * 100 * 10) / 10
                                : 0;
                            setFormData({
                              ...formData,
                              discountType: 'amount',
                              discountPercent: p,
                            });
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                            (formData.discountType || 'amount') === 'amount'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          مبلغ محدد (ر.س)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const subtotal = (formData.items || []).reduce(
                              (s, it) => s + (it.itemTotal || 0),
                              0
                            );
                            const p =
                              formData.discountPercent && Number(formData.discountPercent) > 0
                                ? Number(formData.discountPercent)
                                : subtotal > 0
                                ? Math.round(((Number(formData.discount) || 0) / subtotal) * 100 * 10) / 10
                                : 0;
                            const calcDiscount = Math.round(((subtotal * p) / 100) * 100) / 100;
                            setFormData({
                              ...formData,
                              discountType: 'percentage',
                              discountPercent: p,
                              discount: calcDiscount,
                            });
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                            formData.discountType === 'percentage'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          نسبة مئوية (%)
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
                              const subtotal = (formData.items || []).reduce(
                                (s, it) => s + (it.itemTotal || 0),
                                0
                              );
                              const calcDiscount = Math.round(((subtotal * p) / 100) * 100) / 100;
                              setFormData({
                                ...formData,
                                discountPercent: p,
                                discount: calcDiscount,
                              });
                            }}
                            placeholder="0"
                            className="w-full text-xs p-2 pl-8 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">
                            %
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                          <span>
                            قيمة الخصم المحسوبة:{' '}
                            <strong className="text-rose-600 font-mono">
                              -{(Number(formData.discount) || 0).toFixed(2)} ر.س
                            </strong>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={formData.discount || ''}
                            onChange={(e) => {
                              const d = parseFloat(e.target.value) || 0;
                              const subtotal = (formData.items || []).reduce(
                                (s, it) => s + (it.itemTotal || 0),
                                0
                              );
                              const p =
                                subtotal > 0 ? Math.round(((d / subtotal) * 100) * 10) / 10 : 0;
                              setFormData({
                                ...formData,
                                discount: d,
                                discountPercent: p,
                              });
                            }}
                            placeholder="0.00"
                            className="w-full text-xs p-2 pl-12 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">
                            ر.س
                          </span>
                        </div>
                        {Boolean(Number(formData.discount)) && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            تعادل نسبة خصم:{' '}
                            <strong className="text-emerald-700 font-mono">
                              {(() => {
                                const subtotal = (formData.items || []).reduce(
                                  (s, it) => s + (it.itemTotal || 0),
                                  0
                                );
                                return subtotal > 0
                                  ? (((Number(formData.discount) || 0) / subtotal) * 100).toFixed(1)
                                  : 0;
                              })()}
                              %
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="quote-is-tax"
                      checked={Boolean(formData.isTaxIncluded)}
                      onChange={(e) =>
                        setFormData({ ...formData, isTaxIncluded: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="quote-is-tax" className="text-xs font-bold text-slate-800 cursor-pointer">
                      إضافة ضريبة القيمة المضافة 15% على العرض
                    </label>
                  </div>

                  {/* Summary Box Preview */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5">
                    {(() => {
                      const subtotal = (formData.items || []).reduce(
                        (s, it) => s + (it.itemTotal || 0),
                        0
                      );
                      const discount = Number(formData.discount) || 0;
                      const netBeforeTax = Math.max(0, subtotal - discount);
                      const tax = formData.isTaxIncluded ? netBeforeTax * 0.15 : 0;
                      const finalTotal = netBeforeTax + tax;

                      return (
                        <>
                          <div className="flex justify-between text-slate-600">
                            <span>إجمالي البنود:</span>
                            <span className="font-mono font-bold">{subtotal.toFixed(2)} ر.س</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between text-rose-600">
                              <span>الخصم:</span>
                              <span className="font-mono font-bold">-{discount.toFixed(2)} ر.س</span>
                            </div>
                          )}
                          {formData.isTaxIncluded && (
                            <div className="flex justify-between text-emerald-800">
                              <span>ضريبة 15%:</span>
                              <span className="font-mono font-bold">+{tax.toFixed(2)} ر.س</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-1">
                            <span>الصافي المطلوب:</span>
                            <span className="font-mono text-amber-800 font-extrabold">
                              {finalTotal.toFixed(2)} ر.س
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

              {/* Submit Buttons */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  {editingQuotation ? 'حفظ التعديلات' : 'إنشاء عرض السعر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">هل أنت متأكد من حذف عرض السعر؟</h3>
            <p className="text-xs text-slate-500">
              سيتم حذف سجل عرض السعر نهائياً ولن تتمكن من استرجاعه.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteQuotation(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Audit Timeline Modals */}
      <AuditTimelineModal
        isOpen={Boolean(selectedQuoteForTimeline)}
        onClose={() => setSelectedQuoteForTimeline(null)}
        targetQuotation={selectedQuoteForTimeline}
      />

      <AuditTimelineModal
        isOpen={showAllTimelineModal}
        onClose={() => setShowAllTimelineModal(false)}
        viewMode="all"
      />
    </div>
  );
};
