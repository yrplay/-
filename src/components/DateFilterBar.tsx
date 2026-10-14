import React from 'react';
import { Calendar, Filter, X } from 'lucide-react';
import { DateFilterPreset } from '../lib/dateFilterUtils';

export interface DateFilterBarProps {
  idPrefix: string;
  filterPreset: DateFilterPreset;
  onFilterPresetChange: (preset: DateFilterPreset) => void;
  selectedMonth: string;
  onMonthChange: (m: string) => void;
  availableMonths: string[];
  selectedDate: string;
  onDateChange: (d: string) => void;
  customStartDate: string;
  onCustomStartDateChange: (d: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (d: string) => void;
  filterLabel: string;
  totalCount: number;
  countLabel?: string;
  onReset: () => void;
  isFilterActive: boolean;

  // Secondary Channel / Category filter (Optional)
  channelLabel?: string;
  selectedChannel?: string;
  onChannelChange?: (channel: string) => void;
  availableChannels?: string[];
  allChannelsLabel?: string;

  // Payment Method Filter (Optional)
  paymentMethodLabel?: string;
  selectedPaymentMethod?: string;
  onPaymentMethodChange?: (method: string) => void;
  availablePaymentMethods?: { value: string; label: string }[];
  currentLang?: 'ar' | 'en';
}

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  idPrefix,
  filterPreset,
  onFilterPresetChange,
  selectedMonth,
  onMonthChange,
  availableMonths,
  selectedDate,
  onDateChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  filterLabel,
  totalCount,
  countLabel,
  onReset,
  isFilterActive,
  channelLabel,
  selectedChannel,
  onChannelChange,
  availableChannels,
  allChannelsLabel,
  paymentMethodLabel,
  selectedPaymentMethod,
  onPaymentMethodChange,
  availablePaymentMethods,
  currentLang = 'ar',
}) => {
  const isEn = currentLang === 'en';
  const effectiveCountLabel = countLabel || (isEn ? 'records' : 'سجل');
  const effectiveAllChannelsLabel = allChannelsLabel || (isEn ? '🏷️ All Channels' : '🏷️ جميع القنوات');
  return (
    <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Filter Controls Group */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Preset Selector */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-bold text-slate-700">{isEn ? 'Period:' : 'الفترة:'}</span>
            <select
              id={`${idPrefix}-preset`}
              value={filterPreset}
              onChange={(e) => {
                const val = e.target.value as DateFilterPreset;
                onFilterPresetChange(val);
                if (val !== 'SPECIFIC_MONTH') onMonthChange('');
                if (val !== 'SPECIFIC_DATE') onDateChange('');
                if (val !== 'CUSTOM') {
                  onCustomStartDateChange('');
                  onCustomEndDateChange('');
                }
              }}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 bg-slate-50 font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">{isEn ? '📅 All Accounting Periods' : '📅 كل الفترات المحاسبية'}</option>
              <option value="TODAY">{isEn ? 'Today' : 'اليوم'}</option>
              <option value="THIS_WEEK">{isEn ? 'This Week' : 'هذا الأسبوع'}</option>
              <option value="THIS_MONTH">{isEn ? 'This Month' : 'هذا الشهر'}</option>
              <option value="LAST_MONTH">{isEn ? 'Last Month' : 'الشهر الماضي'}</option>
              <option value="THIS_YEAR">{isEn ? 'This Year' : 'هذا العام'}</option>
              <option value="SPECIFIC_MONTH">{isEn ? 'Specific Month...' : 'شهر محدد...'}</option>
              <option value="SPECIFIC_DATE">{isEn ? 'Specific Date...' : 'يوم محدد...'}</option>
              <option value="CUSTOM">{isEn ? 'Custom Date Range...' : 'نطاق تاريخ مخصص...'}</option>
            </select>
          </div>

          {/* Contextual Month Picker */}
          {filterPreset === 'SPECIFIC_MONTH' && (
            <select
              id={`${idPrefix}-month`}
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="text-xs py-1.5 px-2 rounded-lg border border-indigo-300 bg-indigo-50/60 font-semibold text-indigo-900"
            >
              <option value="">{isEn ? 'Select Month...' : 'اختر الشهر...'}</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}

          {/* Contextual Date Picker */}
          {filterPreset === 'SPECIFIC_DATE' && (
            <input
              id={`${idPrefix}-date`}
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="text-xs py-1 px-2 rounded-lg border border-indigo-300 bg-indigo-50/60 font-semibold text-indigo-900"
            />
          )}

          {/* Contextual Custom Date Range */}
          {filterPreset === 'CUSTOM' && (
            <div className="flex items-center gap-1">
              <input
                id={`${idPrefix}-start-date`}
                type="date"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange(e.target.value)}
                className="text-xs p-1 rounded-lg border border-slate-300 bg-white"
                placeholder={isEn ? 'From' : 'من'}
              />
              <span className="text-slate-400">{isEn ? 'to' : 'إلى'}</span>
              <input
                id={`${idPrefix}-end-date`}
                type="date"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange(e.target.value)}
                className="text-xs p-1 rounded-lg border border-slate-300 bg-white"
                placeholder={isEn ? 'To' : 'إلى'}
              />
            </div>
          )}

          {/* Optional Channel / Category Selector */}
          {channelLabel && availableChannels && onChannelChange && (
            <div className={`flex items-center gap-1.5 ${isEn ? 'border-l border-slate-200 pl-2 ml-1' : 'border-r border-slate-200 pr-2 mr-1'}`}>
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="font-bold text-slate-700">{channelLabel}</span>
              <select
                id={`${idPrefix}-channel`}
                value={selectedChannel || 'ALL'}
                onChange={(e) => onChannelChange(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 bg-slate-50 font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">{effectiveAllChannelsLabel}</option>
                {availableChannels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional Payment Method Selector */}
          {paymentMethodLabel && onPaymentMethodChange && (
            <div className={`flex items-center gap-1.5 ${isEn ? 'border-l border-slate-200 pl-2 ml-1' : 'border-r border-slate-200 pr-2 mr-1'}`}>
              <span className="font-bold text-slate-700">{paymentMethodLabel}</span>
              <select
                id={`${idPrefix}-payment-method`}
                value={selectedPaymentMethod || 'ALL'}
                onChange={(e) => onPaymentMethodChange(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 bg-slate-50 font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">{isEn ? '💳 All Payment Methods' : '💳 جميع طرق الدفع'}</option>
                {availablePaymentMethods ? (
                  availablePaymentMethods.map((pm) => (
                    <option key={pm.value} value={pm.value}>
                      {pm.label}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="CASH">{isEn ? '💵 Cash' : '💵 كاش (نقدي)'}</option>
                    <option value="NETWORK">{isEn ? '💳 Card (POS)' : '💳 شبكة (مدى/بطاقة)'}</option>
                    <option value="TRANSFER">{isEn ? '🏦 Bank Transfer' : '🏦 تحويل بنكي'}</option>
                    <option value="DEFERRED">{isEn ? '⏳ Credit / Deferred' : '⏳ آجل'}</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>

        {/* Active Filter Badge & Reset */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1">
            <span>{filterLabel}</span>
            {selectedChannel && selectedChannel !== 'ALL' && (
              <span className="text-indigo-600 font-normal">• {selectedChannel}</span>
            )}
            {selectedPaymentMethod && selectedPaymentMethod !== 'ALL' && (
              <span className="text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px]">
                • {selectedPaymentMethod === 'CASH' ? (isEn ? '💵 Cash' : '💵 كاش') : selectedPaymentMethod === 'NETWORK' ? (isEn ? '💳 Card' : '💳 شبكة') : selectedPaymentMethod === 'TRANSFER' ? (isEn ? '🏦 Transfer' : '🏦 تحويل') : selectedPaymentMethod === 'DEFERRED' ? (isEn ? '⏳ Credit' : '⏳ آجل') : selectedPaymentMethod}
              </span>
            )}
            <span className={`bg-white/80 px-1.5 py-0.2 rounded text-[11px] font-mono font-bold ${isEn ? 'ml-1' : 'mr-1'}`}>
              {totalCount} {effectiveCountLabel}
            </span>
          </span>

          {isFilterActive && (
            <button
              type="button"
              id={`${idPrefix}-reset`}
              onClick={onReset}
              className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 transition cursor-pointer"
              title={isEn ? 'Reset filter to all periods' : 'إعادة ضبط الفلترة لعرض كل الفترات'}
            >
              <X className="w-3 h-3" />
              <span>{isEn ? 'Clear Filter' : 'إلغاء الفلترة'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
