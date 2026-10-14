export type PaymentMethodCategory = 'ALL' | 'CASH' | 'NETWORK' | 'TRANSFER' | 'DEFERRED' | 'OTHER';

export interface PaymentMethodInfo {
  category: PaymentMethodCategory;
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  activeClass: string;
  borderClass: string;
  textClass: string;
  bgLightClass: string;
}

/**
 * Normalizes any payment method string to a standard category
 */
export function normalizePaymentMethod(methodStr: string | undefined | null): PaymentMethodCategory {
  if (!methodStr) return 'OTHER';
  const m = methodStr.trim().toLowerCase();

  // Cash / نقد
  if (m.includes('كاش') || m.includes('نقد') || m.includes('نقدي') || m.includes('cash')) {
    return 'CASH';
  }

  // Network / Mada / Card / POS / شبكة
  if (
    m.includes('شبك') ||
    m.includes('مدى') ||
    m.includes('بطاق') ||
    m.includes('فيزا') ||
    m.includes('ماستر') ||
    m.includes('pos') ||
    m.includes('card')
  ) {
    return 'NETWORK';
  }

  // Bank Transfer / تحويل
  if (m.includes('تحويل') || m.includes('بنك') || m.includes('حوالة') || m.includes('transfer')) {
    return 'TRANSFER';
  }

  // Deferred / Credit / آجل
  if (m.includes('آجل') || m.includes('اجل') || m.includes('ذمم') || m.includes('دين') || m.includes('credit')) {
    return 'DEFERRED';
  }

  return 'OTHER';
}

/**
 * Returns visual details and styling for a payment method
 */
export function getPaymentMethodDetails(methodStr: string | undefined | null): PaymentMethodInfo {
  const cat = normalizePaymentMethod(methodStr);

  switch (cat) {
    case 'CASH':
      return {
        category: 'CASH',
        label: 'كاش (نقدي)',
        shortLabel: 'كاش',
        icon: '💵',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        activeClass: 'bg-emerald-600 text-white ring-2 ring-emerald-500 shadow-sm',
        borderClass: 'border-emerald-300 bg-emerald-50/60',
        textClass: 'text-emerald-700',
        bgLightClass: 'bg-emerald-50 text-emerald-800',
      };
    case 'NETWORK':
      return {
        category: 'NETWORK',
        label: 'شبكة (مدى / بطاقة)',
        shortLabel: 'شبكة',
        icon: '💳',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
        activeClass: 'bg-sky-600 text-white ring-2 ring-sky-500 shadow-sm',
        borderClass: 'border-sky-300 bg-sky-50/60',
        textClass: 'text-sky-700',
        bgLightClass: 'bg-sky-50 text-sky-800',
      };
    case 'TRANSFER':
      return {
        category: 'TRANSFER',
        label: 'تحويل بنكي',
        shortLabel: 'تحويل',
        icon: '🏦',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
        activeClass: 'bg-purple-600 text-white ring-2 ring-purple-500 shadow-sm',
        borderClass: 'border-purple-300 bg-purple-50/60',
        textClass: 'text-purple-700',
        bgLightClass: 'bg-purple-50 text-purple-800',
      };
    case 'DEFERRED':
      return {
        category: 'DEFERRED',
        label: 'آجل (ذمم مستحقة)',
        shortLabel: 'آجل',
        icon: '⏳',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        activeClass: 'bg-amber-600 text-white ring-2 ring-amber-500 shadow-sm',
        borderClass: 'border-amber-300 bg-amber-50/60',
        textClass: 'text-amber-700',
        bgLightClass: 'bg-amber-50 text-amber-800',
      };
    default:
      return {
        category: 'OTHER',
        label: methodStr?.trim() || 'أخرى',
        shortLabel: methodStr?.trim() || 'أخرى',
        icon: '🏷️',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
        activeClass: 'bg-slate-700 text-white ring-2 ring-slate-600 shadow-sm',
        borderClass: 'border-slate-300 bg-slate-50',
        textClass: 'text-slate-700',
        bgLightClass: 'bg-slate-50 text-slate-800',
      };
  }
}

/**
 * Checks whether an item's paymentMethod matches a filter
 */
export function matchesPaymentMethodFilter(
  itemMethod: string | undefined | null,
  filterValue: string
): boolean {
  if (!filterValue || filterValue === 'ALL') return true;

  const itemCat = normalizePaymentMethod(itemMethod);

  // If filter is by category key
  if (filterValue === 'CASH' && itemCat === 'CASH') return true;
  if (filterValue === 'NETWORK' && itemCat === 'NETWORK') return true;
  if (filterValue === 'TRANSFER' && itemCat === 'TRANSFER') return true;
  if (filterValue === 'DEFERRED' && itemCat === 'DEFERRED') return true;
  if (filterValue === 'OTHER' && itemCat === 'OTHER') return true;

  // Direct string matching
  const trimmedFilter = filterValue.trim().toLowerCase();
  const trimmedItem = (itemMethod || '').trim().toLowerCase();

  if (trimmedFilter === 'كاش' && itemCat === 'CASH') return true;
  if (trimmedFilter === 'شبكة' && itemCat === 'NETWORK') return true;
  if (trimmedFilter === 'تحويل' && itemCat === 'TRANSFER') return true;
  if (trimmedFilter === 'آجل' && itemCat === 'DEFERRED') return true;

  return trimmedItem === trimmedFilter || trimmedItem.includes(trimmedFilter);
}
