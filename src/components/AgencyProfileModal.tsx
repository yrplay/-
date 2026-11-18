import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  X,
  Building2,
  Image as ImageIcon,
  Upload,
  Trash2,
  User as UserIcon,
  Users,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Save,
  Plus,
  Mail,
  Phone,
  FileSpreadsheet,
  AlertCircle,
  Share2,
  QrCode,
  Check,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Shield,
  Sliders,
} from 'lucide-react';
import { AgencySettings, Collaborator, UserRole } from '../types';
import {
  NavigationTab,
  ALL_NAVIGATION_TABS,
  DEFAULT_ROLE_TABS,
  canAccessSettings,
  PRIMARY_OWNER_EMAIL,
} from '../lib/permissions';

interface AgencyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  agencySettings: AgencySettings;
  onUpdateAgencySettings: (settings: AgencySettings) => void;
  user: User | null;
  userRole?: UserRole;
  onLogin: () => void;
  onLogout: () => void;
  spreadsheetUrl: string | null;
  onClearAllRecords?: () => void;
  onExportJsonBackup?: () => void;
  onImportJsonBackup?: (file: File) => void;
}

type TabType = 'agency' | 'profile' | 'collaborators';

export const AgencyProfileModal: React.FC<AgencyProfileModalProps> = ({
  isOpen,
  onClose,
  agencySettings,
  onUpdateAgencySettings,
  user,
  userRole,
  onLogin,
  onLogout,
  spreadsheetUrl,
  onClearAllRecords,
  onExportJsonBackup,
  onImportJsonBackup,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('agency');
  const [copiedLink, setCopiedLink] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedCollabId, setExpandedCollabId] = useState<string | null>(null);

  // Form states for Agency
  const [formData, setFormData] = useState<AgencySettings>({ ...agencySettings });

  // Form state for adding new collaborator
  const [newCollabName, setNewCollabName] = useState('');
  const [newCollabEmail, setNewCollabEmail] = useState('');
  const [newCollabRole, setNewCollabRole] = useState<Collaborator['role']>('محرر (Editor)');
  const [newCollabCustomTabs, setNewCollabCustomTabs] = useState<NavigationTab[]>([
    'quotations',
    'sales',
    'inventory',
  ]);
  const [collabError, setCollabError] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stampFileInputRef = useRef<HTMLInputElement | null>(null);
  const customQrFileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep internal form data in sync if agencySettings change from outside, ensuring no duplicate emails
  React.useEffect(() => {
    const ownerEmailKey = (
      user?.email ||
      agencySettings.ownerEmail ||
      agencySettings.userProfile?.email ||
      PRIMARY_OWNER_EMAIL
    ).trim().toLowerCase();

    const collabs = agencySettings.collaborators || [];
    const uniqueMap = new Map<string, Collaborator>();
    for (const c of collabs) {
      const emailKey = c.email?.trim().toLowerCase();
      // Ensure owner email is not duplicated in collaborator list
      if (emailKey && emailKey !== ownerEmailKey && !uniqueMap.has(emailKey)) {
        uniqueMap.set(emailKey, c);
      }
    }
    setFormData({
      ...agencySettings,
      collaborators: Array.from(uniqueMap.values()),
    });
  }, [agencySettings, user]);

  if (!isOpen) return null;

  // Strict Security Check: Only Owner and Admin can access settings
  if (userRole && !canAccessSettings(userRole, user, agencySettings)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full text-center border border-slate-200">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-4 shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-base text-slate-800 mb-2">صلاحية وصول محدودة</h3>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            عذراً، إعدادات الوكالة، الشعار، وإدارة فريق العمل وصلاحياتهم مخصصة حصرياً لمالك النظام والمدير العام (Owner & Admin) لحماية سرية وخصوصية البيانات.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer shadow-md"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    );
  }

  // Handle custom QR code upload
  const handleCustomQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح لكود QR (PNG أو JPG أو WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = {
        ...formData,
        customQrUrl: base64,
      };
      setFormData(updated);
      onUpdateAgencySettings(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomQr = () => {
    const updated = {
      ...formData,
      customQrUrl: null,
    };
    setFormData(updated);
    onUpdateAgencySettings(updated);
    if (customQrFileInputRef.current) {
      customQrFileInputRef.current.value = '';
    }
  };

  // Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح بصيغة PNG أو JPG أو SVG أو WebP');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert('حجم الصورة كبير، يفضل اختيار صورة أقل من 3 ميجابايت لضمان سرعة التحميل');
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = {
        ...formData,
        agencyLogoUrl: base64,
      };
      setFormData(updated);
      onUpdateAgencySettings(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    const updated = {
      ...formData,
      agencyLogoUrl: null,
    };
    setFormData(updated);
    onUpdateAgencySettings(updated);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle shop stamp upload
  const handleStampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح لختم المحل');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = {
        ...formData,
        agencyStampUrl: base64,
      };
      setFormData(updated);
      onUpdateAgencySettings(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveStamp = () => {
    const updated = {
      ...formData,
      agencyStampUrl: null,
    };
    setFormData(updated);
    onUpdateAgencySettings(updated);
    if (stampFileInputRef.current) {
      stampFileInputRef.current.value = '';
    }
  };

  // Handle employee avatar / personal logo
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG أو JPG أو WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = {
        ...formData,
        userProfile: {
          ...formData.userProfile,
          name: formData.userProfile?.name || user?.displayName || 'المستخدم',
          email: formData.userProfile?.email || user?.email || '',
          role: formData.userProfile?.role || 'موظف',
          avatarUrl: base64,
        },
      };
      setFormData(updated);
      onUpdateAgencySettings(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    const updated = {
      ...formData,
      userProfile: {
        ...formData.userProfile,
        name: formData.userProfile?.name || 'المستخدم',
        email: formData.userProfile?.email || '',
        role: formData.userProfile?.role || 'موظف',
        avatarUrl: null,
      },
    };
    setFormData(updated);
    onUpdateAgencySettings(updated);
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.value = '';
    }
  };

  const handleSaveAgency = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAgencySettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Add or update an editor/collaborator with strict duplicate email protection
  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollabName.trim() || !newCollabEmail.trim()) {
      setCollabError('يرجى كتابة اسم الزميل والبريد الإلكتروني');
      return;
    }

    const cleanEmail = newCollabEmail.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setCollabError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    const effectiveOwnerEmail = (
      user?.email ||
      formData.ownerEmail ||
      formData.userProfile?.email ||
      PRIMARY_OWNER_EMAIL
    ).trim().toLowerCase();

    // Protect primary owner email from being added as a collaborator or duplicated
    if (cleanEmail === effectiveOwnerEmail || cleanEmail === PRIMARY_OWNER_EMAIL.toLowerCase()) {
      setCollabError('هذا البريد الإلكتروني مسجل كمالك رئيسي للنظام يملك كامل الصلاحيات ولا يحتاج إضافته كعضو مكرر.');
      return;
    }

    const currentCollabs = formData.collaborators || [];
    const chosenTabs =
      newCollabRole === 'مخصص (Custom)'
        ? newCollabCustomTabs
        : DEFAULT_ROLE_TABS[newCollabRole] || ['quotations', 'sales', 'inventory'];

    // Check if email already exists in collaborators
    const existingIndex = currentCollabs.findIndex(
      (c) => c.email.toLowerCase().trim() === cleanEmail
    );

    let updatedCollabs: Collaborator[];

    if (existingIndex >= 0) {
      // Update the existing member's role and tabs without duplicating the email
      updatedCollabs = [...currentCollabs];
      updatedCollabs[existingIndex] = {
        ...updatedCollabs[existingIndex],
        name: newCollabName.trim(),
        role: newCollabRole,
        customPermissions: chosenTabs,
      };
    } else {
      const newCollab: Collaborator = {
        id: `collab-${Date.now()}`,
        name: newCollabName.trim(),
        email: cleanEmail,
        role: newCollabRole,
        customPermissions: chosenTabs,
        addedAt: new Date().toISOString().split('T')[0],
        status: 'نشط',
      };
      updatedCollabs = [...currentCollabs, newCollab];
    }

    // Strict deduplication safeguard: keep unique records per email address & exclude owner email
    const uniqueMap = new Map<string, Collaborator>();
    for (const c of updatedCollabs) {
      const emailKey = c.email.trim().toLowerCase();
      if (emailKey && emailKey !== effectiveOwnerEmail) {
        uniqueMap.set(emailKey, c);
      }
    }
    const deduplicatedCollabs = Array.from(uniqueMap.values());

    const updatedSettings = {
      ...formData,
      collaborators: deduplicatedCollabs,
    };

    setFormData(updatedSettings);
    onUpdateAgencySettings(updatedSettings);

    setNewCollabName('');
    setNewCollabEmail('');
    setNewCollabRole('محرر (Editor)');
    setNewCollabCustomTabs(['quotations', 'sales', 'inventory']);
    setCollabError('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Direct role update from dropdown
  const handleUpdateCollaboratorRole = (collabId: string, newRole: Collaborator['role']) => {
    const currentCollabs = formData.collaborators || [];
    const defaultTabs = DEFAULT_ROLE_TABS[newRole] || ['quotations', 'sales', 'inventory'];
    const updatedCollabs = currentCollabs.map((c) => {
      if (c.id === collabId) {
        return {
          ...c,
          role: newRole,
          customPermissions: defaultTabs,
        };
      }
      return c;
    });

    // Deduplicate safeguard
    const uniqueMap = new Map<string, Collaborator>();
    for (const c of updatedCollabs) {
      const emailKey = c.email.trim().toLowerCase();
      uniqueMap.set(emailKey, c);
    }

    const updatedSettings = {
      ...formData,
      collaborators: Array.from(uniqueMap.values()),
    };
    setFormData(updatedSettings);
    onUpdateAgencySettings(updatedSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Direct toggle for individual screen permissions
  const handleToggleCollaboratorTab = (collabId: string, tabId: NavigationTab) => {
    const currentCollabs = formData.collaborators || [];
    const updatedCollabs = currentCollabs.map((c) => {
      if (c.id === collabId) {
        const currentTabs =
          c.customPermissions || DEFAULT_ROLE_TABS[c.role] || ['quotations', 'sales', 'inventory'];
        const isAllowed = currentTabs.includes(tabId);
        const nextTabs = isAllowed
          ? currentTabs.filter((t) => t !== tabId)
          : [...currentTabs, tabId];

        return {
          ...c,
          role: 'مخصص (Custom)' as Collaborator['role'],
          customPermissions: nextTabs,
        };
      }
      return c;
    });

    // Deduplicate safeguard
    const uniqueMap = new Map<string, Collaborator>();
    for (const c of updatedCollabs) {
      const emailKey = c.email.trim().toLowerCase();
      uniqueMap.set(emailKey, c);
    }

    const updatedSettings = {
      ...formData,
      collaborators: Array.from(uniqueMap.values()),
    };
    setFormData(updatedSettings);
    onUpdateAgencySettings(updatedSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDeleteCollaborator = (id: string) => {
    const currentCollabs = formData.collaborators || [];
    const target = currentCollabs.find((c) => c.id === id);
    const targetEmail = target?.email.trim().toLowerCase();

    // Remove by ID and also clean up any duplicate entries with the same email
    const updatedCollabs = currentCollabs.filter(
      (c) => c.id !== id && (!targetEmail || c.email.trim().toLowerCase() !== targetEmail)
    );

    const updatedSettings = {
      ...formData,
      collaborators: updatedCollabs,
    };
    setFormData(updatedSettings);
    onUpdateAgencySettings(updatedSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCopyAppLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg">
                إعدادات الوكالة، الشعار، والملف الشخصي والمحررين
              </h2>
              <p className="text-xs text-slate-300">
                تحكم كامل بهوية المنشأة، الشعار الرسمي، بيانات الحساب، ومشاركة العمل مع محررين آخرين
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 sm:px-6">
          <button
            id="tab-agency-brand"
            onClick={() => setActiveTab('agency')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'agency'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span>شعار وبيانات الوكالة</span>
          </button>

          <button
            id="tab-user-profile"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-4 h-4 text-indigo-600" />
            <span>الملف الشخصي والحساب</span>
          </button>

          <button
            id="tab-team-collaborators"
            onClick={() => setActiveTab('collaborators')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'collaborators'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-amber-600" />
            <span>إضافة محررين ومشاركة العمل</span>
            {(formData.collaborators?.length || 0) > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-1.5 py-0.2 rounded-full">
                {formData.collaborators?.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm flex items-center gap-2 font-bold animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>تم حفظ وتحديث البيانات والشعار بنجاح! تظهر الآن في أعلى التطبيق وفي الفواتير المطبوعة.</span>
            </div>
          )}

          {/* TAB 1: AGENCY BRAND & LOGO */}
          {activeTab === 'agency' && (
            <form onSubmit={handleSaveAgency} className="space-y-6">
              {/* Logo Upload Section */}
              <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200">
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-2">
                  شعار الوكالة / المؤسسة (Logo)
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  يظهر الشعار في الترويسة الرئيسية للنظام وفي الفواتير وسندات القبض المطبوعة والضريبية.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-5">
                  {/* Current Logo Preview */}
                  <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center p-2 overflow-hidden shadow-xs shrink-0">
                    {formData.agencyLogoUrl ? (
                      <img
                        src={formData.agencyLogoUrl}
                        alt="شعار الوكالة"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-slate-400 p-2">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                        <span className="text-[10px] block font-semibold">لا يوجد شعار</span>
                      </div>
                    )}
                  </div>

                  {/* Logo Actions */}
                  <div className="space-y-3 flex-1 text-center sm:text-right">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                      id="agency-logo-file-input"
                    />

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{formData.agencyLogoUrl ? 'تغيير الشعار' : 'رفع شعار جديد'}</span>
                      </button>

                      {formData.agencyLogoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>حذف الشعار</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      الصيغ المدعومة: PNG, JPG, SVG, WebP. يُفضل شعار بخلفية شفافة بدقة واضحة للحصول على أفضل مظهر في الفواتير المطبوعة.
                    </p>
                  </div>
                </div>
              </div>

              {/* Agency Name & Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم الوكالة / المحل / المؤسسة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.agencyName}
                    onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                    placeholder="مثال: وكالة الإبداع للدعاية والإعلان"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يظهر في أعلى التطبيق والفواتير المطبوعة.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    النشاط أو الوصف الفرعي
                  </label>
                  <input
                    type="text"
                    value={formData.agencySubtitle}
                    onChange={(e) => setFormData({ ...formData, agencySubtitle: e.target.value })}
                    placeholder="مثال: خدمات الطباعة الرقمية واللوحات الإعلانية والأوفست"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Tax & Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      الرقم الضريبي للمنشأة
                    </label>
                    <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.showVatNumber ?? true}
                        onChange={(e) =>
                          setFormData({ ...formData, showVatNumber: e.target.checked })
                        }
                        className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>إظهار في المطبوعات</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={formData.agencyVatNumber}
                    onChange={(e) => setFormData({ ...formData, agencyVatNumber: e.target.value })}
                    placeholder="310123456700003"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يمكنك إخفاؤه في الفواتير العادية غير الضريبية
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الدولة / البلد (قابل للتعديل)
                  </label>
                  <input
                    type="text"
                    value={formData.agencyCountry ?? 'المملكة العربية السعودية'}
                    onChange={(e) => setFormData({ ...formData, agencyCountry: e.target.value })}
                    placeholder="المملكة العربية السعودية"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    تظهر في ترويسة وعنوان الفواتير والمطبوعات
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم الهاتف / الواتساب
                  </label>
                  <input
                    type="text"
                    value={formData.agencyPhone}
                    onChange={(e) => setFormData({ ...formData, agencyPhone: e.target.value })}
                    placeholder="0501234567"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    العنوان والفرع والمدينة
                  </label>
                  <input
                    type="text"
                    value={formData.agencyAddress}
                    onChange={(e) => setFormData({ ...formData, agencyAddress: e.target.value })}
                    placeholder="الرياض - حي الملز"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Default Language Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    لغة واجهة النظام الافتراضية
                  </label>
                  <select
                    id="select-agency-language"
                    value={formData.appLanguage || 'ar'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        appLanguage: e.target.value as 'ar' | 'en',
                      })
                    }
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-slate-800"
                  >
                    <option value="ar">🇸🇦 العربية (Arabic)</option>
                    <option value="en">🇬🇧 English (الإنجليزية)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يمكن لكل موظف أيضاً اختيار لغته الخاصة من تبويب «الملف الشخصي والحساب»
                  </span>
                </div>
              </div>

              {/* Shop Stamp & Invoice Footer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ختم المحل / المؤسسة (يظهر أسفل الفواتير)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    ارفع صورة الختم الرسمي للمحل (PNG بخلفية شفافة).
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-20 rounded-lg border border-slate-300 bg-white flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
                      {formData.agencyStampUrl ? (
                        <img
                          src={formData.agencyStampUrl}
                          alt="ختم المحل"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 text-center font-bold">لا يوجد ختم</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={stampFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleStampChange}
                        className="hidden"
                        id="agency-stamp-file-input"
                      />
                      <button
                        type="button"
                        onClick={() => stampFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{formData.agencyStampUrl ? 'تغيير الختم' : 'رفع ختم المحل'}</span>
                      </button>
                      {formData.agencyStampUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveStamp}
                          className="block text-rose-600 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
                        >
                          حذف الختم
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    تذييل وملاحظات الفاتورة الثابتة
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    عبارة شكر أو شروط الاستلام تظهر في أسفل كل فاتورة مطبوعة.
                  </p>
                  <textarea
                    rows={3}
                    value={formData.invoiceFooterText || ''}
                    onChange={(e) => setFormData({ ...formData, invoiceFooterText: e.target.value })}
                    placeholder="مثال: شكراً لتعاملكم معنا - نرجو فحص المطبوعات عند الاستلام..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Custom Agency QR Code Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <QrCode className="w-4 h-4 text-amber-600" />
                  <label className="block text-xs font-bold text-slate-800">
                    كود QR مخصص للوكالة (يظهر على اليمين أسفل العروض والفواتير)
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  ارفع صورة رمز QR الخاص بوكالتك (مثلاً رابط الواتساب، رابط المتجر أو الموقع، أو حساب الدفع). إذا تم رفعه سيظهر كودك المخصص في المطبوعات بدلاً من الرمز التلقائي.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 bg-white flex items-center justify-center p-1.5 overflow-hidden shrink-0 shadow-xs">
                    {formData.customQrUrl ? (
                      <img
                        src={formData.customQrUrl}
                        alt="كود QR الخاص بالوكالة"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-slate-400 p-1">
                        <QrCode className="w-8 h-8 mx-auto mb-0.5 opacity-50" />
                        <span className="text-[9px] block font-bold">لا يوجد كود خاص</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-center sm:text-right">
                    <input
                      ref={customQrFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCustomQrChange}
                      className="hidden"
                      id="agency-custom-qr-input"
                    />
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => customQrFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{formData.customQrUrl ? 'تغيير كود QR' : 'رفع كود QR خاص'}</span>
                      </button>
                      {formData.customQrUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveCustomQr}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف كود QR الخاص</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      الصيغ: PNG أو JPG. يُفضل صورة مربعة واضحة لسهولة مسحها بواسطة هواتف العملاء.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ بيانات وشعار الوكالة</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: USER PROFILE & ACCOUNT */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200">
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 mb-2">
                  بيانات حسابك والملف الشخصي
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  تعديل اسمك المعروض ومسماك الوظيفي، وربط حسابك عبر Google للوصول السحابي
                </p>

                {/* User Avatar, Personal Logo & Google Auth Status */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 mb-5">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    {formData.userProfile?.avatarUrl ? (
                      <img
                        src={formData.userProfile.avatarUrl}
                        alt="شعار الموظف"
                        className="w-16 h-16 rounded-full border-2 border-emerald-500 shadow-sm object-cover"
                      />
                    ) : user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'صورة الحساب'}
                        className="w-16 h-16 rounded-full border-2 border-emerald-500 shadow-sm object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xl font-bold flex items-center justify-center shadow-sm">
                        {(formData.userProfile?.name || user?.displayName || user?.email || 'م')[0]}
                      </div>
                    )}
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      id="employee-avatar-input"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => avatarFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer transition shadow-2xs"
                        title="تغيير أو رفع شعار خاص بالموظف"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{formData.userProfile?.avatarUrl ? 'تغيير الشعار' : 'رفع شعار الموظف'}</span>
                      </button>
                      {formData.userProfile?.avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="p-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] cursor-pointer"
                          title="حذف الشعار الخاص"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-right">
                    <div className="font-bold text-slate-800 text-sm sm:text-base flex items-center justify-center sm:justify-start gap-2">
                      <span>{formData.userProfile?.name || user?.displayName || 'المشرف الرئيسي'}</span>
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        {formData.userProfile?.role || 'مدير عام (Admin)'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex items-center justify-center sm:justify-start gap-1 font-mono">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{user?.email || 'لم يتم تسجيل الدخول بـ Google بعد'}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {user ? (
                      <button
                        type="button"
                        onClick={onLogout}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 text-xs font-semibold transition cursor-pointer"
                      >
                        تسجيل خروج Google
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onLogin}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <span>تسجيل الدخول بـ Google</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile Edit Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اسم المستخدم المعروض (Display Name)
                    </label>
                    <input
                      type="text"
                      value={formData.userProfile?.name || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          userProfile: {
                            ...formData.userProfile,
                            name: e.target.value,
                            email: formData.userProfile?.email || user?.email || '',
                            role: formData.userProfile?.role || 'مدير عام',
                          },
                        })
                      }
                      placeholder="اسمك الشخصي أو اسم المستخدم"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      المسمى الوظيفي / الدور
                    </label>
                    <input
                      type="text"
                      value={formData.userProfile?.role || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          userProfile: {
                            ...formData.userProfile,
                            name: formData.userProfile?.name || 'المشرف الرئيسي',
                            email: formData.userProfile?.email || user?.email || '',
                            role: e.target.value,
                          },
                        })
                      }
                      placeholder="مثال: المدير العام، مسؤول الحسابات، مشرف الطباعة"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Employee Preferred Language Selection */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      لغة واجهة التطبيق المفضلة لك (Language Preference)
                    </label>
                    <select
                      id="select-employee-language"
                      value={formData.userProfile?.language || formData.appLanguage || 'ar'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          userProfile: {
                            ...formData.userProfile,
                            name: formData.userProfile?.name || 'المشرف الرئيسي',
                            email: formData.userProfile?.email || user?.email || '',
                            role: formData.userProfile?.role || 'مدير عام',
                            language: e.target.value as 'ar' | 'en',
                          },
                        })
                      }
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-slate-800"
                    >
                      <option value="ar">🇸🇦 العربية (Arabic - مسميات مختصرة ومباشرة)</option>
                      <option value="en">🇬🇧 English (الإنجليزية - Simplified clean labels)</option>
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      يتيح هذا الخيار لكل موظف استخدام واجهة التطبيق باللغة التي تناسبه سواء عربي أو إنجليزي.
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateAgencySettings(formData);
                      setSaveSuccess(true);
                      setTimeout(() => setSaveSuccess(false), 3000);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ بيانات الملف الشخصي</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ADD EDITORS & COLLABORATORS */}
          {activeTab === 'collaborators' && (
            <div className="space-y-4">
              {/* Add New Editor Form */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
                <h4 className="font-bold text-xs sm:text-sm text-slate-800 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>تسجيل محرر أو عضو فريق جديد في النظام</span>
                </h4>

                {collabError && (
                  <div className="p-2.5 mb-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <span>{collabError}</span>
                  </div>
                )}

                <form onSubmit={handleAddCollaborator} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      اسم المحرر / الموظف
                    </label>
                    <input
                      type="text"
                      value={newCollabName}
                      onChange={(e) => setNewCollabName(e.target.value)}
                      placeholder="مثال: محمد المحاسب"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      البريد الإلكتروني (Google Email)
                    </label>
                    <input
                      type="email"
                      value={newCollabEmail}
                      onChange={(e) => setNewCollabEmail(e.target.value)}
                      placeholder="mohammed@gmail.com"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      الدور / الصلاحية
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={newCollabRole}
                        onChange={(e) => setNewCollabRole(e.target.value as Collaborator['role'])}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        <option value="مسوق ومندوب مبيعات (Sales Rep)">مسوق / مندوب (عروض أسعار ومبيعات فقط)</option>
                        <option value="أمين مستودع (Warehouse Keeper)">أمين مستودع (المستودع والمشتريات فقط)</option>
                        <option value="محاسب (Accountant)">محاسب (لوحة التحكم، مبيعات، مشتريات، مصروفات)</option>
                        <option value="محرر (Editor)">محرر (عروض أسعار، مبيعات، ومستودع)</option>
                        <option value="مدير (Admin)">مدير عام (كافة الصلاحيات والإعدادات)</option>
                        <option value="مشاهد (Viewer)">مشاهد (اطلاع فقط دون تعديل)</option>
                        <option value="مخصص (Custom)">صلاحيات مخصصة (اختيار الأقسام يدوياً)</option>
                      </select>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>

                  {/* Custom Permissions Checkboxes if Custom role is chosen */}
                  {newCollabRole === 'مخصص (Custom)' && (
                    <div className="sm:col-span-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                      <div className="text-xs font-bold text-amber-900 mb-2">
                        حدد الأقسام المسموح لهذا المستخدم بالوصول إليها:
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {ALL_NAVIGATION_TABS.map((tabItem) => {
                          const isChecked = newCollabCustomTabs.includes(tabItem.id as NavigationTab);
                          return (
                            <label
                              key={tabItem.id}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition select-none ${
                                isChecked
                                  ? 'bg-white border-emerald-400 shadow-2xs font-bold text-emerald-950'
                                  : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewCollabCustomTabs([...newCollabCustomTabs, tabItem.id as NavigationTab]);
                                  } else {
                                    setNewCollabCustomTabs(newCollabCustomTabs.filter((t) => t !== tabItem.id));
                                  }
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="flex items-center gap-1">
                                <span>{tabItem.iconLabel}</span>
                                <span>{tabItem.label.split(' ')[0]}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/* Collaborators List & Screen Access Matrix */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2 text-emerald-400">
                      <Users className="w-4 h-4" />
                      <span>قائمة فريق العمل وتخصيص صلاحيات الشاشات ({formData.collaborators?.length || 0})</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      يمكنك تغيير منصب أي زميل فوراً أو فتح/إغلاق شاشات معينة له بدون الحاجة لأي تعديل برمجي.
                    </p>
                  </div>
                  {saveSuccess && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 animate-pulse">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      تم الحفظ والتحديث فوراً
                    </span>
                  )}
                </div>

                {/* Guide Box */}
                <div className="p-3 bg-indigo-50/70 border-b border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-950">
                  <Sliders className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 leading-relaxed">
                    <p>
                      <strong>طريقة تغيير الصلاحيات:</strong> اختر الدور الجديد من القائمة أمام أي زميل ليتم تحديثه، أو اضغط على <strong>"تخصيص الشاشات والوصول"</strong> لتحديد أو إلغاء أي شاشة ترغب بأن يصل إليها (مثل فتح المصروفات للمحرر أو قفلها).
                    </p>
                    <p className="text-[11px] text-indigo-700">
                      🔒 <strong>حماية الإعدادات:</strong> شاشات الإعدادات، الشعار، والملف الشخصي محجوبة تلقائياً عن المحررين والمحاسبين ومخصصة للمالك والمدير العام فقط.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-200">
                  {(() => {
                    const effectiveOwnerEmail = (
                      user?.email ||
                      formData.ownerEmail ||
                      formData.userProfile?.email ||
                      PRIMARY_OWNER_EMAIL
                    ).trim().toLowerCase();

                    const activeCollaborators = (formData.collaborators || []).filter(
                      (collab) => collab.email?.trim().toLowerCase() !== effectiveOwnerEmail
                    );

                    return (
                      <>
                        {/* Primary Owner Account Banner */}
                        <div className="p-4 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/70">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                              👑
                            </div>
                            <div>
                              <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                                <span>{formData.userProfile?.name || user?.displayName || 'مالك النظام الأساسي'}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                                  مالك رئيسي (Owner)
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 font-mono mt-0.5">
                                {effectiveOwnerEmail}
                              </div>
                            </div>
                          </div>
                          <div className="text-right sm:text-left">
                            <span className="text-[11px] text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full font-bold border border-emerald-300 inline-flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              كامل الصلاحيات (كافة الشاشات + الإعدادات)
                            </span>
                          </div>
                        </div>

                        {activeCollaborators.length === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                            <p className="font-bold text-slate-700">لم تقم بإضافة زملاء إضافيين بعد.</p>
                            <p className="text-slate-400">استخدم النموذج أعلاه لإضافة زميلك وتحديد صلاحيات شاشاته.</p>
                          </div>
                        ) : (
                          activeCollaborators.map((collab) => {
                            const currentTabs =
                              collab.customPermissions ||
                              DEFAULT_ROLE_TABS[collab.role] || [
                                'quotations',
                                'sales',
                                'inventory',
                        ];
                      const isExpanded = expandedCollabId === collab.id;
                      const hasAdminSettings =
                        collab.role.includes('مدير') ||
                        collab.role.includes('Admin') ||
                        collab.role.includes('مالك') ||
                        collab.role.includes('Owner');

                      return (
                        <div key={collab.id} className="p-4 hover:bg-slate-50/70 transition space-y-3">
                          {/* Member Header Bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                {collab.name ? collab.name[0] : 'U'}
                              </div>
                              <div>
                                <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                                  <span>{collab.name}</span>
                                  <span
                                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                      hasAdminSettings
                                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                        : collab.role.includes('محاسب')
                                        ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                        : collab.role.includes('مسوق')
                                        ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300'
                                        : collab.role.includes('مستودع')
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                    }`}
                                  >
                                    {collab.role}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                                  <span>{collab.email}</span>
                                  <span className="text-[10px] text-slate-400 hidden md:inline">
                                    • أضيف: {collab.addedAt}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Controls: Role Selector + Actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-2xs">
                                <label className="text-[11px] font-bold text-slate-500 shrink-0">
                                  الدور:
                                </label>
                                <select
                                  value={collab.role}
                                  onChange={(e) =>
                                    handleUpdateCollaboratorRole(
                                      collab.id,
                                      e.target.value as Collaborator['role']
                                    )
                                  }
                                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                                >
                                  <option value="مدير (Admin)">⚡ مدير عام (Admin)</option>
                                  <option value="محاسب (Accountant)">💼 محاسب (Accountant)</option>
                                  <option value="مسوق ومندوب مبيعات (Sales Rep)">🎯 مسوق ومندوب (Sales)</option>
                                  <option value="أمين مستودع (Warehouse Keeper)">📦 أمين مستودع (Warehouse)</option>
                                  <option value="محرر (Editor)">✏️ محرر (Editor)</option>
                                  <option value="مشاهد (Viewer)">👁️ مشاهد (Viewer)</option>
                                  <option value="مخصص (Custom)">⚙️ صلاحيات مخصصة (Custom)</option>
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedCollabId(isExpanded ? null : collab.id)
                                }
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                                  isExpanded
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}
                                title="تخصيص الشاشات المفتوحة"
                              >
                                <span>الشاشات المفتوحة ({currentTabs.length}/{ALL_NAVIGATION_TABS.length})</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {collab.id !== 'collab-owner' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCollaborator(collab.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                  title="حذف هذا الزميل من الفريق"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Quick Screen summary tags */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-500">الشاشات المتاحة له:</span>
                            {ALL_NAVIGATION_TABS.map((tab) => {
                              const isAllowed = currentTabs.includes(tab.id);
                              return (
                                <span
                                  key={tab.id}
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                    isAllowed
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60'
                                  }`}
                                >
                                  {tab.iconLabel} {tab.label.split(' ')[0]}
                                </span>
                              );
                            })}

                            <span className="mr-auto text-[11px]">
                              {hasAdminSettings ? (
                                <span className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 inline-flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  الإعدادات: مصرح
                                </span>
                              ) : (
                                <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  الإعدادات: محجوبة
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Interactive Screen Customization Panel (Expandable) */}
                          {isExpanded && (
                            <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-emerald-200 shadow-inner">
                              <div className="text-xs font-bold text-slate-800 mb-2.5 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-emerald-800">
                                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>حدد أو ألغِ أي شاشة لفتحها أو حجبها فوراً عن ({collab.name}):</span>
                                </span>
                                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-semibold">
                                  تحديث لحظي بدون كود
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {ALL_NAVIGATION_TABS.map((tab) => {
                                  const isAllowed = currentTabs.includes(tab.id);
                                  return (
                                    <button
                                      type="button"
                                      key={tab.id}
                                      onClick={() =>
                                        handleToggleCollaboratorTab(collab.id, tab.id)
                                      }
                                      className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-bold border transition text-right cursor-pointer select-none ${
                                        isAllowed
                                          ? 'bg-white text-emerald-900 border-emerald-400 shadow-xs'
                                          : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/70'
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <span className="text-sm">{tab.iconLabel}</span>
                                        <span>{tab.label}</span>
                                      </span>
                                      {isAllowed ? (
                                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shadow-xs">
                                          ✓
                                        </span>
                                      ) : (
                                        <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-[10px]">
                                          ✕
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
                                <div>
                                  {hasAdminSettings ? (
                                    <span className="text-purple-700 font-bold flex items-center gap-1">
                                      <Shield className="w-3.5 h-3.5" />
                                      هذا الحساب يمتلك صلاحية الدخول لصفحة الإعدادات وهوية الوكالة وتعديل الفريق.
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 flex items-center gap-1">
                                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                                      صفحة الإعدادات، الشعار، وبيانات الفريق محجوبة تماماً عن هذا الحساب.
                                    </span>
                                  )}
                                </div>
                                <div className="text-emerald-700 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>يتم الحفظ والتطبيق تلقائياً</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              );
            })()}
          </div>
              </div>
            </div>
          )}

          {/* Data Backup & Reset Controls */}
          <div className="mt-6 pt-4 border-t border-slate-200 bg-slate-50 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-extrabold text-slate-900">إدارة قاعدة البيانات والنسخ الاحتياطي وتصفير البيانات التجريبية</div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                يمكنك حفظ نسخة احتياطية كاملة (JSON) أو استعادتها أو مسح البيانات التجريبية للبدء بسجل نظيف.
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              {onExportJsonBackup && (
                <button
                  type="button"
                  onClick={onExportJsonBackup}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer"
                >
                  ⬇️ تصدير نسخة احتياطية (JSON)
                </button>
              )}
              {onImportJsonBackup && (
                <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer">
                  <span>⬆️ استعادة نسخة (JSON)</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportJsonBackup(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              {onClearAllRecords && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("هل أنت متأكد من مسح كافة السجلات والبيانات التجريبية والبدء بقاعدة بيانات فارغة؟ (تبقى إعدادات وشعار المنشأة محفوظة)")) {
                      onClearAllRecords();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  🗑️ تصفير ومسح البيانات التجريبية
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
