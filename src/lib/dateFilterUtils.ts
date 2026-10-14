export type DateFilterPreset =
  | 'ALL'
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'SPECIFIC_MONTH'
  | 'SPECIFIC_DATE'
  | 'CUSTOM';

export interface DateRangeResult {
  startDate: string;
  endDate: string;
  filterLabel: string;
}

export function computeDateRange(
  preset: DateFilterPreset,
  selectedMonth?: string,
  selectedDate?: string,
  customStart?: string,
  customEnd?: string
): DateRangeResult {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (preset === 'TODAY') {
    return { startDate: todayStr, endDate: todayStr, filterLabel: 'اليوم' };
  }

  if (preset === 'THIS_WEEK') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 6 ? 0 : -1);
    const start = new Date(d.setDate(diff)).toISOString().split('T')[0];
    return { startDate: start, endDate: todayStr, filterLabel: 'هذا الأسبوع' };
  }

  if (preset === 'THIS_MONTH') {
    const start = `${todayStr.slice(0, 7)}-01`;
    return { startDate: start, endDate: todayStr, filterLabel: 'هذا الشهر' };
  }

  if (preset === 'LAST_MONTH') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const start = prev.toISOString().split('T')[0];
    const end = prevEnd.toISOString().split('T')[0];
    return { startDate: start, endDate: end, filterLabel: 'الشهر الماضي' };
  }

  if (preset === 'THIS_YEAR') {
    const start = `${now.getFullYear()}-01-01`;
    return { startDate: start, endDate: todayStr, filterLabel: `عام ${now.getFullYear()}` };
  }

  if (preset === 'SPECIFIC_MONTH' || selectedMonth) {
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      return {
        startDate: `${selectedMonth}-01`,
        endDate: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
        filterLabel: `شهر ${selectedMonth}`,
      };
    }
  }

  if (preset === 'SPECIFIC_DATE' || selectedDate) {
    if (selectedDate) {
      return { startDate: selectedDate, endDate: selectedDate, filterLabel: `يوم ${selectedDate}` };
    }
  }

  if (preset === 'CUSTOM' && (customStart || customEnd)) {
    return {
      startDate: customStart || '2000-01-01',
      endDate: customEnd || '2099-12-31',
      filterLabel: `من ${customStart || 'البداية'} إلى ${customEnd || 'اليوم'}`,
    };
  }

  return { startDate: '', endDate: '', filterLabel: 'كل الفترات' };
}

export function isDateWithinRange(
  dateStr: string | undefined,
  startDate: string,
  endDate: string
): boolean {
  if (!startDate && !endDate) return true;
  if (!dateStr) return false;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

export function extractAvailableMonths(dates: (string | undefined)[]): string[] {
  const monthSet = new Set<string>();
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  monthSet.add(currentMonthStr);

  dates.forEach((d) => {
    if (d && d.length >= 7) {
      monthSet.add(d.slice(0, 7));
    }
  });

  return Array.from(monthSet).sort().reverse();
}
