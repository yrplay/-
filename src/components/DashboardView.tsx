import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Wallet,
  Users,
  Building2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  PackageX,
  FileText,
  PlusCircle,
  ExternalLink,
  Download,
  Calendar,
  Filter,
  ArrowRightLeft,
  CheckCircle2,
  DollarSign,
  ChevronLeft,
  BarChart3,
  PieChart as PieChartIcon,
  Coins,
  Landmark,
  Eye,
} from 'lucide-react';
import {
  matchesPaymentMethodFilter,
  getPaymentMethodDetails,
  normalizePaymentMethod,
} from '../lib/paymentUtils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  DashboardMetrics,
  SaleItem,
  PurchaseItem,
  ExpenseItem,
  InventoryItem,
  VoucherItem,
  UserRole,
  AgencySettings,
} from '../types';
import { User } from 'firebase/auth';
import { canAccessTab } from '../lib/permissions';
import { getTranslations } from '../lib/translations';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  sales: SaleItem[];
  purchases: PurchaseItem[];
  expenses: ExpenseItem[];
  inventory: InventoryItem[];
  vouchers?: VoucherItem[];
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  user?: User | null;
  agencySettings?: AgencySettings;
  onOpenNewSale: () => void;
  onOpenNewPurchase: () => void;
  onOpenNewExpense: () => void;
  onOpenNewInventory: () => void;
  onExportExcel?: () => void;
  setActiveTab: (tab: string) => void;
  spreadsheetUrl: string | null;
  onOpenSheetsModal: () => void;
  onOpenAgencySettings?: () => void;
}

type DateFilterPreset = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM';

interface FinancialMovement {
  id: string;
  date: string;
  type: 'SALE_INCOME' | 'PURCHASE_EXPENSE' | 'GENERAL_EXPENSE' | 'VOUCHER_RECEIPT' | 'VOUCHER_PAYMENT';
  typeLabel: string;
  title: string;
  subtitle: string;
  paymentMethod: string;
  amount: number;
  isCredit: boolean; // true = income (+), false = expense (-)
  status?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  sales,
  purchases,
  expenses,
  inventory,
  vouchers = [],
  userRole = 'owner' as UserRole,
  currentLang = 'ar',
  user,
  agencySettings,
  onOpenNewSale,
  onOpenNewPurchase,
  onOpenNewExpense,
  onOpenNewInventory,
  onExportExcel,
  setActiveTab,
  spreadsheetUrl,
  onOpenSheetsModal,
  onOpenAgencySettings,
}) => {
  const t = getTranslations(currentLang);
  const isEn = currentLang === 'en';
  const canAccessInventory = canAccessTab(userRole, 'inventory', user, agencySettings);

  // Date Filtering State
  const [filterPreset, setFilterPreset] = useState<DateFilterPreset>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('ALL');
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [movementPaymentFilter, setMovementPaymentFilter] = useState<string>('ALL');

  // Format currency
  const formatMoney = (val: number) => {
    return isEn
      ? `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`
      : new Intl.NumberFormat('ar-SA', {
          style: 'currency',
          currency: 'SAR',
          minimumFractionDigits: 2,
        }).format(val);
  };

  // Available sales channels / revenue sources
  const availableChannels = useMemo(() => {
    const channelSet = new Set<string>();
    ['المحل المباشر', 'المتجر الإلكتروني', 'مندوب / مسوق', 'سوشل ميديا (واتساب/إنستغرام)'].forEach((c) =>
      channelSet.add(c)
    );
    sales.forEach((s) => {
      if (s.revenueSource && s.revenueSource.trim()) {
        channelSet.add(s.revenueSource.trim());
      }
    });
    return Array.from(channelSet);
  }, [sales]);

  // Generate unique list of months present across transactions
  const availableMonths = useMemo(() => {
    const dates = [
      ...sales.map((s) => s.receiptDate),
      ...purchases.map((p) => p.date),
      ...expenses.map((e) => e.date),
    ].filter(Boolean);

    const monthSet = new Set<string>();
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    monthSet.add(currentMonthStr);

    dates.forEach((d) => {
      if (d && d.length >= 7) {
        monthSet.add(d.slice(0, 7));
      }
    });

    return Array.from(monthSet).sort().reverse();
  }, [sales, purchases, expenses]);

  // Compute effective start and end dates based on current filter state
  const { startDate, endDate, filterLabel } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (filterPreset === 'TODAY') {
      return { startDate: todayStr, endDate: todayStr, filterLabel: 'اليوم' };
    }

    if (filterPreset === 'THIS_WEEK') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 6 ? 0 : -1); // Starting Saturday or Sunday
      const start = new Date(d.setDate(diff)).toISOString().split('T')[0];
      return { startDate: start, endDate: todayStr, filterLabel: 'هذا الأسبوع' };
    }

    if (filterPreset === 'THIS_MONTH') {
      const start = `${todayStr.slice(0, 7)}-01`;
      return { startDate: start, endDate: todayStr, filterLabel: 'هذا الشهر' };
    }

    if (filterPreset === 'LAST_MONTH') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const start = prev.toISOString().split('T')[0];
      const end = prevEnd.toISOString().split('T')[0];
      return { startDate: start, endDate: end, filterLabel: 'الشهر الماضي' };
    }

    if (filterPreset === 'THIS_YEAR') {
      const start = `${now.getFullYear()}-01-01`;
      return { startDate: start, endDate: todayStr, filterLabel: `عام ${now.getFullYear()}` };
    }

    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      return {
        startDate: `${selectedMonth}-01`,
        endDate: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
        filterLabel: `شهر ${selectedMonth}`,
      };
    }

    if (selectedDate) {
      return { startDate: selectedDate, endDate: selectedDate, filterLabel: `يوم ${selectedDate}` };
    }

    if (filterPreset === 'CUSTOM' && (customStartDate || customEndDate)) {
      return {
        startDate: customStartDate || '2000-01-01',
        endDate: customEndDate || '2099-12-31',
        filterLabel: `من ${customStartDate || 'البداية'} إلى ${customEndDate || 'اليوم'}`,
      };
    }

    return { startDate: '', endDate: '', filterLabel: 'كل الفترات' };
  }, [filterPreset, selectedMonth, selectedDate, customStartDate, customEndDate]);

  // Filter datasets based on the resolved date range
  const isDateInRange = (dateStr: string | undefined) => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  // Datasets matching active date range and channel (base for treasury breakdown)
  const periodSales = useMemo(() => {
    return sales.filter((s) => {
      if (!isDateInRange(s.receiptDate)) return false;
      if (selectedChannel !== 'ALL' && (s.revenueSource || '') !== selectedChannel) return false;
      return true;
    });
  }, [sales, startDate, endDate, selectedChannel]);

  const periodPurchases = useMemo(() => purchases.filter((p) => isDateInRange(p.date)), [purchases, startDate, endDate]);
  const periodExpenses = useMemo(() => expenses.filter((e) => isDateInRange(e.date)), [expenses, startDate, endDate]);
  const periodVouchers = useMemo(() => (vouchers || []).filter((v) => isDateInRange(v.date)), [vouchers, startDate, endDate]);

  // Treasury & Payment Methods Balances (الكاش، الشبكة، التحويلات، الآجل)
  const treasuryFunds = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;
    let cashSalesCount = 0;

    let networkIn = 0;
    let networkOut = 0;
    let networkSalesCount = 0;

    let transferIn = 0;
    let transferOut = 0;
    let transferSalesCount = 0;

    let deferredReceivables = 0;
    let deferredPayables = 0;

    // 1. Sales Collection Breakdown
    periodSales.forEach((s) => {
      const cat = normalizePaymentMethod(s.paymentMethod);
      const collected = s.paidAmount > 0 ? s.paidAmount : (s.paymentStatus.includes('✅') ? s.netTotal : 0);

      if (cat === 'CASH') {
        cashIn += collected;
        cashSalesCount++;
      } else if (cat === 'NETWORK') {
        networkIn += collected;
        networkSalesCount++;
      } else if (cat === 'TRANSFER') {
        transferIn += collected;
        transferSalesCount++;
      }

      deferredReceivables += s.remainingAmount || 0;
    });

    // 2. Purchases Payments Breakdown
    periodPurchases.forEach((p) => {
      const cat = normalizePaymentMethod(p.paymentMethod);
      const paid = p.paidAmount > 0 ? p.paidAmount : (p.paymentStatus.includes('✅') ? p.total : 0);

      if (cat === 'CASH') {
        cashOut += paid;
      } else if (cat === 'NETWORK') {
        networkOut += paid;
      } else if (cat === 'TRANSFER') {
        transferOut += paid;
      }

      deferredPayables += p.remainingAmount || 0;
    });

    // 3. Operational Expenses Breakdown
    periodExpenses.forEach((e) => {
      const cat = normalizePaymentMethod(e.paymentMethod);

      if (cat === 'CASH') {
        cashOut += e.amount || 0;
      } else if (cat === 'NETWORK') {
        networkOut += e.amount || 0;
      } else if (cat === 'TRANSFER') {
        transferOut += e.amount || 0;
      }
    });

    // 4. Financial Vouchers Breakdown (سندات القبض كوارد، وسندات الصرف كمنصرف)
    // منع تكرار وازدواجية المبالغ في الصندوق: إذا كان السند تسوية دفعة لفاتورة أو مرتبطاً بفاتورة، لا يُحسب مرة ثانية
    periodVouchers.forEach((v) => {
      if (
        v.isInvoiceSettlement ||
        (v.relatedInvoiceNo && periodSales.some((s) => s.id === v.relatedInvoiceNo || (s.invoiceNo && s.invoiceNo === v.relatedInvoiceNo)))
      ) {
        return; // تجنب التدبيل في الخزينة
      }
      const cat = normalizePaymentMethod(v.paymentMethod);
      const amt = v.amount || 0;
      if (v.type === 'receipt') {
        if (cat === 'CASH') {
          cashIn += amt;
          cashSalesCount++;
        } else if (cat === 'NETWORK') {
          networkIn += amt;
          networkSalesCount++;
        } else if (cat === 'TRANSFER') {
          transferIn += amt;
          transferSalesCount++;
        }
      } else {
        if (cat === 'CASH') {
          cashOut += amt;
        } else if (cat === 'NETWORK') {
          networkOut += amt;
        } else if (cat === 'TRANSFER') {
          transferOut += amt;
        }
      }
    });

    const cashNet = cashIn - cashOut;
    const networkNet = networkIn - networkOut;
    const transferNet = transferIn - transferOut;

    return {
      cash: {
        in: cashIn,
        out: cashOut,
        net: cashNet,
        salesCount: cashSalesCount,
      },
      network: {
        in: networkIn,
        out: networkOut,
        net: networkNet,
        salesCount: networkSalesCount,
      },
      transfer: {
        in: transferIn,
        out: transferOut,
        net: transferNet,
        salesCount: transferSalesCount,
      },
      deferred: {
        receivables: deferredReceivables,
        payables: deferredPayables,
        net: deferredReceivables - deferredPayables,
      },
      totalLiquidFunds: cashNet + networkNet + transferNet,
    };
  }, [periodSales, periodPurchases, periodExpenses, periodVouchers]);

  // Datasets filtered by selectedPaymentMethod (if active)
  const filteredSales = useMemo(() => {
    return periodSales.filter((s) => matchesPaymentMethodFilter(s.paymentMethod, selectedPaymentMethod));
  }, [periodSales, selectedPaymentMethod]);

  const filteredPurchases = useMemo(() => {
    return periodPurchases.filter((p) => matchesPaymentMethodFilter(p.paymentMethod, selectedPaymentMethod));
  }, [periodPurchases, selectedPaymentMethod]);

  const filteredExpenses = useMemo(() => {
    return periodExpenses.filter((e) => matchesPaymentMethodFilter(e.paymentMethod, selectedPaymentMethod));
  }, [periodExpenses, selectedPaymentMethod]);

  const filteredVouchers = useMemo(() => {
    return periodVouchers.filter((v) => matchesPaymentMethodFilter(v.paymentMethod, selectedPaymentMethod));
  }, [periodVouchers, selectedPaymentMethod]);

  // Vouchers Specific Metrics (سندات القبض والصرف)
  const voucherMetrics = useMemo(() => {
    let receiptTotal = 0;
    let paymentTotal = 0;
    let receiptCount = 0;
    let paymentCount = 0;
    let settlementTotal = 0;
    let settlementCount = 0;

    filteredVouchers.forEach((v) => {
      if (v.type === 'receipt') {
        receiptTotal += v.amount || 0;
        receiptCount++;
        if (
          v.isInvoiceSettlement ||
          (v.relatedInvoiceNo && sales.some((s) => s.id === v.relatedInvoiceNo || (s.invoiceNo && s.invoiceNo === v.relatedInvoiceNo)))
        ) {
          settlementTotal += v.amount || 0;
          settlementCount++;
        }
      } else {
        paymentTotal += v.amount || 0;
        paymentCount++;
      }
    });

    const directReceipts = Math.max(0, receiptTotal - settlementTotal);

    return {
      receiptTotal,
      paymentTotal,
      settlementTotal,
      settlementCount,
      directReceipts,
      netVouchers: receiptTotal - paymentTotal,
      receiptCount,
      paymentCount,
      totalCount: filteredVouchers.length,
    };
  }, [filteredVouchers, sales]);

  // Compute Period Metrics
  const periodMetrics = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + s.netTotal, 0);
    const salesPaid = filteredSales.reduce((sum, s) => sum + s.paidAmount, 0);
    const customerReceivables = filteredSales.reduce((sum, s) => sum + s.remainingAmount, 0);

    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + p.total, 0);
    const purchasesPaid = filteredPurchases.reduce((sum, p) => sum + p.paidAmount, 0);
    const supplierPayables = filteredPurchases.reduce((sum, p) => sum + p.remainingAmount, 0);

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const netProfit = totalSales - totalPurchases - totalExpenses;
    // التحصيل النقدي الفعلي = ما تم تحصيله من الفواتير + المقبوضات المباشرة فقط (تجنب تدبيل تسويات الفواتير)
    const actualCashCollected = salesPaid + voucherMetrics.directReceipts;
    const actualCashOutflow = purchasesPaid + totalExpenses + voucherMetrics.paymentTotal;
    const netCashFlow = actualCashCollected - actualCashOutflow;

    const unpaidCount = filteredSales.filter((s) => s.paymentStatus.includes('🔴') || s.paymentStatus.includes('غير مسدد')).length;

    return {
      totalSales,
      salesPaid,
      customerReceivables,
      totalPurchases,
      purchasesPaid,
      supplierPayables,
      totalExpenses,
      netProfit,
      actualCashCollected,
      actualCashOutflow,
      netCashFlow,
      unpaidCount,
      transactionsCount: filteredSales.length + filteredPurchases.length + filteredExpenses.length + filteredVouchers.length,
    };
  }, [filteredSales, filteredPurchases, filteredExpenses, filteredVouchers, voucherMetrics]);

  // Unified Financial Movements Log (All transactions in selected period)
  const financialMovements: FinancialMovement[] = useMemo(() => {
    const list: FinancialMovement[] = [];

    filteredSales.forEach((s) => {
      const collectedAmount = s.paidAmount > 0 ? s.paidAmount : (s.paymentStatus.includes('✅') ? s.netTotal : 0);
      list.push({
        id: `move-sale-${s.id}`,
        date: s.receiptDate,
        type: 'SALE_INCOME',
        typeLabel: isEn ? 'Sales Inflow' : 'وارد مبيعات',
        title: s.customerName,
        subtitle: `${s.invoiceNo} • ${s.serviceType}`,
        paymentMethod: s.paymentMethod,
        amount: collectedAmount > 0 ? collectedAmount : s.netTotal,
        isCredit: true,
        status: s.paymentStatus,
      });
    });

    filteredPurchases.forEach((p) => {
      const paidAmount = p.paidAmount > 0 ? p.paidAmount : (p.paymentStatus.includes('✅') ? p.total : 0);
      list.push({
        id: `move-purch-${p.id}`,
        date: p.date,
        type: 'PURCHASE_EXPENSE',
        typeLabel: isEn ? 'Purchase Outflow' : 'منصرف مشتريات',
        title: p.supplier || (isEn ? 'Supplier' : 'مورد خامات/خدمات'),
        subtitle: `${p.supplierInvoiceNo ? `${isEn ? 'Invoice' : 'فاتورة'} ${p.supplierInvoiceNo} • ` : ''}${p.item}`,
        paymentMethod: p.paymentMethod,
        amount: paidAmount > 0 ? paidAmount : p.total,
        isCredit: false,
        status: p.paymentStatus,
      });
    });

    filteredExpenses.forEach((e) => {
      list.push({
        id: `move-exp-${e.id}`,
        date: e.date,
        type: 'GENERAL_EXPENSE',
        typeLabel: isEn ? 'Operating Expense' : 'مصروف تشغيلي',
        title: e.expenseType,
        subtitle: `${e.category}${e.notes ? ` • ${e.notes}` : ''}`,
        paymentMethod: e.paymentMethod,
        amount: e.amount,
        isCredit: false,
      });
    });

    // Add Vouchers (سندات القبض والصرف) to financial movements
    filteredVouchers.forEach((v) => {
      const isReceipt = v.type === 'receipt';
      const isSettlement = Boolean(
        v.isInvoiceSettlement ||
        (v.relatedInvoiceNo && sales.some((s) => s.id === v.relatedInvoiceNo || (s.invoiceNo && s.invoiceNo === v.relatedInvoiceNo)))
      );
      list.push({
        id: `move-vouch-${v.id}`,
        date: v.date,
        type: isReceipt ? 'VOUCHER_RECEIPT' : 'VOUCHER_PAYMENT',
        typeLabel: isReceipt
          ? isSettlement
            ? (isEn ? 'Invoice Settlement' : 'تسوية فاتورة')
            : (isEn ? 'Receipt Voucher' : 'سند قبض')
          : (isEn ? 'Payment Voucher' : 'سند صرف'),
        title: v.partyName,
        subtitle: `${v.voucherNo} • ${v.description || (isReceipt ? (isEn ? 'Receipt' : 'مقبوضات') : (isEn ? 'Payment' : 'مدفوعات'))}${v.relatedInvoiceNo ? ` • ${isEn ? 'Invoice' : 'فاتورة'} ${v.relatedInvoiceNo}` : ''}${isSettlement ? ` (${isEn ? 'Non-doubled in cash' : 'لا تكرر في الصندوق'})` : ''}`,
        paymentMethod: v.paymentMethod,
        amount: v.amount,
        isCredit: isReceipt,
        status: isEn ? '✅ Approved' : '✅ معتمد',
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredSales, filteredPurchases, filteredExpenses, filteredVouchers, sales, isEn]);

  const displayedMovements = financialMovements.filter((m) => {
    if (movementFilter === 'INCOME' && !m.isCredit) return false;
    if (movementFilter === 'EXPENSE' && m.isCredit) return false;
    if (!matchesPaymentMethodFilter(m.paymentMethod, movementPaymentFilter)) return false;
    return true;
  });

  // Urgent items
  const delayedOrders = sales.filter((s) => typeof s.delayDays === 'number' && s.delayDays > 0);
  const lowStockItems = inventory.filter((i) => i.status.includes('طلب شراء') || i.status.includes('منخفض'));
  const unpaidSales = sales.filter((s) => s.paymentStatus.includes('غير مسدد'));

  // Periodic Chart Data (grouped by date/month for clear financial visualization)
  const chartData = useMemo(() => {
    const dateMap = new Map<
      string,
      { date: string; label: string; sales: number; purchases: number; expenses: number; profit: number }
    >();

    const isSingleMonthOrLess =
      filterPreset === 'TODAY' ||
      filterPreset === 'THIS_WEEK' ||
      Boolean(selectedDate) ||
      (Boolean(selectedMonth) && !selectedMonth.includes('ALL'));

    const getKeyAndLabel = (dateStr: string) => {
      if (!dateStr) return { key: 'أخرى', label: 'أخرى' };
      if (isSingleMonthOrLess) {
        return { key: dateStr, label: dateStr.length >= 10 ? dateStr.slice(5) : dateStr };
      } else {
        const monthKey = dateStr.slice(0, 7);
        return { key: monthKey, label: monthKey };
      }
    };

    filteredSales.forEach((s) => {
      const { key, label } = getKeyAndLabel(s.receiptDate);
      const existing = dateMap.get(key) || { date: key, label, sales: 0, purchases: 0, expenses: 0, profit: 0 };
      existing.sales += s.netTotal;
      dateMap.set(key, existing);
    });

    filteredPurchases.forEach((p) => {
      const { key, label } = getKeyAndLabel(p.invoiceDate);
      const existing = dateMap.get(key) || { date: key, label, sales: 0, purchases: 0, expenses: 0, profit: 0 };
      existing.purchases += p.totalWithTax;
      dateMap.set(key, existing);
    });

    filteredExpenses.forEach((e) => {
      const { key, label } = getKeyAndLabel(e.expenseDate);
      const existing = dateMap.get(key) || { date: key, label, sales: 0, purchases: 0, expenses: 0, profit: 0 };
      existing.expenses += e.amount;
      dateMap.set(key, existing);
    });

    const list = Array.from(dateMap.values()).map((item) => ({
      ...item,
      profit: Math.round((item.sales - item.purchases - item.expenses) * 100) / 100,
    }));

    list.sort((a, b) => a.date.localeCompare(b.date));

    if (list.length === 0) {
      return [
        {
          date: 'الفترة النشطة',
          label: 'الفترة النشطة',
          sales: periodMetrics.totalSales,
          purchases: periodMetrics.totalPurchases,
          expenses: periodMetrics.totalExpenses,
          profit: periodMetrics.netProfit,
        },
      ];
    }
    return list;
  }, [filteredSales, filteredPurchases, filteredExpenses, filterPreset, selectedDate, selectedMonth, periodMetrics]);

  // Distribution chart data
  const distributionData = useMemo(() => {
    return [
      { name: 'مبيعات محصلة نقداً', value: periodMetrics.salesPaid, color: '#10b981' },
      { name: 'مشتريات خامات مدفوعة', value: periodMetrics.purchasesPaid, color: '#6366f1' },
      { name: 'مصروفات تشغيلية', value: periodMetrics.expensesPaid, color: '#f43f5e' },
      { name: 'ذمم مدينة آجلة للعملاء', value: periodMetrics.customerReceivables, color: '#f59e0b' },
    ].filter((d) => d.value > 0);
  }, [periodMetrics]);

  const handleResetFilter = () => {
    setFilterPreset('ALL');
    setSelectedMonth('');
    setSelectedDate('');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedChannel('ALL');
    setSelectedPaymentMethod('ALL');
    setMovementPaymentFilter('ALL');
  };

  return (
    <div className="space-y-5">
      {/* Viewer Mode Notice */}
      {userRole === 'viewer' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-bold shadow-xs">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{t.viewerReadOnlyNotice}</span>
        </div>
      )}

      {/* Top Quick Action Bar */}
      <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>{currentLang === 'en' ? 'Dashboard & Accounting Indicators' : 'لوحة القيادة والمؤشرات المحاسبية'}</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {currentLang === 'en' ? 'Live Cloud Sync' : 'تحديث فوري لجميع الأوراق'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentLang === 'en'
              ? 'Complete overview of all transactions with periodic filtering and analytics'
              : 'تحكم مباشر في جميع العمليات مع دعم الفلترة الدقيقة بالشهور والأيام'}
          </p>
        </div>

        {userRole !== 'viewer' && (
          <div className="flex items-center flex-wrap gap-2">
            <button
              id="btn-quick-new-sale"
              onClick={onOpenNewSale}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.newSaleBtn}</span>
            </button>
            <button
              id="btn-quick-new-purchase"
              onClick={onOpenNewPurchase}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.newPurchaseBtn}</span>
            </button>
            <button
              id="btn-quick-new-expense"
              onClick={onOpenNewExpense}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.newExpenseBtn}</span>
            </button>
            {canAccessInventory && (
              <button
                id="btn-quick-new-inv"
                onClick={onOpenNewInventory}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t.newInventoryBtn}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Unified Compact Filter Bar */}
      <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Right: Period & Channel Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <select
                id="select-dashboard-period"
                value={
                  selectedMonth
                    ? 'SPECIFIC_MONTH'
                    : selectedDate
                    ? 'SPECIFIC_DATE'
                    : filterPreset
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'SPECIFIC_MONTH') {
                    setFilterPreset('CUSTOM');
                    setSelectedDate('');
                    if (!selectedMonth && availableMonths.length > 0) {
                      setSelectedMonth(availableMonths[0]);
                    }
                  } else if (val === 'SPECIFIC_DATE') {
                    setFilterPreset('CUSTOM');
                    setSelectedMonth('');
                    if (!selectedDate) {
                      setSelectedDate(new Date().toISOString().split('T')[0]);
                    }
                  } else if (val === 'CUSTOM') {
                    setFilterPreset('CUSTOM');
                    setSelectedMonth('');
                    setSelectedDate('');
                  } else {
                    setFilterPreset(val as DateFilterPreset);
                    setSelectedMonth('');
                    setSelectedDate('');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }
                }}
                className="text-xs py-1.5 px-3 rounded-lg border border-slate-300 bg-slate-50 font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">📅 كل الفترات المحاسبية</option>
                <option value="TODAY">اليوم</option>
                <option value="THIS_WEEK">هذا الأسبوع</option>
                <option value="THIS_MONTH">هذا الشهر</option>
                <option value="LAST_MONTH">الشهر الماضي</option>
                <option value="THIS_YEAR">هذا العام</option>
                <option value="SPECIFIC_MONTH">شهر محدد...</option>
                <option value="SPECIFIC_DATE">يوم محدد...</option>
                <option value="CUSTOM">نطاق تاريخ مخصص...</option>
              </select>
            </div>

            {/* Sales Channel Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">القناة:</span>
              <select
                id="select-dashboard-channel"
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-lg border border-slate-300 bg-slate-50 font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">🏷️ جميع قنوات ومصادر البيع</option>
                {availableChannels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">طريقة الدفع:</span>
              <select
                id="select-dashboard-payment-method"
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-lg border border-slate-300 bg-slate-50 font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">💳 جميع طرق الدفع</option>
                <option value="CASH">💵 كاش (نقد)</option>
                <option value="NETWORK">💳 شبكة (مدى/بطاقة)</option>
                <option value="TRANSFER">🏦 تحويل بنكي</option>
                <option value="DEFERRED">⏳ آجل</option>
              </select>
            </div>

            {/* Contextual Date/Month Pickers */}
            {selectedMonth && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-indigo-300 bg-indigo-50/50 font-medium text-indigo-900"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}

            {selectedDate && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-indigo-300 bg-indigo-50/50 font-medium text-indigo-900"
              />
            )}

            {filterPreset === 'CUSTOM' && !selectedMonth && !selectedDate && (
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  placeholder="من"
                  className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                />
                <span className="text-slate-400">إلى</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  placeholder="إلى"
                  className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            )}
          </div>

          {/* Left: Active Filter Badge & Reset */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1">
              <span>{filterLabel}</span>
              {selectedChannel !== 'ALL' && <span>• {selectedChannel}</span>}
              {selectedPaymentMethod !== 'ALL' && (
                <span className="text-emerald-700 bg-emerald-100/70 px-1 rounded">
                  • {selectedPaymentMethod === 'CASH' ? (isEn ? '💵 Cash' : '💵 كاش') : selectedPaymentMethod === 'NETWORK' ? (isEn ? '💳 Card' : '💳 شبكة') : selectedPaymentMethod === 'TRANSFER' ? (isEn ? '🏦 Transfer' : '🏦 تحويل') : selectedPaymentMethod === 'DEFERRED' ? (isEn ? '⏳ Deferred' : '⏳ آجل') : selectedPaymentMethod}
                </span>
              )}
              <span className="font-mono text-[11px] font-bold mr-1">({periodMetrics.transactionsCount} {isEn ? 'txns' : 'حركة'})</span>
            </span>
            {(filterPreset !== 'ALL' || selectedMonth || selectedDate || customStartDate || customEndDate || selectedChannel !== 'ALL' || selectedPaymentMethod !== 'ALL') && (
              <button
                type="button"
                id="btn-reset-dashboard-filter"
                onClick={handleResetFilter}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline px-1.5 py-1 cursor-pointer"
              >
                {isEn ? 'Reset Filters ✕' : 'إعادة ضبط ✕'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 8 Accounting Indicators (Responsive to Active Period) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Sales */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isEn ? 'Total Sales' : 'إجمالي المبيعات'} ({filterLabel})
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {formatMoney(periodMetrics.totalSales)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-emerald-700 font-semibold">
              {isEn ? 'Cash collected:' : 'المحصل نقداً:'} {formatMoney(periodMetrics.salesPaid)}
            </span>
            <button
              onClick={() => setActiveTab('sales')}
              className="text-emerald-600 hover:text-emerald-800 font-semibold cursor-pointer"
            >
              {isEn ? 'View records →' : 'عرض السجلات ←'}
            </button>
          </div>
        </div>

        {/* 2. Total Purchases */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isEn ? 'Total Purchases' : 'إجمالي المشتريات'} ({filterLabel})
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {formatMoney(periodMetrics.totalPurchases)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-indigo-700 font-semibold">
              {isEn ? 'Paid to suppliers:' : 'المدفوع للموردين:'} {formatMoney(periodMetrics.purchasesPaid)}
            </span>
            <button
              onClick={() => setActiveTab('purchases')}
              className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              {isEn ? 'View records →' : 'عرض السجلات ←'}
            </button>
          </div>
        </div>

        {/* 3. Total Expenses */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isEn ? 'Total Expenses' : 'إجمالي المصروفات'} ({filterLabel})
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {formatMoney(periodMetrics.totalExpenses)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-rose-600 font-semibold">
              {filteredExpenses.length} {isEn ? 'expense vouchers' : 'سندات صرف'}
            </span>
            <button
              onClick={() => setActiveTab('expenses')}
              className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
            >
              {isEn ? 'View records →' : 'عرض السجلات ←'}
            </button>
          </div>
        </div>

        {/* 4. Net Profit */}
        <div
          className={`rounded-xl p-4 sm:p-5 border shadow-sm relative overflow-hidden ${
            periodMetrics.netProfit >= 0
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50/50 border-emerald-200'
              : 'bg-rose-50/70 border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {isEn ? 'Net Profit for Period' : 'صافي الربح للفترة'}
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                periodMetrics.netProfit >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-xl sm:text-2xl font-black ${
              periodMetrics.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            {formatMoney(periodMetrics.netProfit)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
            <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200">
              {isEn ? '=Sales - Purchases - Expenses' : '=المبيعات - المشتريات - المصروفات'}
            </span>
            <span className="text-slate-500 font-medium">
              {isEn ? 'Margin:' : 'هامش:'}{' '}
              {periodMetrics.totalSales > 0
                ? ((periodMetrics.netProfit / periodMetrics.totalSales) * 100).toFixed(1)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* 5. Customer Receivables */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isEn ? 'Customer Receivables' : 'المستحقات من العملاء'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-700">
            {formatMoney(periodMetrics.customerReceivables)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-amber-700 font-medium">{isEn ? 'Deferred amounts in period' : 'مبالغ آجلة في الفترة'}</span>
            <span className="text-slate-400">{isEn ? 'Accounts Receivable' : 'ذمم مدينة'}</span>
          </div>
        </div>

        {/* 6. Supplier Payables */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isEn ? 'Supplier Payables' : 'المستحقات للموردين'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-700">
            {formatMoney(periodMetrics.supplierPayables)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-purple-700 font-medium">{isEn ? 'Remaining payables' : 'ديون متبقية للموردين'}</span>
            <span className="text-slate-400">{isEn ? 'Accounts Payable' : 'ذمم دائنة'}</span>
          </div>
        </div>

        {/* 7. Actual Net Cash Flow */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 rounded-xl p-4 sm:p-5 border border-blue-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
              {isEn ? 'Net Collected Cash Liquidity' : 'صافي السيولة النقدية المحصلة'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-950">
            {formatMoney(periodMetrics.netCashFlow)}
          </div>
          <div className="mt-2 pt-2 border-t border-blue-200/60 flex items-center justify-between text-[11px] text-blue-800">
            <span>{isEn ? 'Cash In - Cash Out' : 'النقد الداخل - النقد الخارج'}</span>
            <span className="font-bold">{isEn ? 'Actual Liquidity' : 'سيولة نقدية فعلية'}</span>
          </div>
        </div>

        {/* 8. Unpaid Invoices Count */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isEn ? 'Unpaid Invoices in Period' : 'فواتير غير مسددة بالفترة'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-700 flex items-baseline gap-2">
            <span>{periodMetrics.unpaidCount}</span>
            <span className="text-xs font-normal text-slate-500">{isEn ? 'invoices' : 'فاتورة'}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-rose-600 font-semibold">{isEn ? 'Requires follow-up' : 'تحتاج متابعة وتحصيل'}</span>
            <button
              onClick={() => setActiveTab('sales')}
              className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
            >
              {isEn ? 'Follow up →' : 'متابعة ←'}
            </button>
          </div>
        </div>
      </div>

      {/* Vouchers Movement Section (سندات القبض والصرف في المؤشرات) */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                <span>{isEn ? 'Financial Vouchers Movements (Receipt & Payment)' : 'حركات السندات المالية (سندات القبض والصرف)'}</span>
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {filterLabel} • {voucherMetrics.totalCount} {isEn ? 'vouchers' : 'سند'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEn ? 'Track voucher cash flows and direct liquidity impact' : 'متابعة حركة المقبوضات والمدفوعات الصادرة عبر السندات وتأثيرها المباشر على النقدية'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('vouchers')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 transition flex items-center gap-1 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
          >
            <span>{isEn ? 'Open Vouchers Log' : 'فتح سجل السندات'}</span>
            <span>{isEn ? '→' : '←'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Receipt Vouchers */}
          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isEn ? 'Total Receipt Vouchers (Inflow)' : 'إجمالي سندات القبض (وارد)'}</span>
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-mono font-bold">
                {voucherMetrics.receiptCount} {isEn ? 'vouchers' : 'سند'}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
              {formatMoney(voucherMetrics.receiptTotal)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {isEn ? 'Cash receipts recorded by vouchers' : 'مقبوضات مالية مسجلة بالسندات'}
            </span>
          </div>

          {/* Card 2: Payment Vouchers */}
          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                <span>{isEn ? 'Total Payment Vouchers (Outflow)' : 'إجمالي سندات الصرف (منصرف)'}</span>
              </span>
              <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md font-mono font-bold">
                {voucherMetrics.paymentCount} {isEn ? 'vouchers' : 'سند'}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
              {formatMoney(voucherMetrics.paymentTotal)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {isEn ? 'Cash payments recorded by vouchers' : 'مدفوعات مالية مسجلة بالسندات'}
            </span>
          </div>

          {/* Card 3: Net Vouchers Balance */}
          <div className={`rounded-xl p-3.5 border ${
            voucherMetrics.netVouchers >= 0
              ? 'bg-emerald-50/50 border-emerald-200'
              : 'bg-rose-50/50 border-rose-200'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700">
                {isEn ? 'Net Vouchers (Receipts - Payments)' : 'صافي حركة السندات (القبض - الصرف)'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${
                voucherMetrics.netVouchers >= 0
                  ? 'bg-emerald-100/70 text-emerald-800 border-emerald-300'
                  : 'bg-rose-100/70 text-rose-800 border-rose-300'
              }`}>
                {voucherMetrics.netVouchers >= 0 ? (isEn ? 'Surplus 🟢' : 'فائض نقدي 🟢') : (isEn ? 'Deficit 🔴' : 'عجز منصرف 🔴')}
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${
              voucherMetrics.netVouchers >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {formatMoney(voucherMetrics.netVouchers)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {isEn ? 'Direct net cash difference from vouchers' : 'الفارق النقدي المباشر من السندات'}
            </span>
          </div>
        </div>
      </div>

      {/* Treasury & Payment Methods Balances (كم موجود كاش و كم موجود شبكة و كم تحويل) */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                <span>{isEn ? 'Treasury Funds & Payment Balances' : 'أرصدة صناديق الدفع والسيولة النقدية (الخزينة)'}</span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {filterLabel}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEn ? 'Track real balances: Cash in drawer, POS card, and Bank account' : 'تتبع الأرصدة الحقيقية المتاحة: كم موجود كاش في الدرج، كم بالشبكة، وكم بالحساب البنكي'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-left">
              <span className="text-[10px] text-slate-500 block">{isEn ? 'Total Actual Liquid Funds' : 'إجمالي السيولة النقدية الفعلية'}</span>
              <span className="text-sm sm:text-base font-black text-slate-900 font-mono">
                {formatMoney(treasuryFunds.totalLiquidFunds)}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Treasury Fund Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Cash Fund */}
          <div
            className={`rounded-xl p-4 border transition ${
              movementPaymentFilter === 'CASH'
                ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500 shadow-sm'
                : 'bg-emerald-50/30 border-emerald-200/80 hover:bg-emerald-50/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <span>💵</span>
                <span>{isEn ? 'Cash Fund (Drawer)' : 'صندوق الكاش (النقد)'}</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                {isEn ? 'Cash Drawer' : 'درج النقدية'}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-900 font-mono">
              {formatMoney(treasuryFunds.cash.net)}
            </div>
            <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-emerald-200/60 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-emerald-700">{isEn ? 'Inflow (+):' : 'وارد مبيعات (+):'}</span>
                <span className="font-mono font-bold text-emerald-800">+{formatMoney(treasuryFunds.cash.in)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-rose-600">{isEn ? 'Outflow (-):' : 'منصرف مشتريات/مصاريف (-):'}</span>
                <span className="font-mono font-bold text-rose-700">-{formatMoney(treasuryFunds.cash.out)}</span>
              </div>
            </div>
            <button
              type="button"
              id="btn-filter-movements-cash"
              onClick={() => setMovementPaymentFilter(movementPaymentFilter === 'CASH' ? 'ALL' : 'CASH')}
              className={`w-full mt-3 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                movementPaymentFilter === 'CASH'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              <span>{movementPaymentFilter === 'CASH' ? (isEn ? 'Clear Cash Filter ✕' : 'إلغاء تصفية الكاش ✕') : (isEn ? 'Filter Cash Movements →' : 'عرض حركات الكاش بالسجل ←')}</span>
            </button>
          </div>

          {/* 2. Network Fund */}
          <div
            className={`rounded-xl p-4 border transition ${
              movementPaymentFilter === 'NETWORK'
                ? 'bg-sky-50/80 border-sky-400 ring-2 ring-sky-500 shadow-sm'
                : 'bg-sky-50/30 border-sky-200/80 hover:bg-sky-50/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                <span>💳</span>
                <span>{isEn ? 'POS / Card Account' : 'حساب الشبكة (مدى/بطاقات)'}</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                POS
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-sky-900 font-mono">
              {formatMoney(treasuryFunds.network.net)}
            </div>
            <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-sky-200/60 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sky-700">{isEn ? 'Inflow (+):' : 'وارد مبيعات (+):'}</span>
                <span className="font-mono font-bold text-sky-800">+{formatMoney(treasuryFunds.network.in)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-rose-600">{isEn ? 'Outflow (-):' : 'منصرف بالشبكة (-):'}</span>
                <span className="font-mono font-bold text-rose-700">-{formatMoney(treasuryFunds.network.out)}</span>
              </div>
            </div>
            <button
              type="button"
              id="btn-filter-movements-network"
              onClick={() => setMovementPaymentFilter(movementPaymentFilter === 'NETWORK' ? 'ALL' : 'NETWORK')}
              className={`w-full mt-3 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                movementPaymentFilter === 'NETWORK'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'bg-white hover:bg-sky-100 text-sky-800 border border-sky-300'
              }`}
            >
              <span>{movementPaymentFilter === 'NETWORK' ? (isEn ? 'Clear POS Filter ✕' : 'إلغاء تصفية الشبكة ✕') : (isEn ? 'Filter POS Movements →' : 'عرض حركات الشبكة بالسجل ←')}</span>
            </button>
          </div>

          {/* 3. Bank Transfer Fund */}
          <div
            className={`rounded-xl p-4 border transition ${
              movementPaymentFilter === 'TRANSFER'
                ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-500 shadow-sm'
                : 'bg-purple-50/30 border-purple-200/80 hover:bg-purple-50/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <span>🏦</span>
                <span>{isEn ? 'Bank Account (Transfers)' : 'الحساب البنكي (تحويلات)'}</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                {isEn ? 'Direct Transfer' : 'التحويل المباشر'}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-purple-900 font-mono">
              {formatMoney(treasuryFunds.transfer.net)}
            </div>
            <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-purple-200/60 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-purple-700">{isEn ? 'Inflow (+):' : 'وارد تحويل (+):'}</span>
                <span className="font-mono font-bold text-purple-800">+{formatMoney(treasuryFunds.transfer.in)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-rose-600">{isEn ? 'Outflow (-):' : 'منصرف تحويل (-):'}</span>
                <span className="font-mono font-bold text-rose-700">-{formatMoney(treasuryFunds.transfer.out)}</span>
              </div>
            </div>
            <button
              type="button"
              id="btn-filter-movements-transfer"
              onClick={() => setMovementPaymentFilter(movementPaymentFilter === 'TRANSFER' ? 'ALL' : 'TRANSFER')}
              className={`w-full mt-3 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                movementPaymentFilter === 'TRANSFER'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white hover:bg-purple-100 text-purple-800 border border-purple-300'
              }`}
            >
              <span>{movementPaymentFilter === 'TRANSFER' ? (isEn ? 'Clear Transfer Filter ✕' : 'إلغاء تصفية التحويل ✕') : (isEn ? 'Filter Transfers →' : 'عرض حركات التحويل بالسجل ←')}</span>
            </button>
          </div>

          {/* 4. Deferred & Receivables */}
          <div
            className={`rounded-xl p-4 border transition ${
              movementPaymentFilter === 'DEFERRED'
                ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500 shadow-sm'
                : 'bg-amber-50/30 border-amber-200/80 hover:bg-amber-50/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <span>⏳</span>
                <span>{isEn ? 'Deferred Accounts & Payables' : 'المستحقات والذمم الآجلة'}</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                {isEn ? 'Unsettled' : 'غير مسدد'}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-800 font-mono">
              {formatMoney(treasuryFunds.deferred.net)}
            </div>
            <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-amber-200/60 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-amber-700">{isEn ? 'Customer receivables:' : 'لنا عند العملاء (مدين):'}</span>
                <span className="font-mono font-bold text-amber-800">{formatMoney(treasuryFunds.deferred.receivables)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-700">{isEn ? 'Supplier payables:' : 'علينا للموردين (دائن):'}</span>
                <span className="font-mono font-bold text-purple-800">{formatMoney(treasuryFunds.deferred.payables)}</span>
              </div>
            </div>
            <button
              type="button"
              id="btn-filter-movements-deferred"
              onClick={() => setMovementPaymentFilter(movementPaymentFilter === 'DEFERRED' ? 'ALL' : 'DEFERRED')}
              className={`w-full mt-3 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                movementPaymentFilter === 'DEFERRED'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-white hover:bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              <span>{movementPaymentFilter === 'DEFERRED' ? (isEn ? 'Clear Deferred Filter ✕' : 'إلغاء تصفية الآجل ✕') : (isEn ? 'Filter Deferred Movements →' : 'عرض الحركات الآجلة بالسجل ←')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visual Charts Section: Clear & Beautiful Charts for Financial Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Revenue, Purchases, Expenses & Profit Comparison */}
        <div className="lg:col-span-2 bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {isEn ? 'Comparison of Sales, Purchases, Expenses & Net Profit' : 'مقارنة المبيعات والمشتريات والمصروفات وصافي الأرباح'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isEn ? `Chart showing financial flow and accounting performance in (${filterLabel})` : `رسم بياني يوضح التدفق المالي والأداء المحاسبي في فترة (${filterLabel})`}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
              {chartData.length} {isEn ? 'periods' : 'فترة'}
            </span>
          </div>

          <div className="h-72 w-full pt-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(v) => `${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                />
                <Tooltip
                  formatter={(val: any) => [`${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${isEn ? 'SAR' : 'ر.س'}`]}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', textAlign: isEn ? 'left' : 'right' }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    direction: isEn ? 'ltr' : 'rtl',
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontWeight: 'bold' }}
                  formatter={(value) => {
                    if (value === 'sales') return isEn ? 'Sales' : 'المبيعات';
                    if (value === 'purchases') return isEn ? 'Purchases' : 'المشتريات';
                    if (value === 'expenses') return isEn ? 'Expenses' : 'المصروفات';
                    if (value === 'profit') return isEn ? 'Net Profit' : 'صافي الربح';
                    return value;
                  }}
                />
                <Bar dataKey="sales" name="sales" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="purchases" name="purchases" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="expenses" name="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="profit" name="profit" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cash & Payables Distribution (Donut / Pie) */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isEn ? 'Cash Flow Distribution' : 'توزيع التدفقات النقدية'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEn ? 'Ratio of actual collections vs expenses & purchases' : 'نسبة التحصيل الفعلي مقابل المصروفات والمشتريات'}
              </p>
            </div>
          </div>

          <div className="h-52 w-full relative flex items-center justify-center" dir="ltr">
            {distributionData.length === 0 ? (
              <div className="text-xs text-slate-400 text-center">
                {isEn ? 'No cash flow data in selected period' : 'لا توجد بيانات حركة نقدية في الفترة'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(val: any) => [`${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${isEn ? 'SAR' : 'ر.س'}`]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      direction: isEn ? 'ltr' : 'rtl',
                    }}
                  />
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Custom Legend */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
            {distributionData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-slate-600 font-medium text-[11px]">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  {formatMoney(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chronological Accounting Movements Ledger by Dates */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                {isEn ? `Inflows & Accounting Ledger (${filterLabel})` : `سجل المدخولات والحركات المحاسبية في فترة (${filterLabel})`}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEn ? 'Chronological ledger of revenues, expenses and vouchers' : 'تسلسل زمني لجميع الإيرادات والمصروفات وحركات الصرف حسب التواريخ'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-200/70 p-1 rounded-lg text-xs font-bold">
              <button
                onClick={() => setMovementFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  movementFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {isEn ? `All (${financialMovements.length})` : `الكل (${financialMovements.length})`}
              </button>
              <button
                onClick={() => setMovementFilter('INCOME')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  movementFilter === 'INCOME' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                {isEn ? 'Inflows 🟢' : 'المدخولات 🟢'}
              </button>
              <button
                onClick={() => setMovementFilter('EXPENSE')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  movementFilter === 'EXPENSE' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                {isEn ? 'Outflows 🔴' : 'المنصرفات 🔴'}
              </button>
            </div>

            {/* Payment Method filter chips */}
            <div className="flex items-center bg-slate-200/70 p-1 rounded-lg text-xs font-bold">
              <button
                onClick={() => setMovementPaymentFilter('ALL')}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  movementPaymentFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {isEn ? 'All' : 'كل الطرق'}
              </button>
              <button
                onClick={() => setMovementPaymentFilter('CASH')}
                className={`px-2 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  movementPaymentFilter === 'CASH' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <span>💵</span>
                <span>{isEn ? 'Cash' : 'كاش'}</span>
              </button>
              <button
                onClick={() => setMovementPaymentFilter('NETWORK')}
                className={`px-2 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  movementPaymentFilter === 'NETWORK' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-sky-700'
                }`}
              >
                <span>💳</span>
                <span>{isEn ? 'Card' : 'شبكة'}</span>
              </button>
              <button
                onClick={() => setMovementPaymentFilter('TRANSFER')}
                className={`px-2 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  movementPaymentFilter === 'TRANSFER' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-purple-700'
                }`}
              >
                <span>🏦</span>
                <span>{isEn ? 'Transfer' : 'تحويل'}</span>
              </button>
              <button
                onClick={() => setMovementPaymentFilter('DEFERRED')}
                className={`px-2 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  movementPaymentFilter === 'DEFERRED' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                <span>⏳</span>
                <span>{isEn ? 'Deferred' : 'آجل'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">{isEn ? 'Date' : 'التاريخ'}</th>
                <th className="p-3">{isEn ? 'Movement Type' : 'نوع الحركة'}</th>
                <th className="p-3">{isEn ? 'Description / Customer / Supplier' : 'البيان / العميل / المورد'}</th>
                <th className="p-3">{isEn ? 'Payment Method' : 'طريقة الدفع'}</th>
                <th className="p-3 text-left">{isEn ? 'Amount' : 'المبلغ'}</th>
                <th className="p-3 text-center">{isEn ? 'Status' : 'الحالة'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    {isEn ? `No accounting movements match the filter (${filterLabel})` : `لا توجد أي حركات حسابية أو مدخولات مطابقة للتصفية المحددة (${filterLabel})`}
                  </td>
                </tr>
              ) : (
                displayedMovements.map((move) => (
                  <tr key={move.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{move.date}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          move.isCredit
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : move.type === 'PURCHASE_EXPENSE'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {move.isCredit ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                        <span>{move.typeLabel}</span>
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{move.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{move.subtitle}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {(() => {
                        const details = getPaymentMethodDetails(move.paymentMethod);
                        const isSelected = movementPaymentFilter === details.category;
                        return (
                          <button
                            type="button"
                            onClick={() => setMovementPaymentFilter(isSelected ? 'ALL' : details.category)}
                            title={isEn ? `Filter movements by: ${details.shortLabel}` : `تصفية الحركات حسب: ${details.label}`}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer hover:shadow-xs ${
                              isSelected ? details.activeClass : details.badgeClass
                            }`}
                          >
                            <span>{details.icon}</span>
                            <span>{details.shortLabel}</span>
                          </button>
                        );
                      })()}
                    </td>
                    <td className="p-3 text-left whitespace-nowrap font-mono">
                      <span
                        className={`text-xs font-black px-2 py-1 rounded-md ${
                          move.isCredit
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {move.isCredit ? '+' : '-'} {move.amount.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {move.status ? (
                        <span className="text-[11px] text-slate-600">{move.status}</span>
                      ) : (
                        <span className="text-emerald-700 text-[11px] font-semibold">{isEn ? 'Paid' : 'مسدد'}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actionable Urgent Notices Section (Interactive Buttons) */}
      <div className={`grid grid-cols-1 ${canAccessInventory ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-5`}>
        {/* 1. Delayed Orders */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{isEn ? 'Delayed Delivery Orders' : 'طلبات متأخرة التسليم'}</h3>
                <p className="text-[11px] text-slate-400">{isEn ? 'Exceeded scheduled delivery date' : 'تجاوزت موعد التسليم المحدد'}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('sales')}
              className="text-[11px] bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold px-2.5 py-1 rounded-lg border border-rose-200 transition cursor-pointer flex items-center gap-1"
              title={isEn ? 'Open sales tab' : 'فتح تبويب المبيعات والطلبات'}
            >
              <span>{isEn ? 'Open Sales' : 'فتح المبيعات'}</span>
              <span>{isEn ? '→' : '←'}</span>
            </button>
          </div>

          {delayedOrders.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              {isEn ? 'No delayed orders currently, all on schedule ✅' : 'لا توجد أي طلبات متأخرة حالياً، جميع المواعيد منضبطة ✅'}
            </div>
          ) : (
            <div className="space-y-2">
              {delayedOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setActiveTab('sales')}
                  className="w-full text-right p-3 rounded-xl bg-rose-50/70 hover:bg-rose-100 border border-rose-200 text-xs flex items-center justify-between transition cursor-pointer group shadow-2xs"
                  title={isEn ? 'Click to open order in Sales' : 'اضغط لفتح تفاصيل الفاتورة والطلب في تبويب المبيعات'}
                >
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 group-hover:text-rose-900">
                      <span>{order.customerName}</span>
                      <span className="text-[11px] font-mono text-slate-500">({order.invoiceNo})</span>
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {isEn ? 'Service:' : 'الخدمة:'} {order.serviceType} • {isEn ? 'Assigned:' : 'المسؤول:'} {order.assignedTo || '—'}
                    </div>
                  </div>
                  <div className="text-left flex items-center gap-2">
                    <span className="inline-block bg-rose-600 text-white font-bold px-2 py-0.5 rounded text-[11px]">
                      {isEn ? `Delay ${order.delayDays} d` : `تأخير ${order.delayDays} يوم`}
                    </span>
                    <span className="text-rose-600 font-bold group-hover:translate-x-[-3px] transition-transform">
                      {isEn ? '→' : '←'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Low Inventory Notice (Visible only when Inventory tab is accessible) */}
        {canAccessInventory && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <PackageX className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{isEn ? 'Inventory Stock Alerts' : 'تنبيهات خامات المخزون'}</h3>
                  <p className="text-[11px] text-slate-400">{isEn ? 'Low stock or out of stock' : 'وصلت للحد الأدنى أو نفدت'}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('inventory')}
                className="text-[11px] bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold px-2.5 py-1 rounded-lg border border-amber-200 transition cursor-pointer flex items-center gap-1"
                title={isEn ? 'Open inventory tab' : 'فتح تبويب المخزون والخامات'}
              >
                <span>{isEn ? 'Open Inventory' : 'فتح المخزون'}</span>
                <span>{isEn ? '→' : '←'}</span>
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                {isEn ? 'Inventory is well-stocked for all materials 🟢' : 'المخزون متوفر بكميات كافية لجميع الخامات والأحبار 🟢'}
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab('inventory')}
                    className="w-full text-right p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100 border border-amber-200 text-xs flex items-center justify-between transition cursor-pointer group shadow-2xs"
                    title={isEn ? 'Click to open item in Inventory' : 'اضغط لفتح صنف الخامة وإعادة الطلب في تبويب المخزون'}
                  >
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-amber-900">
                        {item.item} - {item.type} ({item.color})
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {isEn ? 'Current Qty:' : 'الكمية الحالية:'}{' '}
                        <span className="font-bold text-amber-900">
                          {item.currentQty} {item.unit}
                        </span>{' '}
                        ({isEn ? 'Min:' : 'الحد الأدنى:'} {item.minQty})
                      </div>
                    </div>
                    <div className="text-left flex items-center gap-2">
                      <span className="bg-amber-600 text-white font-bold px-2 py-0.5 rounded text-[11px]">
                        {item.status}
                      </span>
                      <span className="text-amber-700 font-bold group-hover:translate-x-[-3px] transition-transform">
                        {isEn ? '→' : '←'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Unpaid Invoices Follow-up */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{isEn ? 'Customer Invoices Follow-up' : 'متابعة تحصيل فواتير العملاء'}</h3>
                <p className="text-[11px] text-slate-400">{isEn ? 'Customers with pending unpaid amounts' : 'العملاء ذوو المبالغ الآجلة غير المسددة'}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('sales')}
              className="text-[11px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-1"
              title={isEn ? 'Open sales & invoices tab' : 'فتح تبويب المبيعات والفواتير'}
            >
              <span>{isEn ? 'Open Invoices' : 'فتح الفواتير'}</span>
              <span>{isEn ? '→' : '←'}</span>
            </button>
          </div>

          {unpaidSales.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              {isEn ? 'All invoices fully settled, no pending debts 👏' : 'جميع الفواتير مسددة بالكامل، لا توجد مستحقات معلقة 👏'}
            </div>
          ) : (
            <div className="space-y-2">
              {unpaidSales.slice(0, 4).map((sale) => (
                <button
                  key={sale.id}
                  onClick={() => setActiveTab('sales')}
                  className="w-full text-right p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 text-xs flex items-center justify-between transition cursor-pointer group shadow-2xs"
                  title={isEn ? 'Click to follow up invoice in Sales' : 'اضغط للانتقال لمتابعة وتحصيل الفاتورة في تبويب المبيعات'}
                >
                  <div>
                    <div className="font-bold text-slate-800 group-hover:text-indigo-900">{sale.customerName}</div>
                    <div className="text-slate-500 mt-0.5 font-mono">
                      {sale.customerPhone || (isEn ? 'No phone' : 'بدون هاتف')} • {sale.invoiceNo}
                    </div>
                  </div>
                  <div className="text-left flex items-center gap-2">
                    <div>
                      <div className="font-bold text-rose-700">{formatMoney(sale.remainingAmount)}</div>
                      <span className="text-[10px] text-slate-400">{sale.paymentMethod}</span>
                    </div>
                    <span className="text-indigo-600 font-bold group-hover:translate-x-[-3px] transition-transform">
                      {isEn ? '→' : '←'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Google Sheets Live Link Callout */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h4 className="font-bold text-white text-sm">
              {isEn ? 'Direct Cloud Integration with Google Sheets' : 'التكامل السحابي المباشر مع Google Sheets'}
            </h4>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {isEn
              ? 'Your system is integrated across all sheets (Sales, Purchases, Expenses, Inventory, Dashboard). Sync data with one click or open the file directly in Google Sheets.'
              : 'تم تجهيز نظامك بجميع الأوراق الخمس (المبيعات، المشتريات، المصروفات، المخزون، الداشبورد) مع نفس القوائم المنسدلة والصيغ التلقائية الدقيقة. يمكنك مزامنة البيانات بضغطة زر أو فتح الملف مباشرة في Google Sheets.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {spreadsheetUrl ? (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition"
            >
              <span>{isEn ? 'Open in Google Sheets' : 'فتح الملف في Google Sheets'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              onClick={onOpenSheetsModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
            >
              <span>{isEn ? 'Create Google Sheet Now' : 'إنشاء ملف Google Sheets الآن'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
