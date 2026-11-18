import { User } from 'firebase/auth';
import { UserRole, AgencySettings, NavigationTab } from '../types';

export type { NavigationTab };

// لم يعد هناك بريد إلكتروني مثبت في الكود المصدري؛ يتم تعيين المالك ديناميكياً من إعدادات الوكالة أو أول تسجيل دخول
export const PRIMARY_OWNER_EMAIL = '';

export const ALL_NAVIGATION_TABS: { id: NavigationTab; label: string; iconLabel: string }[] = [
  { id: 'dashboard', label: 'لوحة المؤشرات والأرباح', iconLabel: '📊' },
  { id: 'quotations', label: 'عروض الأسعار', iconLabel: '📋' },
  { id: 'sales', label: 'المبيعات والفواتير', iconLabel: '💰' },
  { id: 'returns', label: 'المرتجعات وإشعارات الدائن', iconLabel: '↩️' },
  { id: 'vouchers', label: 'السندات (قبض وصرف)', iconLabel: '📄' },
  { id: 'purchases', label: 'المشتريات والموردين', iconLabel: '🛒' },
  { id: 'expenses', label: 'المصروفات التشغيلية', iconLabel: '💸' },
  { id: 'inventory', label: 'إدارة المستودع والمخزون', iconLabel: '📦' },
  { id: 'hr', label: 'الموارد البشرية والرواتب', iconLabel: '👥' },
  { id: 'pricing', label: 'حاسبة المقاسات والأسعار', iconLabel: '📐' },
];

export const DEFAULT_ROLE_TABS: Record<string, NavigationTab[]> = {
  'مالك (Owner)': ['dashboard', 'quotations', 'sales', 'returns', 'vouchers', 'purchases', 'expenses', 'inventory', 'hr', 'pricing'],
  'مدير (Admin)': ['dashboard', 'quotations', 'sales', 'returns', 'vouchers', 'purchases', 'expenses', 'inventory', 'hr', 'pricing'],
  'محاسب (Accountant)': ['dashboard', 'quotations', 'sales', 'returns', 'vouchers', 'purchases', 'expenses', 'hr'],
  'مسوق ومندوب مبيعات (Sales Rep)': ['quotations', 'sales', 'returns', 'pricing'],
  'أمين مستودع (Warehouse Keeper)': ['inventory', 'purchases', 'returns'],
  'محرر (Editor)': ['quotations', 'sales', 'returns', 'vouchers', 'inventory', 'pricing'],
  'مشاهد (Viewer)': ['pricing'],
  'مخصص (Custom)': ['quotations', 'sales', 'vouchers'],
};

/**
 * Checks if the user is the primary system owner based on agencySettings.ownerEmail
 * or agencySettings.userProfile.email, without any hardcoded backdoor email.
 */
export function isPrimaryOwner(user: User | null, agencySettings?: AgencySettings): boolean {
  if (!user) {
    return true;
  }

  const userEmail = (user.email || '').toLowerCase().trim();
  if (!userEmail) return true;

  if (agencySettings?.ownerEmail && agencySettings.ownerEmail.toLowerCase().trim() === userEmail) {
    return true;
  }

  if (agencySettings?.userProfile?.email && agencySettings.userProfile.email.toLowerCase().trim() === userEmail) {
    return true;
  }

  if (agencySettings?.collaborators && agencySettings.collaborators.length > 0) {
    const matchedCollab = agencySettings.collaborators.find(
      (c) => c.email.toLowerCase().trim() === userEmail
    );
    if (matchedCollab) {
      const r = matchedCollab.role;
      if (r.includes('مالك') || r.includes('Owner')) {
        return true;
      }
      return false;
    }
  }

  // إذا لم يتم تعيين مالك بعد في الإعدادات ولم يكن المستخدم ضمن الموظفين المقيدين، يعتبر هو المالك الأول للنظام
  if (!agencySettings?.ownerEmail && (!agencySettings?.collaborators || agencySettings.collaborators.length === 0)) {
    return true;
  }

  return false;
}

export function getUserRole(user: User | null, agencySettings?: AgencySettings): UserRole {
  if (!user) {
    return 'owner';
  }

  if (isPrimaryOwner(user, agencySettings)) {
    return 'owner';
  }

  const userEmail = (user.email || '').toLowerCase().trim();

  if (agencySettings?.collaborators && agencySettings.collaborators.length > 0) {
    const matchedCollab = agencySettings.collaborators.find(
      (c) => c.email.toLowerCase().trim() === userEmail
    );

    if (matchedCollab) {
      const r = matchedCollab.role;
      if (r.includes('مالك') || r.includes('Owner')) return 'owner';
      if (r.includes('مدير') || r.includes('Admin')) return 'admin';
      if (r.includes('محاسب') || r.includes('Accountant')) return 'accountant';
      if (r.includes('مسوق') || r.includes('مندوب') || r.includes('Sales')) return 'sales';
      if (r.includes('مستودع') || r.includes('Warehouse')) return 'warehouse';
      if (r.includes('مشاهد') || r.includes('Viewer')) return 'viewer';
      if (r.includes('محرر') || r.includes('Editor')) return 'editor';
    }
    // إذا كان هناك مالك مسجل وفريق عمل، وأي مستخدم خارج الفريق يدخل، يحصل على صلاحية مشاهد فقط للأمان
    if (agencySettings.ownerEmail) {
      return 'viewer';
    }
  }

  return 'owner';
}

export function getAllowedTabs(
  role: UserRole,
  user?: User | null,
  agencySettings?: AgencySettings
): NavigationTab[] {
  if (user && agencySettings?.collaborators) {
    const userEmail = (user.email || '').toLowerCase().trim();
    const matchedCollab = agencySettings.collaborators.find(
      (c) => c.email.toLowerCase().trim() === userEmail
    );
    if (matchedCollab?.customPermissions && Array.isArray(matchedCollab.customPermissions)) {
      return matchedCollab.customPermissions;
    }
  }

  switch (role) {
    case 'warehouse':
      return ['inventory', 'purchases', 'returns'];
    case 'sales':
      return ['quotations', 'sales', 'returns', 'pricing'];
    case 'accountant':
      return ['dashboard', 'quotations', 'sales', 'returns', 'vouchers', 'purchases', 'expenses', 'hr'];
    case 'editor':
      return ['quotations', 'sales', 'returns', 'vouchers', 'inventory', 'pricing'];
    case 'viewer':
      return ['pricing'];
    case 'admin':
    case 'owner':
    default:
      return ['dashboard', 'quotations', 'sales', 'returns', 'vouchers', 'purchases', 'expenses', 'inventory', 'hr', 'pricing'];
  }
}

export function canCreateItem(role?: UserRole | string): boolean {
  return role !== 'viewer' && !String(role || '').includes('مشاهد');
}

export function canEditItem(role?: UserRole | string): boolean {
  return role !== 'viewer' && !String(role || '').includes('مشاهد');
}

export function canDeleteItem(role?: UserRole | string): boolean {
  if (!role) return true;
  const r = String(role);
  return r === 'owner' || r === 'admin' || r.includes('مالك') || r.includes('مدير');
}

export function canModifyPricingCatalog(role?: UserRole | string): boolean {
  return role !== 'viewer' && !String(role || '').includes('مشاهد');
}

export function canManageHR(role?: UserRole | string): boolean {
  if (!role) return true;
  const r = String(role);
  return (
    r === 'owner' ||
    r === 'admin' ||
    r === 'accountant' ||
    r.includes('مالك') ||
    r.includes('مدير') ||
    r.includes('محاسب')
  );
}

export function canAccessTab(
  role: UserRole,
  tab: NavigationTab,
  user?: User | null,
  agencySettings?: AgencySettings,
  isPreviewMode: boolean = false
): boolean {
  if (!isPreviewMode && user && isPrimaryOwner(user, agencySettings) && role === 'owner') {
    return true;
  }
  return getAllowedTabs(role, isPreviewMode ? null : user, agencySettings).includes(tab);
}

export function canAccessOwnerControls(
  role: UserRole,
  user?: User | null,
  agencySettings?: AgencySettings,
  isPreviewMode: boolean = false
): boolean {
  if (role === 'owner') return true;
  if (!isPreviewMode && user && isPrimaryOwner(user, agencySettings)) {
    return true;
  }
  return false;
}

export function canAccessSettings(
  role: UserRole,
  user?: User | null,
  agencySettings?: AgencySettings,
  isPreviewMode: boolean = false
): boolean {
  if (!isPreviewMode && user && isPrimaryOwner(user, agencySettings)) {
    return true;
  }
  return role === 'owner' || role === 'admin';
}

export function canEditApprovedInvoice(
  role: UserRole,
  isApprovedOrPaid: boolean,
  lockEnabled: boolean = true,
  user?: User | null,
  agencySettings?: AgencySettings
): boolean {
  if (!isApprovedOrPaid || !lockEnabled) return role !== 'viewer';
  if (user && isPrimaryOwner(user, agencySettings)) {
    return true;
  }
  return role === 'owner' || role === 'admin';
}

export function getRoleBadgeInfo(role: UserRole): { label: string; bg: string; text: string; border: string } {
  switch (role) {
    case 'owner':
      return { label: 'المالك', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' };
    case 'admin':
      return { label: 'مدير', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-300' };
    case 'accountant':
      return { label: 'محاسب', bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-300' };
    case 'sales':
      return { label: 'مبيعات', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300' };
    case 'warehouse':
      return { label: 'مستودع', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' };
    case 'editor':
      return { label: 'محرر', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300' };
    case 'viewer':
    default:
      return { label: 'مشاهد', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
  }
}
