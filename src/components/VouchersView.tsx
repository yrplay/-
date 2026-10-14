import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Edit2,
  Trash2,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Coins,
  Wallet,
  Receipt,
  Building2,
  ArrowUpDown,
  Link2,
} from 'lucide-react';
import { VoucherItem, VoucherType, AgencySettings, UserRole, SaleItem } from '../types';
import { tafqeet } from '../lib/tafqeet';
import { computeSaleDerivedFields } from '../lib/dataStore';
import { VoucherPrintModal } from './VoucherPrintModal';
import { getTranslations } from '../lib/translations';

interface VouchersViewProps {
  vouchers: VoucherItem[];
  agencySettings: AgencySettings;
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  currentUserName?: string;
  currentUserEmail?: string;
  sales?: SaleItem[];
  onUpdateSale?: (sale: SaleItem) => void;
  onAddVoucher: (voucher: VoucherItem) => void;
  onUpdateVoucher: (voucher: VoucherItem) => void;
  onDeleteVoucher: (id: string) => void;
  onUpdateAgencySettings?: (settings: AgencySettings) => void;
  initialSelectedSale?: SaleItem | null;
  onClearInitialSelectedSale?: () => void;
}

type FilterType = 'ALL' | 'RECEIPT' | 'PAYMENT';
type SortOption = 'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'AMOUNT_ASC' | 'NAME_ASC';

export const VouchersView: React.FC<VouchersViewProps> = ({
  vouchers,
  agencySettings,
  userRole = 'owner',
  currentLang = (agencySettings.userProfile?.language || agencySettings.appLanguage || 'ar') as 'ar' | 'en',
  currentUserName = 'المستخدم',
  currentUserEmail = '',
  sales = [],
  onUpdateSale,
  onAddVoucher,
  onUpdateVoucher,
  onDeleteVoucher,
  onUpdateAgencySettings,
  initialSelectedSale,
  onClearInitialSelectedSale,
}) => {
  const t = getTranslations(currentLang);
  const isEn = currentLang === 'en';
  // Filters & State
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('NEWEST'); // Default: newest first
  const [showSummaries, setShowSummaries] = useState<boolean>(() => {
    return localStorage.getItem('vouchers_show_summaries') !== 'false';
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<VoucherItem | null>(null);
  const [printVoucher, setPrintVoucher] = useState<VoucherItem | null>(null);

  // Form State
  const [voucherType, setVoucherType] = useState<VoucherType>('receipt');
  const [voucherNo, setVoucherNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [amountInWords, setAmountInWords] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقداً (كاش)');
  const [referenceNo, setReferenceNo] = useState('');
  const [relatedInvoiceNo, setRelatedInvoiceNo] = useState('');
  const [isInvoiceSettlement, setIsInvoiceSettlement] = useState<boolean>(false);
  const [autoUpdateInvoice, setAutoUpdateInvoice] = useState<boolean>(true);
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [receivedBy, setReceivedBy] = useState(currentUserName);
  const [approvedBy, setApprovedBy] = useState(agencySettings.agencyName || 'المدير العام');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const toggleSummaries = () => {
    setShowSummaries((prev) => {
      const next = !prev;
      localStorage.setItem('vouchers_show_summaries', String(next));
      return next;
    });
  };

  // Generate next voucher number
  const generateVoucherNo = (type: VoucherType) => {
    const prefix = type === 'receipt' ? 'RC' : 'PV';
    const sameTypeVouchers = vouchers.filter((v) => v.type === type);
    const nextNum = 1000 + sameTypeVouchers.length + 1;
    return `${prefix}-${nextNum}`;
  };

  const handleOpenAddModal = (type: VoucherType = 'receipt') => {
    setEditingVoucher(null);
    setVoucherType(type);
    setVoucherNo(generateVoucherNo(type));
    setDate(new Date().toISOString().split('T')[0]);
    setPartyName('');
    setPartyPhone('');
    setAmount('');
    setAmountInWords('');
    setPaymentMethod(type === 'receipt' ? 'شبكة مدى' : 'نقداً (كاش)');
    setReferenceNo('');
    setRelatedInvoiceNo('');
    setIsInvoiceSettlement(false);
    setAutoUpdateInvoice(true);
    setSelectedSaleId('');
    setDescription(type === 'receipt' ? (isEn ? 'Payment on invoice / services' : 'دفعة على حساب فاتورة / خدمات') : (isEn ? 'Operating purchase / expense payment' : 'سداد مشتريات / مصاريف تشغيلية'));
    setReceivedBy(currentUserName);
    setApprovedBy(agencySettings.agencyName || (isEn ? 'Manager' : 'المدير'));
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (v: VoucherItem) => {
    setEditingVoucher(v);
    setVoucherType(v.type);
    setVoucherNo(v.voucherNo);
    setDate(v.date);
    setPartyName(v.partyName);
    setPartyPhone(v.partyPhone || '');
    setAmount(v.amount);
    setAmountInWords(v.amountInWords || tafqeet(v.amount));
    setPaymentMethod(v.paymentMethod || 'نقداً');
    setReferenceNo(v.referenceNo || '');
    setRelatedInvoiceNo(v.relatedInvoiceNo || '');
    setIsInvoiceSettlement(Boolean(v.isInvoiceSettlement));
    setAutoUpdateInvoice(false);
    setSelectedSaleId('');
    setDescription(v.description || '');
    setReceivedBy(v.receivedBy || currentUserName);
    setApprovedBy(v.approvedBy || (isEn ? 'Manager' : 'المدير'));
    setNotes(v.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Automatically open Receipt Voucher modal if requested from SalesView
  useEffect(() => {
    if (initialSelectedSale) {
      setEditingVoucher(null);
      setVoucherType('receipt');
      const nextNo = generateVoucherNo('receipt');
      setVoucherNo(nextNo);
      setDate(new Date().toISOString().split('T')[0]);
      setPartyName(initialSelectedSale.customerName || '');
      setPartyPhone(initialSelectedSale.customerPhone || '');
      const rem = initialSelectedSale.remainingAmount > 0 ? initialSelectedSale.remainingAmount : initialSelectedSale.netTotal;
      setAmount(rem);
      setAmountInWords(tafqeet(rem));
      setPaymentMethod(initialSelectedSale.paymentMethod || 'نقداً (كاش)');
      setReferenceNo('');
      setRelatedInvoiceNo(initialSelectedSale.invoiceNo || initialSelectedSale.id);
      setIsInvoiceSettlement(true);
      setAutoUpdateInvoice(true);
      setSelectedSaleId(initialSelectedSale.id);
      setDescription(
        isEn
          ? `Settlement payment for invoice ${initialSelectedSale.invoiceNo || initialSelectedSale.id} - ${initialSelectedSale.serviceType || ''}`
          : `دفعة من فاتورة ${initialSelectedSale.invoiceNo || initialSelectedSale.id} - ${initialSelectedSale.serviceType || ''}`
      );
      setReceivedBy(currentUserName);
      setApprovedBy(agencySettings.agencyName || (isEn ? 'General Manager' : 'المدير العام'));
      setNotes('');
      setFormError('');
      setIsModalOpen(true);
      onClearInitialSelectedSale?.();
    }
  }, [initialSelectedSale]);

  // Helper when selecting an invoice to settle
  const handleSelectInvoice = (saleId: string) => {
    setSelectedSaleId(saleId);
    if (!saleId) {
      setIsInvoiceSettlement(false);
      return;
    }
    const sale = sales.find((s) => s.id === saleId);
    if (sale) {
      setIsInvoiceSettlement(true);
      setRelatedInvoiceNo(sale.invoiceNo || sale.id);
      setPartyName(sale.customerName || '');
      setPartyPhone(sale.customerPhone || '');
      const rem = sale.remainingAmount > 0 ? sale.remainingAmount : sale.netTotal;
      setAmount(rem);
      setAmountInWords(tafqeet(rem));
      setDescription(
        isEn
          ? `Settlement payment for invoice ${sale.invoiceNo || sale.id} - ${sale.serviceType}`
          : `دفعة من فاتورة ${sale.invoiceNo || sale.id} - ${sale.serviceType}`
      );
    }
  };

  // Update amount in words automatically
  const handleAmountChange = (val: number | '') => {
    setAmount(val);
    if (val !== '' && !isNaN(Number(val)) && Number(val) > 0) {
      setAmountInWords(tafqeet(Number(val)));
    } else {
      setAmountInWords('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) {
      setFormError(isEn ? 'Please enter party / payer name' : 'يرجى إدخال اسم المستلم / الدافع');
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError(isEn ? 'Please enter a valid amount greater than zero' : 'يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    const payload: VoucherItem = {
      id: editingVoucher ? editingVoucher.id : `vouch-${Date.now()}`,
      voucherNo: voucherNo || generateVoucherNo(voucherType),
      type: voucherType,
      date,
      amount: numAmount,
      amountInWords: amountInWords.trim() || tafqeet(numAmount),
      partyName: partyName.trim(),
      partyPhone: partyPhone.trim() || '',
      paymentMethod,
      referenceNo: referenceNo.trim() || '',
      relatedInvoiceNo: relatedInvoiceNo.trim() || '',
      isInvoiceSettlement: isInvoiceSettlement,
      autoUpdatedInvoice: isInvoiceSettlement && autoUpdateInvoice,
      description: description.trim() || (voucherType === 'receipt' ? (isEn ? 'Receipt Voucher' : 'سند قبض') : (isEn ? 'Payment Voucher' : 'سند صرف')),
      receivedBy: receivedBy.trim() || '',
      approvedBy: approvedBy.trim() || '',
      notes: notes.trim() || '',
      audit: {
        createdByName: editingVoucher?.audit?.createdByName || currentUserName,
        createdByEmail: editingVoucher?.audit?.createdByEmail || currentUserEmail,
        createdAt: editingVoucher?.audit?.createdAt || new Date().toISOString(),
        updatedByName: currentUserName,
        updatedByEmail: currentUserEmail,
        updatedAt: new Date().toISOString(),
      },
    };

    // Auto update invoice if settlement checked
    if (voucherType === 'receipt' && isInvoiceSettlement && autoUpdateInvoice && onUpdateSale) {
      const targetSale = sales.find(
        (s) => s.id === selectedSaleId || s.id === relatedInvoiceNo || s.invoiceNo === relatedInvoiceNo
      );
      if (targetSale) {
        const curPaid = Number(targetSale.paidAmount) || 0;
        const newPaid = Math.min(targetSale.netTotal, curPaid + numAmount);
        const updated = computeSaleDerivedFields(
          {
            ...targetSale,
            paidAmount: newPaid,
            paymentMethod: paymentMethod || targetSale.paymentMethod,
          },
          0
        );
        onUpdateSale(updated);
      }
    }

    if (editingVoucher) {
      onUpdateVoucher(payload);
    } else {
      onAddVoucher(payload);
    }

    setIsModalOpen(false);
  };

  // Filtered & Sorted vouchers
  const filteredAndSortedVouchers = useMemo(() => {
    // 1. Filter
    const list = vouchers.filter((v) => {
      const matchType =
        filterType === 'ALL' ||
        (filterType === 'RECEIPT' && v.type === 'receipt') ||
        (filterType === 'PAYMENT' && v.type === 'payment');

      const s = searchTerm.toLowerCase().trim();
      const matchSearch =
        !s ||
        (v.voucherNo && v.voucherNo.toLowerCase().includes(s)) ||
        (v.partyName && v.partyName.toLowerCase().includes(s)) ||
        (v.description && v.description.toLowerCase().includes(s)) ||
        (v.referenceNo && v.referenceNo.toLowerCase().includes(s)) ||
        (v.relatedInvoiceNo && v.relatedInvoiceNo.toLowerCase().includes(s));

      return matchType && matchSearch;
    });

    // 2. Sort (Default is NEWEST first)
    return list.sort((a, b) => {
      if (sortBy === 'NEWEST') {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (b.id || '').localeCompare(a.id || '');
      }
      if (sortBy === 'OLDEST') {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (a.id || '').localeCompare(b.id || '');
      }
      if (sortBy === 'AMOUNT_DESC') {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (sortBy === 'AMOUNT_ASC') {
        return (a.amount || 0) - (b.amount || 0);
      }
      if (sortBy === 'NAME_ASC') {
        return (a.partyName || '').localeCompare(b.partyName || '', 'ar');
      }
      return 0;
    });
  }, [vouchers, filterType, searchTerm, sortBy]);

  // Calculations for summary
  const totals = useMemo(() => {
    let receiptSum = 0;
    let paymentSum = 0;
    let receiptCount = 0;
    let paymentCount = 0;
    let settlementSum = 0;
    let settlementCount = 0;

    vouchers.forEach((v) => {
      if (v.type === 'receipt') {
        receiptSum += v.amount || 0;
        receiptCount++;
        if (v.isInvoiceSettlement || (v.relatedInvoiceNo && sales.some((s) => s.id === v.relatedInvoiceNo || s.invoiceNo === v.relatedInvoiceNo))) {
          settlementSum += v.amount || 0;
          settlementCount++;
        }
      } else {
        paymentSum += v.amount || 0;
        paymentCount++;
      }
    });

    const directReceiptSum = receiptSum - settlementSum;

    return {
      receiptSum,
      paymentSum,
      settlementSum,
      settlementCount,
      directReceiptSum,
      netCash: receiptSum - paymentSum,
      receiptCount,
      paymentCount,
      totalCount: vouchers.length,
    };
  }, [vouchers, sales]);

  return (
    <div className="space-y-4">
      {/* Viewer Mode Notice */}
      {userRole === 'viewer' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-bold shadow-xs">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{t.viewerReadOnlyNotice}</span>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <span>{t.vouchersTitle}</span>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {filteredAndSortedVouchers.length} {isEn ? 'vouchers' : 'سند'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEn
              ? 'Issue receipt & payment vouchers, invoice settlements (non-doubled), and printed receipts'
              : 'إصدار سندات قبض (استلام دفعات ومبالغ) وسندات صرف (مدفوعات ومشتريات) مع تسوية دفعات الفواتير دون تكرار'}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Toggle Summary Visibility */}
          <button
            type="button"
            onClick={toggleSummaries}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
            title={showSummaries ? (isEn ? 'Hide KPI' : 'إخفاء بطاقات الإجماليات') : (isEn ? 'Show KPI' : 'إظهار بطاقات الإجماليات')}
          >
            {showSummaries ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{isEn ? 'Hide KPI' : 'إخفاء الإجماليات'}</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{isEn ? 'Show KPI' : 'إظهار الإجماليات'}</span>
              </>
            )}
          </button>

          {/* New Receipt Voucher (Hidden for Viewer) */}
          {userRole !== 'viewer' && (
            <>
              <button
                type="button"
                onClick={() => handleOpenAddModal('receipt')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>+ {t.newReceipt}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddModal('payment')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+ {t.newPayment}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards (Collapsible for Clean, Simple UI) */}
      {showSummaries && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Receipts */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-emerald-800 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                {isEn ? 'Total Receipts (Inflow)' : 'إجمالي سندات القبض (وارد)'}
              </span>
              <span className="text-[11px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                {totals.receiptCount} {isEn ? 'vouchers' : 'سند'}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-emerald-900 font-mono">
              {totals.receiptSum.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-normal">{isEn ? 'SAR' : 'ر.س'}</span>
            </div>
            <div className="mt-1 pt-1 border-t border-emerald-200/60 text-[11px] text-emerald-800 flex items-center justify-between flex-wrap gap-1">
              <span>{isEn ? 'Invoice Settlements:' : 'تسويات فواتير:'} <strong className="font-mono font-bold">{totals.settlementSum.toFixed(2)}</strong></span>
              <span className="text-[10px] bg-emerald-100/80 px-1.5 py-0.2 rounded font-semibold text-emerald-900">
                {isEn ? 'Non-doubled in cash' : 'لا تكرر في الصندوق'}
              </span>
            </div>
          </div>

          {/* Total Payments */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-rose-800 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                {isEn ? 'Total Payments (Outflow)' : 'إجمالي سندات الصرف (منصرف)'}
              </span>
              <span className="text-[11px] bg-rose-100 text-rose-900 px-2 py-0.5 rounded-full font-bold">
                {totals.paymentCount} {isEn ? 'vouchers' : 'سند'}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-rose-900 font-mono">
              {totals.paymentSum.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-normal">{isEn ? 'SAR' : 'ر.س'}</span>
            </div>
            <p className="text-[11px] text-rose-700 mt-0.5">{isEn ? 'Payments to suppliers & operating expenses' : 'مدفوعات للموردين والمصاريف التشغيلية'}</p>
          </div>

          {/* Net Cash Flow */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-slate-700 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-indigo-600" />
                {isEn ? 'Net Vouchers Cash Flow' : 'صافي حركة السندات النقدية'}
              </span>
              <span className="text-[11px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full font-bold">
                {totals.totalCount} {isEn ? 'total' : 'إجمالي'}
              </span>
            </div>
            <div className={`text-lg sm:text-xl font-extrabold font-mono ${totals.netCash >= 0 ? 'text-indigo-900' : 'text-rose-700'}`}>
              {totals.netCash.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-normal">{isEn ? 'SAR' : 'ر.س'}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{isEn ? 'Receipts minus payments' : 'الفارق بين المقبوض والمدفوع'}</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isEn ? 'All' : 'الكل'}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('RECEIPT')}
            className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
              filterType === 'RECEIPT'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span>{isEn ? 'Receipt Vouchers' : 'سندات قبض'}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('PAYMENT')}
            className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
              filterType === 'PAYMENT'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <span>{isEn ? 'Payment Vouchers' : 'سندات صرف'}</span>
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center flex-wrap gap-2.5 flex-1 max-w-xl justify-end">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className={`w-3.5 h-3.5 text-slate-400 absolute ${isEn ? 'left-2.5' : 'right-2.5'} top-2.5`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isEn ? 'Search voucher #, party, description...' : 'بحث برقم السند، الطرف، البيان...'}
              className={`w-full ${isEn ? 'pl-8 pr-3' : 'pl-3 pr-8'} py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={`absolute ${isEn ? 'right-2.5' : 'left-2.5'} top-2.5 text-slate-400 hover:text-slate-600`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              {isEn ? 'Sort:' : 'ترتيب:'}
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="NEWEST">{isEn ? 'Newest First' : 'الأحدث أولاً (تلقائي)'}</option>
              <option value="OLDEST">{isEn ? 'Oldest First' : 'الأقدم أولاً'}</option>
              <option value="AMOUNT_DESC">{isEn ? 'Highest Amount' : 'الأعلى مبلغاً'}</option>
              <option value="AMOUNT_ASC">{isEn ? 'Lowest Amount' : 'الأقل مبلغاً'}</option>
              <option value="NAME_ASC">{isEn ? 'Party Name' : 'الاسم (أ - ي)'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-3">{isEn ? 'Voucher #' : 'رقم السند'}</th>
                <th className="py-2.5 px-3">{isEn ? 'Date' : 'التاريخ'}</th>
                <th className="py-2.5 px-3">{isEn ? 'Type' : 'النوع'}</th>
                <th className="py-2.5 px-3">{isEn ? 'Party (Customer / Supplier)' : 'الطرف (المستلم / الدافع)'}</th>
                <th className="py-2.5 px-3">{isEn ? 'Description / Settlement' : 'البيان والتسوية'}</th>
                <th className="py-2.5 px-3">{isEn ? 'Payment Method' : 'طريقة الدفع'}</th>
                <th className="py-2.5 px-3 text-left">{isEn ? 'Amount' : 'المبلغ'}</th>
                <th className="py-2.5 px-3 text-center">{isEn ? 'Actions' : 'إجراءات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <span>{isEn ? 'No vouchers matching current filters' : 'لا توجد سندات مسجلة مطابقة للبحث أو التصفية الحالية'}</span>
                  </td>
                </tr>
              ) : (
                filteredAndSortedVouchers.map((v) => {
                  const isReceipt = v.type === 'receipt';
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition">
                      {/* Voucher No */}
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            isReceipt
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {v.voucherNo}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {v.date}
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                            isReceipt ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isReceipt ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                              {isEn ? 'Receipt' : 'قبض'}
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3 text-rose-500" />
                              {isEn ? 'Payment' : 'صرف'}
                            </>
                          )}
                        </span>
                      </td>

                      {/* Party Name */}
                      <td className="py-2.5 px-3 font-bold text-slate-800 max-w-[160px] truncate">
                        <div>{v.partyName}</div>
                        {v.partyPhone && (
                          <div className="text-[10px] text-slate-400 font-mono">{v.partyPhone}</div>
                        )}
                      </td>

                      {/* Description & Settlement info */}
                      <td className="py-2.5 px-3 text-slate-600 max-w-[220px]" title={v.description}>
                        <div className="truncate">{v.description}</div>
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          {v.isInvoiceSettlement ? (
                            <span
                              className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold"
                              title={isEn ? 'Invoice payment settlement - non-doubled in cash register' : 'تسوية دفعة فاتورة - لا يتكرر احتسابها في الصندوق'}
                            >
                              ✓ {isEn ? 'Settlement' : 'تسوية فاتورة'} {v.relatedInvoiceNo ? `#${v.relatedInvoiceNo}` : ''} ({isEn ? 'Non-doubled' : 'لا تكرر بالصندوق'})
                            </span>
                          ) : v.relatedInvoiceNo ? (
                            <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-mono">
                              {isEn ? 'Invoice' : 'فاتورة'} {v.relatedInvoiceNo}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                          {v.paymentMethod || (isEn ? 'Cash' : 'نقداً')}
                        </span>
                        {v.referenceNo && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[100px]">
                            {isEn ? 'Ref:' : 'مرجع:'} {v.referenceNo}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-2.5 px-3 text-left whitespace-nowrap font-mono font-black text-slate-900 text-xs">
                        <span className={isReceipt ? 'text-emerald-700' : 'text-rose-700'}>
                          {v.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                          <span className="text-[10px] font-normal text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* Print Button */}
                          <button
                            type="button"
                            onClick={() => setPrintVoucher(v)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title="طباعة السند مالي وتفقيط"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit and Delete Buttons (Hidden for Viewer) */}
                          {userRole !== 'viewer' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(v)}
                                className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition cursor-pointer"
                                title="تعديل بيانات السند"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من حذف السند (${v.voucherNo}) بقيمة ${v.amount} ر.س؟`)) {
                                    onDeleteVoucher(v.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="حذف السند"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Voucher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 max-w-lg w-full text-slate-900 border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${
                    voucherType === 'receipt' ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  {voucherType === 'receipt' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {editingVoucher
                      ? `تعديل السند (${voucherNo})`
                      : voucherType === 'receipt'
                      ? 'إصدار سند قبض مالي جديد'
                      : 'إصدار سند صرف مالي جديد'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">رقم السند: {voucherNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Error */}
            {formError && (
              <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {/* Type Switcher (Only on New) */}
              {!editingVoucher && (
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherType('receipt');
                      setVoucherNo(generateVoucherNo('receipt'));
                    }}
                    className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      voucherType === 'receipt'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>سند قبض (استلام)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherType('payment');
                      setVoucherNo(generateVoucherNo('payment'));
                    }}
                    className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      voucherType === 'payment'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>سند صرف (دفع)</span>
                  </button>
                </div>
              )}

              {/* Date & Voucher No */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ السند</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم السند</label>
                  <input
                    type="text"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    required
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-slate-50 font-mono font-bold focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Party Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {voucherType === 'receipt' ? 'استلمنا من المكرم (العميل)' : 'صرفنا إلى المكرم (المورد / المستلم)'} *
                  </label>
                  <input
                    type="text"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    placeholder="اسم العميل أو المؤسسة أو المورد"
                    required
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم الجوال (اختياري)</label>
                  <input
                    type="text"
                    value={partyPhone}
                    onChange={(e) => setPartyPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Amount & Tafqeet */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">المبلغ المالي (ر.س) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) =>
                        handleAmountChange(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="0.00"
                      required
                      className="w-full p-2 text-xs rounded-lg border border-slate-300 font-mono font-extrabold text-slate-900 focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">طريقة الدفع</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-semibold focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="نقداً (كاش)">نقداً (كاش)</option>
                      <option value="شبكة مدى">شبكة مدى</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="شيك">شيك مصرفي</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>
                </div>

                {/* Amount in words */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                    تفقيط المبلغ بالكلمات (تلقائي وقابل للتعديل)
                  </label>
                  <input
                    type="text"
                    value={amountInWords}
                    onChange={(e) => setAmountInWords(e.target.value)}
                    placeholder="فقط ألف ريال سعودي لا غير..."
                    className="w-full p-1.5 text-[11px] rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Description (وذلك عن) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  البيان (وذلك عن...) *
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="مثلاً: دفعة مقدمة لحساب طباعة بنرات، أو سداد متبقي فاتورة رقم..."
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Intelligent Invoice Settlement & Link (سند تسوية دفعة فاتورة) */}
              {voucherType === 'receipt' ? (
                <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{isEn ? 'Link to Sales Invoice (Settlement)' : 'ربط بفاتورة مبيعات (تسوية دفعة)'}</span>
                    </label>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-1.5 py-0.2 rounded font-bold">
                      {isEn ? 'Non-doubled in treasury' : 'يمنع تكرار الاحتساب في الصندوق'}
                    </span>
                  </div>

                  {sales && sales.length > 0 && (
                    <div>
                      <select
                        value={selectedSaleId}
                        onChange={(e) => handleSelectInvoice(e.target.value)}
                        className="w-full p-2 text-xs rounded-lg border border-indigo-300 bg-white font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">{isEn ? '-- Select Invoice to Auto-fill & Settle --' : '-- اختر الفاتورة لتعبئة البيانات وتفادي التدبيل --'}</option>
                        {sales.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.invoiceNo || s.id} - {s.customerName} ({isEn ? 'Remaining:' : 'المتبقي:'} {s.remainingAmount} {isEn ? 'SAR' : 'ر.س'}) • {s.paymentStatus}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{isEn ? 'Invoice #' : 'رقم الفاتورة المرتبطة'}</label>
                      <input
                        type="text"
                        value={relatedInvoiceNo}
                        onChange={(e) => setRelatedInvoiceNo(e.target.value)}
                        placeholder="INV-1001"
                        className="w-full p-1.5 text-xs rounded-lg border border-slate-300 font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{isEn ? 'Reference / Check #' : 'رقم المرجع / الشيك'}</label>
                      <input
                        type="text"
                        value={referenceNo}
                        onChange={(e) => setReferenceNo(e.target.value)}
                        placeholder={isEn ? 'Ref #' : 'رقم الحوالة أو الشيك'}
                        className="w-full p-1.5 text-xs rounded-lg border border-slate-300 font-mono bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1 border-t border-indigo-100">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-indigo-900 select-none">
                      <input
                        type="checkbox"
                        checked={isInvoiceSettlement}
                        onChange={(e) => setIsInvoiceSettlement(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>{isEn ? 'Mark as Invoice Settlement (Do not double count in Cash Treasury)' : 'اعتماد السند كتسوية دفعة فاتورة (عدم تدبيل المبلغ في الصندوق والخزينة)'}</span>
                    </label>

                    {isInvoiceSettlement && (
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-emerald-800 select-none bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-200">
                        <input
                          type="checkbox"
                          checked={autoUpdateInvoice}
                          onChange={(e) => setAutoUpdateInvoice(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>{isEn ? 'Auto-update invoice paid amount & mark paid' : 'تحديث المدفوع في الفاتورة تلقائياً وتغيير حالتها إلى مسدد'}</span>
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{isEn ? 'Reference / Check #' : 'رقم المرجع / الشيك (اختياري)'}</label>
                    <input
                      type="text"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder={isEn ? 'Check / Ref' : 'رقم الحوالة أو الشيك'}
                      className="w-full p-1.5 text-xs rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{isEn ? 'Related Invoice / Bill #' : 'رقم الفاتورة المرتبطة (اختياري)'}</label>
                    <input
                      type="text"
                      value={relatedInvoiceNo}
                      onChange={(e) => setRelatedInvoiceNo(e.target.value)}
                      placeholder="BILL-1002"
                      className="w-full p-1.5 text-xs rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">اسم المستلم / أمين الصندوق</label>
                  <input
                    type="text"
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    placeholder="أمين الصندوق"
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">اسم المعتمد / المدير</label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder="المدير المالي"
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 rounded-lg text-white font-bold shadow-xs cursor-pointer transition ${
                    voucherType === 'receipt' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {editingVoucher ? 'تحديث السند' : 'حفظ وإصدار السند'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Voucher Modal */}
      <VoucherPrintModal
        voucher={printVoucher}
        isOpen={Boolean(printVoucher)}
        onClose={() => setPrintVoucher(null)}
        agencySettings={agencySettings}
        onUpdateAgencySettings={onUpdateAgencySettings}
      />
    </div>
  );
};
