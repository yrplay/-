import { User } from 'firebase/auth';
import { UserRole, AgencySettings, Collaborator } from '../types';

export type NavigationTab =
  | 'dashboard'
  | 'quotations'
  | 'sales'
  | 'vouchers'
  | 'purchases'
  | 'expenses'
  | 'inventory'
  | 'pricing';

export const PRIMARY_OWNER_EMAIL = 'yr.play.com@gmail.com';

export const ALL_NAVIGATION_TABS: { id: NavigationTab; label: string; iconLabel: string }[] = [
  { id: 'dashboard', label: 'لوحة المؤشرات والأرباح', iconLabel: '📊' },
  { id: 'quotations', label: 'عروض الأسعار', iconLabel: '📋' },
  { id: 'sales', label: 'المبيعات والفواتير', iconLabel: '💰' },
  { id: 'vouchers', label: 'السندات (قبض وصرف)', iconLabel: '📄' },
  { id: 'purchases', label: 'المشتريات والموردين', iconLabel: '🛒' },
  { id: 'expenses', label: 'المصروفات التشغيلية', iconLabel: '💸' },
  { id: 'inventory', label: 'إدارة المستودع والمخزون', iconLabel: '📦' },
  { id: 'pricing', label: 'حاسبة المقاسات والأسعار', iconLabel: '📐' },
];

export const DEFAULT_ROLE_TABS: Record<string, NavigationTab[]> = {
  'مالك (Owner)': ['dashboard', 'quotations', 'sales', 'vouchers', 'purchases', 'expenses', 'inventory', 'pricing'],
  'مدير (Admin)': ['dashboard', 'quotations', 'sales', 'vouchers', 'purchases', 'expenses', 'inventory', 'pricing'],
  'محاسب (Accountant)': ['dashboard', 'quotations', 'sales', 'vouchers', 'purchases', 'expenses'],
  'مسوق ومندوب مبيعات (Sales Rep)': ['quotations', 'sales', 'pricing'],
  'أمين مستودع (Warehouse Keeper)': ['inventory', 'purchases'],
  'محرر (Editor)': ['quotations', 'sales', 'vouchers', 'inventory', 'pricing'],
  'مشاهد (Viewer)': ['pricing'],
  'مخصص (Custom)': ['quotations', 'sales', 'vouchers'],
};

/**
 * Checks if the user is the primary system owner based on known email,
 * agencySettings.ownerEmail, or agencySettings.userProfile.email.
 * Always protects against accidental lockouts even across devices or remixes.
 */
export function isPrimaryOwner(user: User | null, agencySettings?: AgencySettings): boolean {
  if (!user) {
    // If not logged in yet, default local user is considered owner
    return true;
  }

  const userEmail = (user.email || '').toLowerCase().trim();
  if (!userEmail) return true;

  // 1. Hardcoded primary owner account
  if (userEmail === PRIMARY_OWNER_EMAIL.toLowerCase().trim()) {
    return true;
  }

  // 2. Explicit ownerEmail stored in agency settings
  if (agencySettings?.ownerEmail && agencySettings.ownerEmail.toLowerCase().trim() === userEmail) {
    return true;
  }

  // 3. UserProfile email in agency settings
  if (agencySettings?.userProfile?.email && agencySettings.userProfile.email.toLowerCase().trim() === userEmail) {
    return true;
  }

  // 4. Check if user was explicitly registered as a restricted employee
  if (agencySettings?.collaborators && agencySettings.collaborators.length > 0) {
    const matchedCollab = agencySettings.collaborators.find(
      (c) => c.email.toLowerCase().trim() === userEmail
    );
    if (matchedCollab) {
      const r = matchedCollab.role;
      if (r.includes('مالك') || r.includes('Owner') || r.includes('مدير') || r.includes('Admin')) {
        return true;
      }
      return false;
    }
  }

  // 5. By default, any authenticated user running this agency instance is the owner
  return true;
}

/**
 * Determines effective UserRole based on current Firebase user and agency settings.
 * Guaranteed to default to 'owner' so the owner is never demoted to 'editor'.
 */
export function getUserRole(user: User | null, agencySettings?: AgencySettings): UserRole {
  // If not logged in, treat as local owner
  if (!user) {
    return 'owner';
  }

  // Primary owner always has 'owner' role
  if (isPrimaryOwner(user, agencySettings)) {
    return 'owner';
  }

  const userEmail = (user.email || '').toLowerCase().trim();

  // Check if collaborator in agencySettings
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
  }

  // Always default to owner, never revert to editor
  return 'owner';
}

/**
 * Returns the list of navigation tabs permitted for a given role and collaborator.
 */
export function getAllowedTabs(
  role: UserRole,
  user?: User | null,
  agencySettings?: AgencySettings
): NavigationTab[] {
  // Check if collaborator has explicit customPermissions configured
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
      return ['inventory', 'purchases'];
    case 'sales':
      return ['quotations', 'sales', 'pricing'];
    case 'accountant':
      // المحاسب محصور في العمليات المالية وعروض الأسعار والسندات مع حجب المستودع والمخزون نهائياً
      return ['dashboard', 'quotations', 'sales', 'vouchers', 'purchases', 'expenses'];
    case 'editor':
      return ['quotations', 'sales', 'vouchers', 'inventory', 'pricing'];
    case 'viewer':
      return ['pricing'];
    case 'admin':
    case 'owner':
    default:
      return ['dashboard', 'quotations', 'sales', 'vouchers', 'purchases', 'expenses', 'inventory', 'pricing'];
  }
}

/**
 * Check if the user role can create records (invoices, quotes, expenses, etc.).
 * Viewers can NEVER add or create anything.
 */
export function canCreateItem(role: UserRole): boolean {
  return role !== 'viewer';
}

/**
 * Check if the user role can edit records.
 * Viewers can NEVER edit anything.
 */
export function canEditItem(role: UserRole): boolean {
  return role !== 'viewer';
}

/**
 * Check if the user role can delete records.
 * Only owner and admin can delete. Viewers can never delete.
 */
export function canDeleteItem(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Check if the user role can add/edit/delete prices in the pricing catalog.
 * Viewers can USE the calculator interactively, but CANNOT modify catalog services/prices.
 */
export function canModifyPricingCatalog(role: UserRole): boolean {
  return role !== 'viewer';
}

/**
 * Checks if a specific tab is accessible for the role or user.
 * If previewMode is active (i.e. the owner is testing a specific role),
 * we check the allowed tabs for that previewed role without owner bypass.
 */
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

/**
 * Only Owner can see Excel export, Google Sheets connection, and Formulas cheat-sheet.
 * In preview mode, respect the simulated role so owner can test other roles.
 */
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

/**
 * Owner and Admin can access Settings & Agency Profile Modal.
 * Primary Owner ALWAYS retains access to prevent lockouts under any circumstance,
 * except when deliberately previewing a restricted employee role.
 */
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

/**
 * Check if the user can modify or delete an approved/paid invoice.
 * If locked, only owner and admin can edit.
 */
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

/**
 * Role badge display info (label, color classes).
 */
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
