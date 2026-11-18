import React from 'react';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  LogOut,
  Sparkles,
  Download,
  Settings,
  Cloud,
  CloudOff,
  Globe,
  RotateCcw,
  Users,
  History,
} from 'lucide-react';
import { AgencySettings, UserRole } from '../types';
import {
  canAccessOwnerControls,
  canAccessSettings,
  canAccessTab,
  getRoleBadgeInfo,
  isPrimaryOwner,
  NavigationTab,
} from '../lib/permissions';
import { PWAInstallButton } from './PWAInstallButton';
import { TAB_LABELS, getTranslations } from '../lib/translations';

interface HeaderProps {
  user: User | null;
  userRole?: UserRole;
  needsAuth: boolean;
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  isSyncing: boolean;
  onSync: () => void;
  onOpenSheetsModal: () => void;
  onOpenFormulasModal?: () => void;
  onExportExcel?: () => void;
  onOpenAuditModal?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  agencySettings: AgencySettings;
  onOpenAgencySettings: () => void;
  onUpdateAgencySettings?: (settings: AgencySettings) => void;
  cloudSyncStatus?: 'connecting' | 'synced' | 'syncing' | 'offline' | 'error';
  onForceCloudSync?: () => void;
  onOpenCloudSyncModal?: () => void;
  previewRole?: UserRole | null;
  onSwitchPreviewRole?: (role: UserRole | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  userRole = 'owner' as UserRole,
  previewRole,
  onSwitchPreviewRole,
  isLoggingIn,
  onLogin,
  onLogout,
  spreadsheetId,
  spreadsheetUrl,
  isSyncing,
  onSync,
  onOpenSheetsModal,
  onExportExcel,
  onOpenAuditModal,
  activeTab,
  setActiveTab,
  agencySettings,
  onOpenAgencySettings,
  onUpdateAgencySettings,
  cloudSyncStatus = 'synced',
  onForceCloudSync,
  onOpenCloudSyncModal,
}) => {
  const currentLang = (agencySettings.userProfile?.language || agencySettings.appLanguage || 'ar') as 'ar' | 'en';
  const t = getTranslations(currentLang);
  const tabDict = TAB_LABELS[currentLang] || TAB_LABELS.ar;

  const allTabs: { id: NavigationTab; label: string }[] = [
    { id: 'dashboard', label: tabDict.dashboard },
    { id: 'quotations', label: tabDict.quotations },
    { id: 'sales', label: tabDict.sales },
    { id: 'returns', label: tabDict.returns },
    { id: 'vouchers', label: tabDict.vouchers },
    { id: 'purchases', label: tabDict.purchases },
    { id: 'expenses', label: tabDict.expenses },
    { id: 'inventory', label: tabDict.inventory },
    { id: 'hr', label: tabDict.hr },
    { id: 'pricing', label: tabDict.pricing },
  ];

  const isPreviewMode = Boolean(previewRole);
  const visibleTabs = allTabs.filter((tab) =>
    canAccessTab(userRole, tab.id, user, agencySettings, isPreviewMode)
  );
  const isRealOwner = isPrimaryOwner(user, agencySettings);
  const isOwner = canAccessOwnerControls(userRole, user, agencySettings, isPreviewMode);
  const canSettings = canAccessSettings(userRole, user, agencySettings, isPreviewMode);
  const roleBadge = getRoleBadgeInfo(userRole);

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          {agencySettings.agencyLogoUrl ? (
            <div
              onClick={canSettings ? onOpenAgencySettings : undefined}
              className={`w-11 h-11 rounded-xl bg-white p-1 border border-slate-700 shadow-md flex items-center justify-center shrink-0 ${
                canSettings ? 'cursor-pointer hover:border-emerald-500 group' : ''
              }`}
              title={canSettings ? 'اضغط لتعديل الشعار أو اسم الوكالة أو إدارة المحررين' : agencySettings.agencyName}
            >
              <img
                src={agencySettings.agencyLogoUrl}
                alt={agencySettings.agencyName}
                className={`w-full h-full object-contain ${canSettings ? 'group-hover:scale-105 transition' : ''}`}
              />
            </div>
          ) : (
            <div
              onClick={canSettings ? onOpenAgencySettings : undefined}
              className={`w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold text-lg shrink-0 ${
                canSettings ? 'cursor-pointer hover:brightness-110 transition' : ''
              }`}
              title={canSettings ? 'اضغط لإضافة شعار الوكالة والتحكم بالملف الشخصي' : agencySettings.agencyName}
            >
              <span className="tracking-tight text-sm">شعار</span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1
                onClick={canSettings ? onOpenAgencySettings : undefined}
                className={`text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5 ${
                  canSettings ? 'hover:text-emerald-300 transition cursor-pointer' : ''
                }`}
                title={canSettings ? 'اضغط لتغيير اسم الوكالة أو الشعار' : undefined}
              >
                <span>{agencySettings.agencyName || 'نظام محاسبة الدعاية والإعلان'}</span>
              </h1>

              {/* Cloud Real-time Sync Status Pill */}
              <button
                type="button"
                onClick={onOpenCloudSyncModal || onForceCloudSync}
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full transition cursor-pointer border ${
                  cloudSyncStatus === 'synced'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 shadow-xs'
                    : cloudSyncStatus === 'syncing'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 animate-pulse'
                    : cloudSyncStatus === 'connecting'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
                title="مركز المزامنة والتخزين السحابي: اضغط لفحص الاتصال وسحب أو دمج التعديلات بين الأجهزة"
              >
                {cloudSyncStatus === 'synced' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400"></span>
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    <span>سحابي متزامن</span>
                  </>
                ) : cloudSyncStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span>جاري المزامنة...</span>
                  </>
                ) : cloudSyncStatus === 'connecting' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span>اتصال سحابي...</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>محلي (اضغط للمزامنة)</span>
                  </>
                )}
              </button>

              {isOwner && spreadsheetId ? (
                <span className="hidden md:inline-flex text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  {t.connected}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-400 line-clamp-1 max-w-xl">
              {agencySettings.agencySubtitle ||
                (currentLang === 'en'
                  ? 'Automated Accounting • Invoices • Returns • Inventory • HR & Payroll'
                  : 'حسابات مترابطة فورية • فواتير ومرتجعات • مخزون وهالك • حضور ورواتب')}
            </p>
          </div>
        </div>

        {/* Action Controls & Integration Status */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          {onUpdateAgencySettings && (
            <button
              id="btn-quick-lang-toggle"
              type="button"
              onClick={() => {
                const nextLang = currentLang === 'ar' ? 'en' : 'ar';
                onUpdateAgencySettings({
                  ...agencySettings,
                  appLanguage: nextLang,
                  userProfile: {
                    ...agencySettings.userProfile,
                    name: agencySettings.userProfile?.name || 'المستخدم',
                    email: agencySettings.userProfile?.email || user?.email || '',
                    role: agencySettings.userProfile?.role || 'مستخدم',
                    language: nextLang,
                  },
                });
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition shadow-xs cursor-pointer"
              title={currentLang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{currentLang === 'ar' ? 'English (EN)' : 'العربية (AR)'}</span>
            </button>
          )}

          <PWAInstallButton className="inline-flex" />

          {canSettings && onOpenAuditModal && (
            <button
              id="btn-audit-logs"
              type="button"
              onClick={onOpenAuditModal}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition shadow-xs cursor-pointer"
              title="سجل العمليات والرقابة المشفر"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.auditLogs}</span>
            </button>
          )}

          {canSettings && (
            <button
              id="btn-cloud-sync-modal"
              type="button"
              onClick={onOpenCloudSyncModal || onForceCloudSync}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/40 transition shadow-xs cursor-pointer"
              title="مركز المزامنة السحابية الفورية"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.sync}</span>
            </button>
          )}

          {canSettings && (
            <button
              id="btn-agency-profile-settings"
              onClick={onOpenAgencySettings}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition shadow-xs cursor-pointer"
              title="إعدادات النظام والوكالة والصلاحيات"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.settings}</span>
            </button>
          )}

          {isOwner && onExportExcel && (
            <button
              id="btn-export-excel"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition border border-emerald-600 cursor-pointer"
              title="تحميل ملف إكسل كامل للعمل أوفلاين"
            >
              <Download className="w-3.5 h-3.5 text-emerald-200" />
              <span>{t.excel}</span>
            </button>
          )}

          {isOwner &&
            (spreadsheetId ? (
              <div className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-700/60 rounded-lg p-0.5 px-2">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs text-emerald-200 font-bold hidden md:inline">مرتبط</span>
                </div>
                {spreadsheetUrl && (
                  <a
                    id="link-open-google-sheets"
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-emerald-300 hover:text-emerald-100 underline hover:no-underline font-semibold pr-1"
                  >
                    Sheets
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  id="btn-sync-to-sheets"
                  onClick={onSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold transition cursor-pointer"
                  title="مزامنة مع Google Sheets"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? '...' : 'مزامنة'}</span>
                </button>
              </div>
            ) : (
              <button
                id="btn-connect-sheets"
                onClick={onOpenSheetsModal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                title="ربط أو إنشاء جدول Google Sheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
                <span>ربط</span>
              </button>
            ))}

          {user ? (
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl py-1 px-2.5 shadow-xs">
              <div
                onClick={canSettings ? onOpenAgencySettings : undefined}
                className={`flex items-center gap-2 ${canSettings ? 'cursor-pointer hover:opacity-90' : ''} transition`}
                title={canSettings ? 'الملف الشخصي وإعدادات الوكالة والمحررين' : 'الحساب الحالي'}
              >
                {agencySettings.userProfile?.avatarUrl ? (
                  <img
                    src={agencySettings.userProfile.avatarUrl}
                    alt="شعار الموظف"
                    className="w-8 h-8 rounded-full border-2 border-emerald-400 shadow-sm object-cover shrink-0"
                  />
                ) : user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google User'}
                    className="w-8 h-8 rounded-full border-2 border-emerald-400/80 shadow-sm object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-600 text-white text-xs flex items-center justify-center font-bold shadow-sm shrink-0 border border-slate-600">
                    {(agencySettings.userProfile?.name || user.displayName || user.email || 'G')[0]}
                  </div>
                )}

                <div className="flex flex-col text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white max-w-[130px] truncate leading-tight">
                      {agencySettings.userProfile?.name || user.displayName || user.email?.split('@')[0]}
                    </span>
                    {agencySettings.userProfile?.role && (
                      <span className="text-[10px] text-emerald-300 font-medium hidden sm:inline px-1 py-0.2 bg-emerald-950/80 rounded border border-emerald-500/30">
                        {agencySettings.userProfile.role}
                      </span>
                    )}
                  </div>
                  {isRealOwner ? (
                    <div className="relative inline-block mt-0.5">
                      <select
                        id="select-user-role-badge"
                        value={previewRole || 'owner'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          const val = e.target.value;
                          if (onSwitchPreviewRole) {
                            onSwitchPreviewRole(val === 'owner' ? null : (val as UserRole));
                          }
                        }}
                        className={`text-[10px] pl-4 pr-1.5 py-0.5 rounded-md font-extrabold ${roleBadge.bg} ${roleBadge.text} border ${roleBadge.border} inline-flex items-center cursor-pointer outline-none transition hover:brightness-110 shadow-xs appearance-none`}
                        title="معاينة وتجربة الصلاحيات (أداة المالك فقط)"
                      >
                        <option value="owner" className="bg-slate-900 text-white font-medium">👑 المالك (الكل)</option>
                        <option value="admin" className="bg-slate-900 text-white font-medium">🛡️ مدير (Admin)</option>
                        <option value="accountant" className="bg-slate-900 text-white font-medium">📊 محاسب (Accountant)</option>
                        <option value="sales" className="bg-slate-900 text-white font-medium">💼 مبيعات (Sales)</option>
                        <option value="warehouse" className="bg-slate-900 text-white font-medium">📦 مستودع (Warehouse)</option>
                        <option value="editor" className="bg-slate-900 text-white font-medium">✏️ محرر (Editor)</option>
                        <option value="viewer" className="bg-slate-900 text-white font-medium">👁️ مشاهد (Viewer)</option>
                      </select>
                      <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-[8px] opacity-70">
                        ▼
                      </span>
                    </div>
                  ) : (
                    <span className={`text-[10px] px-1.5 py-0.2 mt-0.5 rounded font-semibold ${roleBadge.bg} ${roleBadge.text} border ${roleBadge.border} inline-block w-fit`}>
                      {roleBadge.label}
                    </span>
                  )}
                </div>
              </div>
              <button
                id="btn-google-logout"
                onClick={onLogout}
                title="تسجيل الخروج"
                className="text-slate-400 hover:text-red-400 p-1 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                onClick={canSettings ? onOpenAgencySettings : undefined}
                className={`flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl py-1 px-2.5 ${canSettings ? 'cursor-pointer hover:opacity-90' : ''} transition shadow-xs`}
                title={canSettings ? 'الملف الشخصي وإعدادات الوكالة والمحررين' : 'الحساب الحالي'}
              >
                {agencySettings.userProfile?.avatarUrl ? (
                  <img
                    src={agencySettings.userProfile.avatarUrl}
                    alt="شعار الموظف"
                    className="w-8 h-8 rounded-full border-2 border-emerald-400 shadow-sm object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-600 text-white text-xs flex items-center justify-center font-bold shadow-sm shrink-0 border border-slate-600">
                    {(agencySettings.userProfile?.name || 'م')[0]}
                  </div>
                )}
                <div className="flex flex-col text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white max-w-[130px] truncate leading-tight">
                      {agencySettings.userProfile?.name || 'المدير العام'}
                    </span>
                    {agencySettings.userProfile?.role && (
                      <span className="text-[10px] text-emerald-300 font-medium hidden sm:inline px-1 py-0.2 bg-emerald-950/80 rounded border border-emerald-500/30">
                        {agencySettings.userProfile.role}
                      </span>
                    )}
                  </div>
                  {isRealOwner ? (
                    <div className="relative inline-block mt-0.5">
                      <select
                        id="select-local-role-badge"
                        value={previewRole || 'owner'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          const val = e.target.value;
                          if (onSwitchPreviewRole) {
                            onSwitchPreviewRole(val === 'owner' ? null : (val as UserRole));
                          }
                        }}
                        className={`text-[10px] pl-4 pr-1.5 py-0.5 rounded-md font-extrabold ${roleBadge.bg} ${roleBadge.text} border ${roleBadge.border} inline-flex items-center cursor-pointer outline-none transition hover:brightness-110 shadow-xs appearance-none`}
                        title="معاينة وتجربة الصلاحيات (أداة المالك فقط)"
                      >
                        <option value="owner" className="bg-slate-900 text-white font-medium">👑 المالك (الكل)</option>
                        <option value="admin" className="bg-slate-900 text-white font-medium">🛡️ مدير (Admin)</option>
                        <option value="accountant" className="bg-slate-900 text-white font-medium">📊 محاسب (Accountant)</option>
                        <option value="sales" className="bg-slate-900 text-white font-medium">💼 مبيعات (Sales)</option>
                        <option value="warehouse" className="bg-slate-900 text-white font-medium">📦 مستودع (Warehouse)</option>
                        <option value="editor" className="bg-slate-900 text-white font-medium">✏️ محرر (Editor)</option>
                        <option value="viewer" className="bg-slate-900 text-white font-medium">👁️ مشاهد (Viewer)</option>
                      </select>
                      <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-[8px] opacity-70">
                        ▼
                      </span>
                    </div>
                  ) : (
                    <span className={`text-[10px] px-1.5 py-0.2 mt-0.5 rounded font-semibold ${roleBadge.bg} ${roleBadge.text} border ${roleBadge.border} inline-block w-fit`}>
                      {roleBadge.label}
                    </span>
                  )}
                </div>
              </div>

              <button
                id="btn-google-signin"
                onClick={onLogin}
                disabled={isLoggingIn}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold shadow-sm transition border border-slate-300 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{isLoggingIn ? 'جار الربط...' : 'دخول Google'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-950/80 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto no-scrollbar">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-nav-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'border-emerald-400 text-emerald-300 bg-slate-800/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {tab.id === 'dashboard' && <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                {tab.id === 'returns' && <RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
                {tab.id === 'hr' && <Users className="w-3.5 h-3.5 text-cyan-400" />}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
