import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Filter,
  AlertCircle,
  CreditCard,
  PieChart,
  Eye,
} from 'lucide-react';
import {
  ExpenseItem,
  EXPENSE_TYPES,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  UserRole,
} from '../types';
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

interface ExpensesViewProps {
  expenses: ExpenseItem[];
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  onAddExpense: (item: ExpenseItem) => void;
  onUpdateExpense: (item: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  userRole = 'owner',
  currentLang = 'ar',
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  isModalOpen,
  setIsModalOpen,
}) => {
  const t = getTranslations(currentLang);
  const isEn = currentLang === 'en';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('ALL');
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);

  // Date Filtering State
  const [filterPreset, setFilterPreset] = useState<DateFilterPreset>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Available months from expenses data
  const availableMonths = React.useMemo(() => {
    return extractAvailableMonths(expenses.map((e) => e.date));
  }, [expenses]);

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

  const [formData, setFormData] = useState<Partial<ExpenseItem>>({
    date: new Date().toISOString().split('T')[0],
    expenseType: 'رواتب موظفين',
    category: 'تشغيلية',
    amount: 1000,
    paymentMethod: 'تحويل',
    notes: '',
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      expenseType: '',
      category: '',
      amount: 0,
      paymentMethod: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: ExpenseItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      onUpdateExpense({
        ...editingItem,
        date: formData.date || new Date().toISOString().split('T')[0],
        expenseType: formData.expenseType || 'أخرى',
        category: formData.category || 'تشغيلية',
        amount: Number(formData.amount) || 0,
        paymentMethod: formData.paymentMethod || 'كاش',
        notes: formData.notes || '',
      });
    } else {
      const newItem: ExpenseItem = {
        id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: formData.date || new Date().toISOString().split('T')[0],
        expenseType: formData.expenseType || 'أخرى',
        category: formData.category || 'تشغيلية',
        amount: Number(formData.amount) || 0,
        paymentMethod: formData.paymentMethod || 'كاش',
        notes: formData.notes || '',
      };
      onAddExpense(newItem);
    }
    setIsModalOpen(false);
  };

  // Expenses matching active date range and category
  const periodExpenses = React.useMemo(() => {
    return expenses.filter((e) => {
      const matchesCat = filterCategory === 'ALL' || e.category === filterCategory;
      const matchesDate = isDateWithinRange(e.date, startDate, endDate);
      return matchesCat && matchesDate;
    });
  }, [expenses, filterCategory, startDate, endDate]);

  // Payment methods breakdown for expenses
  const expensePaymentBreakdown = React.useMemo(() => {
    let cash = 0, cashCount = 0;
    let network = 0, networkCount = 0;
    let transfer = 0, transferCount = 0;

    periodExpenses.forEach((e) => {
      const cat = normalizePaymentMethod(e.paymentMethod);
      if (cat === 'CASH') {
        cash += e.amount;
        cashCount++;
      } else if (cat === 'NETWORK') {
        network += e.amount;
        networkCount++;
      } else if (cat === 'TRANSFER') {
        transfer += e.amount;
        transferCount++;
      }
    });

    return { cash, cashCount, network, networkCount, transfer, transferCount };
  }, [periodExpenses]);

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      (e.expenseType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCat = filterCategory === 'ALL' || e.category === filterCategory;
    const matchesPayMethod = matchesPaymentMethodFilter(e.paymentMethod, filterPaymentMethod);
    const matchesDate = isDateWithinRange(e.date, startDate, endDate);

    return matchesSearch && matchesCat && matchesPayMethod && matchesDate;
  });

  const totalSum = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Category breakdown for the filtered period
  const categoryTotals: Record<string, number> = {};
  filteredExpenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const periodTotals = React.useMemo(() => {
    const total = totalSum;
    const count = filteredExpenses.length;
    const average = count > 0 ? total / count : 0;

    let topCategory = '—';
    let topCategoryAmount = 0;
    Object.entries(categoryTotals).forEach(([cat, val]) => {
      if (val > topCategoryAmount) {
        topCategoryAmount = val;
        topCategory = cat;
      }
    });

    return {
      total,
      count,
      average,
      topCategory,
      topCategoryAmount,
    };
  }, [totalSum, filteredExpenses.length, categoryTotals]);

  const isFilterActive =
    filterPreset !== 'ALL' ||
    Boolean(selectedMonth) ||
    Boolean(selectedDate) ||
    Boolean(customStartDate) ||
    Boolean(customEndDate) ||
    filterCategory !== 'ALL' ||
    filterPaymentMethod !== 'ALL' ||
    Boolean(searchTerm);

  const handleResetFilters = () => {
    setFilterPreset('ALL');
    setSelectedMonth('');
    setSelectedDate('');
    setCustomStartDate('');
    setCustomEndDate('');
    setFilterCategory('ALL');
    setFilterPaymentMethod('ALL');
    setSearchTerm('');
  };

  return (
    <div className="space-y-4">
      {/* Viewer Mode Notice */}
      {userRole === 'viewer' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-bold shadow-xs">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{t.viewerReadOnlyNotice}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={currentLang === 'en' ? 'Search by expense type or notes...' : 'بحث بنوع المصروف أو الملاحظات...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentLang === 'en' ? 'Category:' : 'التصنيف:'}</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs py-1.5 px-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="ALL">{currentLang === 'en' ? 'All Categories' : 'جميع التصنيفات'}</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>{currentLang === 'en' ? 'Payment:' : 'طريقة الدفع:'}</span>
            <select
              value={filterPaymentMethod}
              onChange={(e) => setFilterPaymentMethod(e.target.value)}
              className="text-xs py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
            >
              <option value="ALL">💳 {currentLang === 'en' ? 'All Methods' : 'جميع طرق الدفع'}</option>
              <option value="CASH">💵 {currentLang === 'en' ? 'Cash' : 'كاش (نقد)'}</option>
              <option value="TRANSFER">🏦 {currentLang === 'en' ? 'Bank Transfer' : 'تحويل بنكي'}</option>
              <option value="NETWORK">💳 {currentLang === 'en' ? 'Card / POS' : 'شبكة'}</option>
            </select>
          </div>

          {userRole !== 'viewer' && (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t.newExpense}</span>
            </button>
          )}
        </div>
      </div>

      {/* Date & Category Filter Bar (مثل لوحة التحكم) */}
      <DateFilterBar
        idPrefix="expenses-date-filter"
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
        totalCount={filteredExpenses.length}
        countLabel={isEn ? 'expense vouchers' : 'سند صرف'}
        onReset={handleResetFilters}
        isFilterActive={isFilterActive}
        channelLabel={isEn ? 'Category:' : 'التصنيف:'}
        selectedChannel={filterCategory}
        onChannelChange={setFilterCategory}
        availableChannels={EXPENSE_CATEGORIES}
        allChannelsLabel={isEn ? '🏷️ All Categories' : '🏷️ جميع التصنيفات'}
        paymentMethodLabel={isEn ? 'Payment Method:' : 'طريقة الدفع:'}
        selectedPaymentMethod={filterPaymentMethod}
        onPaymentMethodChange={setFilterPaymentMethod}
        currentLang={currentLang}
      />

      {/* Period Totals Summary Cards (إجماليات الفترة لمعرفة كم صرفنا في تبويب المصروفات) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">
            {isEn ? 'Period Expenses Total' : 'إجمالي مصروفات الفترة'}
          </span>
          <span className="text-base sm:text-lg font-bold text-rose-700 font-mono">
            {periodTotals.total.toFixed(2)} <span className="text-xs font-sans text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{filterLabel}</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <span className="text-xs text-rose-800 font-medium block">
            {isEn ? 'Top Expense Category' : 'أعلى تصنيف إنفاق'}
          </span>
          <span className="text-sm sm:text-base font-bold text-rose-900 block truncate">
            {periodTotals.topCategory}
          </span>
          <span className="text-[10px] text-rose-600 block mt-0.5 font-mono">
            {periodTotals.topCategoryAmount.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">
            {isEn ? 'Average Expense Voucher' : 'متوسط سند الصرف'}
          </span>
          <span className="text-base sm:text-lg font-bold text-slate-800 font-mono">
            {periodTotals.average.toFixed(2)} <span className="text-xs font-sans text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {isEn ? 'Per expense txn' : 'لكل عملية صرف'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">
            {isEn ? 'Expense Vouchers Count' : 'عدد سندات الصرف'}
          </span>
          <span className="text-base sm:text-lg font-bold text-slate-800 font-mono">
            {periodTotals.count} <span className="text-xs font-sans text-slate-500">{isEn ? 'vouchers' : 'سند'}</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {isEn ? 'Within selected period' : 'ضمن الفترة المحددة'}
          </span>
        </div>
      </div>

      {/* Payment Method Breakdown & Quick Filter for Expenses */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <span>{isEn ? '💳 Period Expense Payment Methods:' : '💳 طرق صرف المصروفات بالفترة:'}</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'CASH' ? 'ALL' : 'CASH')}
            className={`p-2.5 rounded-lg border text-right transition cursor-pointer flex items-center justify-between ${
              filterPaymentMethod === 'CASH'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-400'
                : 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200 text-slate-800'
            }`}
          >
            <div>
              <span className={`font-bold block ${filterPaymentMethod === 'CASH' ? 'text-white' : 'text-emerald-900'}`}>
                {isEn ? '💵 Cash Expenses' : '💵 مصروفات كاش (نقد)'}
              </span>
              <span className={`text-[10px] ${filterPaymentMethod === 'CASH' ? 'text-emerald-100' : 'text-slate-500'}`}>
                {expensePaymentBreakdown.cashCount} {isEn ? 'vouchers' : 'سند صرف'}
              </span>
            </div>
            <span className="font-mono font-black text-sm sm:text-base">
              {expensePaymentBreakdown.cash.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'TRANSFER' ? 'ALL' : 'TRANSFER')}
            className={`p-2.5 rounded-lg border text-right transition cursor-pointer flex items-center justify-between ${
              filterPaymentMethod === 'TRANSFER'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-400'
                : 'bg-purple-50/40 hover:bg-purple-50/80 border-purple-200 text-slate-800'
            }`}
          >
            <div>
              <span className={`font-bold block ${filterPaymentMethod === 'TRANSFER' ? 'text-white' : 'text-purple-900'}`}>
                {isEn ? '🏦 Bank Transfer Expenses' : '🏦 مصروفات تحويل بنكي'}
              </span>
              <span className={`text-[10px] ${filterPaymentMethod === 'TRANSFER' ? 'text-purple-100' : 'text-slate-500'}`}>
                {expensePaymentBreakdown.transferCount} {isEn ? 'vouchers' : 'سند صرف'}
              </span>
            </div>
            <span className="font-mono font-black text-sm sm:text-base">
              {expensePaymentBreakdown.transfer.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterPaymentMethod(filterPaymentMethod === 'NETWORK' ? 'ALL' : 'NETWORK')}
            className={`p-2.5 rounded-lg border text-right transition cursor-pointer flex items-center justify-between ${
              filterPaymentMethod === 'NETWORK'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-400'
                : 'bg-sky-50/40 hover:bg-sky-50/80 border-sky-200 text-slate-800'
            }`}
          >
            <div>
              <span className={`font-bold block ${filterPaymentMethod === 'NETWORK' ? 'text-white' : 'text-sky-900'}`}>
                {isEn ? '💳 Card Expenses' : '💳 مصروفات شبكة'}
              </span>
              <span className={`text-[10px] ${filterPaymentMethod === 'NETWORK' ? 'text-sky-100' : 'text-slate-500'}`}>
                {expensePaymentBreakdown.networkCount} {isEn ? 'vouchers' : 'سند صرف'}
              </span>
            </div>
            <span className="font-mono font-black text-sm sm:text-base">
              {expensePaymentBreakdown.network.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}
            </span>
          </button>
        </div>
      </div>

      {/* Category Breakdown Chips for Selected Period */}
      <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-600 font-bold ml-1">
          {isEn ? 'Period Expenses Distribution:' : 'توزيع مصروفات الفترة:'}
        </span>
        {EXPENSE_CATEGORIES.map((cat) => {
          const val = categoryTotals[cat] || 0;
          const isSelected = filterCategory === cat;
          return (
            <button
              type="button"
              key={cat}
              onClick={() => setFilterCategory(isSelected ? 'ALL' : cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-rose-700 text-white shadow-2xs font-bold'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{cat}</span>
              <span className={`font-mono text-[11px] ${isSelected ? 'text-rose-100' : 'text-slate-500 font-bold'}`}>
                ({val.toFixed(2)} {isEn ? 'SAR' : 'ر.س'})
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              {isEn ? '3. Expenses Sheet' : '3. ورقة المصروفات (Expenses)'}
            </span>
            <span className="bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-full text-[11px]">
              {filteredExpenses.length} {isEn ? 'expense vouchers' : 'سند صرف'}
            </span>
          </div>
          <div>
            {isEn ? 'Total Expenses:' : 'إجمالي المصروفات:'} <strong className="text-rose-700 text-sm">{totalSum.toFixed(2)} {isEn ? 'SAR' : 'ر.س'}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 text-[11px] font-bold select-none">
                <th className="p-2.5 w-10 text-center">#</th>
                <th className="p-2.5">{isEn ? 'A: Date' : 'A: التاريخ'}</th>
                <th className="p-2.5">{isEn ? 'B: Expense Type' : 'B: نوع المصروف'}</th>
                <th className="p-2.5">{isEn ? 'C: Category' : 'C: التصنيف'}</th>
                <th className="p-2.5 font-bold bg-rose-50 text-rose-900">{isEn ? 'D: Amount' : 'D: المبلغ'}</th>
                <th className="p-2.5">{isEn ? 'E: Payment Method' : 'E: طريقة الدفع'}</th>
                <th className="p-2.5">{isEn ? 'F: Notes' : 'F: ملاحظات'}</th>
                <th className="p-2.5 text-center sticky left-0 bg-slate-100">{isEn ? 'Actions' : 'إجراءات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {isEn ? 'No expense records found' : 'لا توجد مصروفات مسجلة'}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp, idx) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">{exp.date}</td>
                    <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{exp.expenseType}</td>
                    <td className="p-2.5 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono font-extrabold text-rose-800 bg-rose-50/50">
                      {exp.amount.toFixed(2)}
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      {(() => {
                        const details = getPaymentMethodDetails(exp.paymentMethod);
                        const isSelected = filterPaymentMethod === details.category;
                        return (
                          <button
                            type="button"
                            onClick={() => setFilterPaymentMethod(isSelected ? 'ALL' : details.category)}
                            title={`تصفية المصروفات حسب: ${details.label}`}
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
                    <td className="p-2.5 text-slate-500 max-w-[250px] truncate" title={exp.notes}>
                      {exp.notes || '—'}
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap sticky left-0 bg-white/95 shadow-sm">
                      {userRole === 'viewer' ? (
                        <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded">
                          {currentLang === 'en' ? 'View Only' : 'مشاهدة فقط'}
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(exp)}
                            title="تعديل"
                            className="p-1 rounded text-slate-600 hover:text-indigo-700 hover:bg-indigo-50"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(exp.id)}
                            title="حذف"
                            className="p-1 rounded text-slate-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Expense */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] my-auto">
            <div className="p-4 bg-gradient-to-r from-rose-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base">
                  {editingItem ? 'تعديل سند مصروف' : 'تسجيل سند صرف مصروف'}
                </h3>
                <p className="text-xs text-rose-200">
                  يؤثر مباشرة في حساب صافي الربح والداشبورد
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col overscroll-contain">
              <div className="p-5 space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">التاريخ (A)</label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ (D)</label>
                  <input
                    required
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount === 0 ? '' : formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">نوع المصروف (B)</label>
                  <EditableSelect
                    id="expense-type"
                    value={formData.expenseType || ''}
                    onChange={(val) => setFormData({ ...formData, expenseType: val })}
                    options={EXPENSE_TYPES}
                    storageKey="expense_types"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">التصنيف (C)</label>
                  <EditableSelect
                    id="expense-category"
                    value={formData.category || ''}
                    onChange={(val) => setFormData({ ...formData, category: val })}
                    options={EXPENSE_CATEGORIES}
                    storageKey="expense_categories"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">طريقة الدفع (E)</label>
                <EditableSelect
                  id="expense-payment-method"
                  value={formData.paymentMethod || ''}
                  onChange={(val) => setFormData({ ...formData, paymentMethod: val })}
                  options={EXPENSE_PAYMENT_METHODS}
                  storageKey="expense_payment_methods"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات (F)</label>
                <input
                  type="text"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="رقم الفاتورة أو المستفيد..."
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              </div>

              {/* Sticky Footer Action Buttons */}
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
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  حفظ المصروف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900">تأكيد حذف سند المصروف</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من حذف هذا المصروف؟ سيتم إعادة حساب إجمالي المصروفات وصافي الربح فوراً.
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
                  onDeleteExpense(confirmDeleteId);
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
