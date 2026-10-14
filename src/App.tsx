import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  SaleItem,
  PurchaseItem,
  ExpenseItem,
  InventoryItem,
  QuotationItem,
  VoucherItem,
  NavigationTab,
  AgencySettings,
  UserRole,
} from './types';
import {
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_EXPENSES,
  INITIAL_INVENTORY,
  INITIAL_QUOTATIONS,
  INITIAL_VOUCHERS,
  calculateDashboardMetrics,
  DEFAULT_AGENCY_SETTINGS,
  LOCAL_STORAGE_KEY_QUOTATIONS,
  LOCAL_STORAGE_KEY_VOUCHERS,
  convertQuotationToSale,
} from './lib/dataStore';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setCachedAccessToken,
} from './lib/firebase';
import {
  createCompleteSpreadsheet,
  syncAllDataToGoogleSheet,
  getSpreadsheetDetails,
} from './lib/sheetsService';
import { exportToExcelFile } from './lib/excelExport';
import {
  subscribeToAgencyData,
  subscribeToPublicAgencySettings,
  cloudSaveSale,
  cloudDeleteSale,
  cloudSavePurchase,
  cloudDeletePurchase,
  cloudSaveExpense,
  cloudDeleteExpense,
  cloudSaveInventory,
  cloudDeleteInventory,
  cloudSaveQuotation,
  cloudDeleteQuotation,
  cloudSaveVoucher,
  cloudDeleteVoucher,
  cloudSaveAgencySettings,
  uploadAllDataToCloud,
  isQuotaExhaustedToday,
  resetCloudNetwork,
  SyncStatus,
} from './lib/cloudSync';

import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { QuotationsView } from './components/QuotationsView';
import { SalesView } from './components/SalesView';
import { PurchasesView } from './components/PurchasesView';
import { ExpensesView } from './components/ExpensesView';
import { InventoryView } from './components/InventoryView';
import { VouchersView } from './components/VouchersView';
import { PricingCalculatorView } from './components/PricingCalculatorView';
import { AuditTimelineModal } from './components/AuditTimelineModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { FormulasModal } from './components/FormulasModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { QuotationPrintModal } from './components/QuotationPrintModal';
import { AgencyProfileModal } from './components/AgencyProfileModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { AuthGate } from './components/AuthGate';
import { updateDynamicBranding } from './lib/branding';
import { logAuditEvent } from './lib/auditLogger';
import { getUserRole, getAllowedTabs, canAccessSettings, isPrimaryOwner } from './lib/permissions';

const LOCAL_STORAGE_KEY_SALES = 'adv_accounting_sales';
const LOCAL_STORAGE_KEY_PURCHASES = 'adv_accounting_purchases';
const LOCAL_STORAGE_KEY_EXPENSES = 'adv_accounting_expenses';
const LOCAL_STORAGE_KEY_INVENTORY = 'adv_accounting_inventory';
const LOCAL_STORAGE_KEY_SHEET_ID = 'adv_accounting_sheet_id';
const LOCAL_STORAGE_KEY_AGENCY = 'adv_accounting_agency_settings';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [saleForReceiptVoucher, setSaleForReceiptVoucher] = useState<SaleItem | null>(null);

  // Core Data States
  const [quotations, setQuotations] = useState<QuotationItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_QUOTATIONS);
      return saved ? JSON.parse(saved) : INITIAL_QUOTATIONS;
    } catch {
      return INITIAL_QUOTATIONS;
    }
  });

  const [sales, setSales] = useState<SaleItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SALES);
      return saved ? JSON.parse(saved) : INITIAL_SALES;
    } catch {
      return INITIAL_SALES;
    }
  });

  const [purchases, setPurchases] = useState<PurchaseItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PURCHASES);
      return saved ? JSON.parse(saved) : INITIAL_PURCHASES;
    } catch {
      return INITIAL_PURCHASES;
    }
  });

  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_EXPENSES);
      return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
    } catch {
      return INITIAL_EXPENSES;
    }
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_INVENTORY);
      return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
    } catch {
      return INITIAL_INVENTORY;
    }
  });

  const [vouchers, setVouchers] = useState<VoucherItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_VOUCHERS);
      return saved ? JSON.parse(saved) : INITIAL_VOUCHERS;
    } catch {
      return INITIAL_VOUCHERS;
    }
  });

  // Agency & Tax Branding Settings
  const [agencySettings, setAgencySettings] = useState<AgencySettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_AGENCY);
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed.previewRole;
        return parsed;
      }
      return DEFAULT_AGENCY_SETTINGS;
    } catch {
      return DEFAULT_AGENCY_SETTINGS;
    }
  });

  // Google Sheets integration state
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_ID);
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    const id = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_ID);
    return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
  });

  // Auth States
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isProcessingSheets, setIsProcessingSheets] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<SyncStatus>('connecting');

  // Modals
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [isPurchasesModalOpen, setIsPurchasesModalOpen] = useState(false);
  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isFormulasModalOpen, setIsFormulasModalOpen] = useState(false);
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [printSale, setPrintSale] = useState<SaleItem | null>(null);
  const [printQuotation, setPrintQuotation] = useState<QuotationItem | null>(null);

  // Auto-dismiss toasts
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Persist to local storage as fallback offline cache
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_QUOTATIONS, JSON.stringify(quotations));
    } catch (e) {
      console.error(e);
    }
  }, [quotations]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SALES, JSON.stringify(sales));
    } catch (e) {
      console.error(e);
    }
  }, [sales]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PURCHASES, JSON.stringify(purchases));
    } catch (e) {
      console.error(e);
    }
  }, [purchases]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
    } catch (e) {
      console.error(e);
    }
  }, [expenses]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_INVENTORY, JSON.stringify(inventory));
    } catch (e) {
      console.error(e);
    }
  }, [inventory]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_VOUCHERS, JSON.stringify(vouchers));
    } catch (e) {
      console.error(e);
    }
  }, [vouchers]);

  // Real-time Public Agency Branding Listener (Active immediately on load, even before login)
  useEffect(() => {
    const unsub = subscribeToPublicAgencySettings((cloudSettings) => {
      if (cloudSettings && (cloudSettings.agencyName || cloudSettings.agencyLogoUrl)) {
        setAgencySettings((prev) => ({
          ...prev,
          ...cloudSettings,
        }));
        updateDynamicBranding(cloudSettings);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_AGENCY, JSON.stringify(cloudSettings));
        } catch (e) {
          console.error(e);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_AGENCY, JSON.stringify(agencySettings));
      updateDynamicBranding(agencySettings);
    } catch (e) {
      console.error(e);
    }
  }, [agencySettings]);

  // Temporary session preview role for the owner (never saved to Firestore to prevent demotion)
  const [previewRole, setPreviewRole] = useState<UserRole | null>(() => {
    try {
      const saved = sessionStorage.getItem('pos_preview_role');
      return (saved as UserRole) || null;
    } catch {
      return null;
    }
  });

  const handleSwitchPreviewRole = (role: UserRole | null) => {
    setPreviewRole(role);
    try {
      if (role) {
        sessionStorage.setItem('pos_preview_role', role);
      } else {
        sessionStorage.removeItem('pos_preview_role');
      }
    } catch {}
  };

  // Determine user role and allowed permissions
  const realRole = getUserRole(user, agencySettings);
  const isOwner = isPrimaryOwner(user, agencySettings);
  const userRole = isOwner && previewRole ? previewRole : realRole;

  // Global application language preference (English or Arabic)
  const currentLang = (agencySettings.userProfile?.language || agencySettings.appLanguage || 'ar') as 'ar' | 'en';

  // Synchronize root document language and reading direction (RTL / LTR)
  useEffect(() => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'en' ? 'ltr' : 'rtl';
  }, [currentLang]);

  // Allowed navigation tabs for current user/role
  const allowedTabs = getAllowedTabs(userRole, previewRole ? null : user, agencySettings);

  // Auto-switch navigation tab if restricted for this user role
  useEffect(() => {
    // When previewing a role, pass null for user so simulated role permissions are tested faithfully
    const allowed = getAllowedTabs(userRole, previewRole ? null : user, agencySettings);
    if (!allowed.includes(activeTab)) {
      setActiveTab(allowed[0] || 'pricing');
    }
  }, [userRole, previewRole, activeTab, user, agencySettings]);

  // Current actor details for audit logging
  const currentActorName = user?.displayName || agencySettings.userProfile?.displayName || 'مستخدم النظام';
  const currentActorEmail = user?.email || agencySettings.userProfile?.email || '';

  // Firebase Auth initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        if (token) setAccessToken(token);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Real-time Cloud Synchronization via Firebase Firestore (active only for authenticated accounts)
  useEffect(() => {
    if (!user) {
      setCloudSyncStatus('offline');
      return;
    }

    const unsubscribe = subscribeToAgencyData(
      {
        onSalesUpdate: (cloudSales) => {
          if (cloudSales) {
            setSales(cloudSales);
          }
        },
        onPurchasesUpdate: (cloudPurchases) => {
          if (cloudPurchases) {
            setPurchases(cloudPurchases);
          }
        },
        onExpensesUpdate: (cloudExpenses) => {
          if (cloudExpenses) {
            setExpenses(cloudExpenses);
          }
        },
        onInventoryUpdate: (cloudInventory) => {
          if (cloudInventory) {
            setInventory(cloudInventory);
          }
        },
        onQuotationsUpdate: (cloudQuotations) => {
          if (cloudQuotations) {
            setQuotations(cloudQuotations);
          }
        },
        onVouchersUpdate: (cloudVouchers) => {
          if (cloudVouchers) {
            setVouchers(cloudVouchers);
          }
        },
        onAgencySettingsUpdate: (cloudSettings) => {
          if (cloudSettings && cloudSettings.agencyName) {
            const sanitized = { ...cloudSettings };
            delete (sanitized as any).previewRole;
            setAgencySettings(sanitized);
          }
        },
        onStatusChange: (status, err) => {
          setCloudSyncStatus(status);
          if (status === 'error' && err) {
            console.warn('Cloud sync note:', err);
          }
        },
      },
      {
        sales,
        purchases,
        expenses,
        inventory,
        quotations,
        vouchers,
        agencySettings,
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Compute live dashboard metrics
  const metrics = calculateDashboardMetrics(sales, purchases, expenses, inventory);

  // Auth Actions
  const handleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);

        if (res.user.email) {
          const userEmail = res.user.email.toLowerCase().trim();
          setAgencySettings((prev) => {
            const updated = {
              ...prev,
              ownerEmail: prev.ownerEmail || userEmail,
            };
            delete (updated as any).previewRole;
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY_AGENCY, JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
        }

        setToastMessage({
          type: 'success',
          text: `تم تسجيل الدخول بنجاح كـ ${res.user.displayName || res.user.email}`,
        });
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setToastMessage({
        type: 'error',
        text: err?.message || 'تعذر تسجيل الدخول بواسطة Google',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setToastMessage({
        type: 'info',
        text: 'تم تسجيل الخروج بنجاح',
      });
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  // Helper to ensure valid Google Sheets OAuth access token
  const ensureValidGoogleToken = async (): Promise<string> => {
    let token = accessToken || (await getAccessToken());
    if (!token) {
      try {
        const authRes = await googleSignIn();
        if (authRes?.accessToken) {
          token = authRes.accessToken;
          setAccessToken(token);
          setUser(authRes.user);
        }
      } catch (err: any) {
        console.warn('Google sign-in cancelled or failed:', err);
        throw new Error('يرجى تأكيد إذن الوصول لحساب Google في النافذة المنبثقة لإتمام المزامنة');
      }
    }
    if (!token) {
      throw new Error('لم يتم الحصول على إذن Google Sheets، يرجى المحاولة مجدداً');
    }
    return token;
  };

  // Google Sheets Management
  const handleCreateNewSheet = async (title: string) => {
    setIsProcessingSheets(true);
    try {
      let token = await ensureValidGoogleToken();
      let result;
      try {
        result = await createCompleteSpreadsheet(token, title);
        await syncAllDataToGoogleSheet(
          token,
          result.spreadsheetId,
          sales,
          purchases,
          expenses,
          inventory
        );
      } catch (sheetErr: any) {
        if (
          sheetErr?.message === 'EXPIRED_GOOGLE_TOKEN' ||
          sheetErr?.message?.includes('401') ||
          sheetErr?.message?.includes('UNAUTHENTICATED') ||
          sheetErr?.message?.includes('Invalid Credentials')
        ) {
          const authRes = await googleSignIn();
          if (!authRes?.accessToken) {
            throw new Error('انتهت صلاحية رمز Google، يرجى إعادة تسجيل الدخول ومنح الإذن');
          }
          token = authRes.accessToken;
          setAccessToken(token);
          setUser(authRes.user);
          result = await createCompleteSpreadsheet(token, title);
          await syncAllDataToGoogleSheet(
            token,
            result.spreadsheetId,
            sales,
            purchases,
            expenses,
            inventory
          );
        } else {
          throw sheetErr;
        }
      }

      setSpreadsheetId(result.spreadsheetId);
      setSpreadsheetUrl(result.spreadsheetUrl);
      localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_ID, result.spreadsheetId);

      setToastMessage({
        type: 'success',
        text: 'تم إنشاء جدول Google Sheets بجميع الأوراق الخمس بنجاح!',
      });
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'فشل إنشاء جدول البيانات',
      });
      throw err;
    } finally {
      setIsProcessingSheets(false);
    }
  };

  const handleLinkExistingSheet = async (idOrUrl: string) => {
    // Extract ID if full URL is pasted
    let cleanId = idOrUrl.trim();
    const urlMatch = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      cleanId = urlMatch[1];
    }

    setIsProcessingSheets(true);
    try {
      let token = await ensureValidGoogleToken();
      try {
        await getSpreadsheetDetails(token, cleanId);
        await syncAllDataToGoogleSheet(token, cleanId, sales, purchases, expenses, inventory);
      } catch (sheetErr: any) {
        if (
          sheetErr?.message === 'EXPIRED_GOOGLE_TOKEN' ||
          sheetErr?.message?.includes('401') ||
          sheetErr?.message?.includes('UNAUTHENTICATED') ||
          sheetErr?.message?.includes('Invalid Credentials')
        ) {
          const authRes = await googleSignIn();
          if (!authRes?.accessToken) {
            throw new Error('انتهت صلاحية رمز Google، يرجى إعادة تسجيل الدخول ومنح الإذن');
          }
          token = authRes.accessToken;
          setAccessToken(token);
          setUser(authRes.user);
          await getSpreadsheetDetails(token, cleanId);
          await syncAllDataToGoogleSheet(token, cleanId, sales, purchases, expenses, inventory);
        } else {
          throw sheetErr;
        }
      }

      setSpreadsheetId(cleanId);
      const url = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
      setSpreadsheetUrl(url);
      localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_ID, cleanId);

      setToastMessage({
        type: 'success',
        text: 'تم ربط جدول البيانات ومزامنته بنجاح!',
      });
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'تعذر ربط جدول البيانات، تأكد من صحة الرابط أو الصلاحيات',
      });
      throw err;
    } finally {
      setIsProcessingSheets(false);
    }
  };

  const handleSyncNow = async () => {
    if (!spreadsheetId) {
      setIsSheetsModalOpen(true);
      return;
    }

    setIsProcessingSheets(true);
    try {
      let token = await ensureValidGoogleToken();

      try {
        await syncAllDataToGoogleSheet(
          token,
          spreadsheetId,
          sales,
          purchases,
          expenses,
          inventory
        );
      } catch (syncErr: any) {
        // If expired or unauthorized, re-authenticate seamlessly and retry once
        if (
          syncErr?.message === 'EXPIRED_GOOGLE_TOKEN' ||
          syncErr?.message?.includes('401') ||
          syncErr?.message?.includes('UNAUTHENTICATED') ||
          syncErr?.message?.includes('Invalid Credentials')
        ) {
          const authRes = await googleSignIn();
          if (!authRes?.accessToken) {
            throw new Error('انتهت صلاحية رمز Google، يرجى إعادة تسجيل الدخول وتأكيد الإذن');
          }
          token = authRes.accessToken;
          setAccessToken(token);
          setUser(authRes.user);
          await syncAllDataToGoogleSheet(
            token,
            spreadsheetId,
            sales,
            purchases,
            expenses,
            inventory
          );
        } else {
          throw syncErr;
        }
      }

      setToastMessage({
        type: 'success',
        text: 'تمت مزامنة كافة الفواتير والخامات مع Google Sheets!',
      });
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'تعذر إتمام المزامنة مع Google Sheets',
      });
      throw err;
    } finally {
      setIsProcessingSheets(false);
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcelFile(sales, purchases, expenses, inventory);
      setToastMessage({
        type: 'success',
        text: 'تم إنشاء وتحميل ملف Excel (.xlsx) بكافة الأوراق والمعادلات بنجاح!',
      });
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: 'تعذر تحميل ملف الإكسل: ' + (err?.message || 'خطأ غير متوقع'),
      });
    }
  };

  const handleForceCloudSync = async () => {
    if (!user) {
      setToastMessage({
        type: 'info',
        text: 'يلزم تسجيل الدخول بحساب Google أولاً لتفعيل المزامنة السحابية الفورية.',
      });
      return;
    }

    setCloudSyncStatus('syncing');
    try {
      await resetCloudNetwork();
      await uploadAllDataToCloud(sales, purchases, expenses, inventory, quotations, agencySettings);
      setCloudSyncStatus('synced');
      setToastMessage({
        type: 'success',
        text: 'تمت مزامنة كافة الفواتير والمخزون والعروض سحابياً عبر Firebase بنجاح!',
      });
    } catch (err: any) {
      console.error('Manual cloud sync error:', err);
      setCloudSyncStatus('offline');
      if (
        err?.code === 'resource-exhausted' ||
        err?.message?.includes('Quota exceeded') ||
        err?.message?.includes('resource-exhausted') ||
        err?.message?.includes('الحصة اليومية')
      ) {
        setToastMessage({
          type: 'info',
          text: 'بياناتك محفوظة محلياً بنجاح في المتصفح. المزامنة السحابية اليومية مع Firebase وصلت للحد المجاني الأقصى، وستستأنف تلقائياً بعد تجديد الحصة اليومية من Google.',
        });
      } else {
        setToastMessage({
          type: 'error',
          text: 'تعذر إتمام المزامنة السحابية: ' + (err?.message || 'يرجى المحاولة لاحقاً'),
        });
      }
    }
  };

  const handleOpenAgencySettings = () => {
    if (!canAccessSettings(userRole)) {
      setToastMessage({
        type: 'error',
        text: 'عذراً، الوصول لبيانات وإعدادات الوكالة وإدارة الفريق مخصص حصرياً للمالك والمدير العام.',
      });
      return;
    }
    setIsAgencyModalOpen(true);
  };

  // Quotations Handlers
  const handleAddQuotation = (item: QuotationItem) => {
    const quoteWithAudit: QuotationItem = {
      ...item,
      audit: {
        createdByName: item.audit?.createdByName || currentActorName,
        createdByEmail: item.audit?.createdByEmail || currentActorEmail,
        createdAt: item.audit?.createdAt || new Date().toISOString(),
        updatedByName: currentActorName,
        updatedByEmail: currentActorEmail,
        updatedAt: new Date().toISOString(),
      },
    };
    setQuotations((prev) => [quoteWithAudit, ...prev]);
    cloudSaveQuotation(quoteWithAudit).catch((err) => console.warn('Cloud save quote:', err));
    logAuditEvent({
      action: 'CREATE',
      entityType: 'QUOTATION',
      entityId: quoteWithAudit.id,
      entityNumber: quoteWithAudit.quotationNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `إصدار عرض سعر جديد للعميل ${quoteWithAudit.customerName || 'بدون اسم'} بقيمة صافية ${quoteWithAudit.netTotal} ر.س`,
    });
    setToastMessage({
      type: 'success',
      text: `تم حفظ عرض السعر (${quoteWithAudit.quotationNo}) ومزامنته سحابياً بنجاح`,
    });
  };

  const handleUpdateQuotation = (item: QuotationItem) => {
    const quoteWithAudit: QuotationItem = {
      ...item,
      audit: {
        ...item.audit,
        updatedByName: currentActorName,
        updatedByEmail: currentActorEmail,
        updatedAt: new Date().toISOString(),
      },
    };
    setQuotations((prev) => prev.map((q) => (q.id === quoteWithAudit.id ? quoteWithAudit : q)));
    cloudSaveQuotation(quoteWithAudit).catch((err) => console.warn('Cloud update quote:', err));
    logAuditEvent({
      action: 'UPDATE',
      entityType: 'QUOTATION',
      entityId: quoteWithAudit.id,
      entityNumber: quoteWithAudit.quotationNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تحديث بيانات عرض السعر للعميل ${quoteWithAudit.customerName} - الحالة: ${quoteWithAudit.status}`,
    });
    setToastMessage({
      type: 'success',
      text: `تم تعديل عرض السعر (${quoteWithAudit.quotationNo}) ومزامنته سحابياً بنجاح`,
    });
  };

  const handleDeleteQuotation = (id: string) => {
    const target = quotations.find((q) => q.id === id);
    setQuotations((prev) => prev.filter((q) => q.id !== id));
    cloudDeleteQuotation(id).catch((err) => console.warn('Cloud delete quote:', err));
    logAuditEvent({
      action: 'DELETE',
      entityType: 'QUOTATION',
      entityId: id,
      entityNumber: target?.quotationNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف عرض السعر رقم ${target?.quotationNo || id}`,
    });
    setToastMessage({
      type: 'info',
      text: 'تم حذف عرض السعر سحابياً ومحلياً',
    });
  };

  const handleConvertQuotationToSale = (quote: QuotationItem) => {
    const newSale = convertQuotationToSale(quote, sales.length);
    const saleWithAudit: SaleItem = {
      ...newSale,
      audit: {
        createdByName: currentActorName,
        createdByEmail: currentActorEmail,
        createdAt: new Date().toISOString(),
        updatedByName: currentActorName,
        updatedByEmail: currentActorEmail,
        updatedAt: new Date().toISOString(),
      },
    };
    const updatedQuote: QuotationItem = {
      ...quote,
      status: 'معتمد ومحول لطلب',
      convertedSaleId: saleWithAudit.id,
      convertedDate: new Date().toISOString().split('T')[0],
      audit: {
        ...quote.audit,
        updatedByName: currentActorName,
        updatedByEmail: currentActorEmail,
        updatedAt: new Date().toISOString(),
      },
    };

    // Mark quotation as approved & converted
    setQuotations((prev) =>
      prev.map((q) => (q.id === quote.id ? updatedQuote : q))
    );
    // Add new sale order to sales list
    setSales((prev) => [saleWithAudit, ...prev]);
    cloudSaveQuotation(updatedQuote).catch((err) => console.warn('Cloud save quote:', err));
    cloudSaveSale(saleWithAudit).catch((err) => console.warn('Cloud save sale:', err));

    logAuditEvent({
      action: 'CONVERT_TO_SALE',
      entityType: 'QUOTATION',
      entityId: quote.id,
      entityNumber: quote.quotationNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `اعتماد عرض السعر وتحويله إلى أمر مبيعات وتنفيذ برقم ${saleWithAudit.invoiceNo}`,
    });

    // Close quotation modal if open
    setPrintQuotation(null);
    // Switch to sales tab so user sees the newly created order
    setActiveTab('sales');
    setToastMessage({
      type: 'success',
      text: `تم اعتماد عرض السعر (${quote.quotationNo}) بنجاح وإصدار أمر مبيعات للتنفيذ برقم (${saleWithAudit.invoiceNo}) ومزامنتهما!`,
    });
  };

  // Sales Handlers
  const handleAddSale = (item: SaleItem) => {
    const saleWithAudit: SaleItem = {
      ...item,
      audit: {
        createdByName: item.audit?.createdByName || currentActorName,
        createdByEmail: item.audit?.createdByEmail || currentActorEmail,
        createdAt: item.audit?.createdAt || new Date().toISOString(),
        updatedByName: currentActorName,
        updatedByEmail: currentActorEmail,
        updatedAt: new Date().toISOString(),
      },
    };
    setSales((prev) => [saleWithAudit, ...prev]);
    cloudSaveSale(saleWithAudit).catch((err) => console.warn('Cloud save sale:', err));
    logAuditEvent({
      action: 'CREATE',
      entityType: 'INVOICE',
      entityId: saleWithAudit.id,
      entityNumber: saleWithAudit.invoiceNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `إصدار فاتورة جديدة للعميل ${saleWithAudit.customerName || 'بدون اسم'} بقيمة صافية ${saleWithAudit.netTotal} ر.س [القناة: ${saleWithAudit.revenueSource || 'المحل المباشر'}]`,
    });
    setToastMessage({
      type: 'success',
      text: `تم إصدار الفاتورة (${saleWithAudit.invoiceNo}) ومزامنتها سحابياً بنجاح`,
    });
  };

  const handleUpdateSale = (item: SaleItem) => {
    const saleWithAudit: SaleItem = {
      ...item,
      audit: {
        ...item.audit,
        updatedByName: currentActorName,
        updatedByEmail: currentActorEmail,
        updatedAt: new Date().toISOString(),
      },
    };
    setSales((prev) => prev.map((s) => (s.id === saleWithAudit.id ? saleWithAudit : s)));
    cloudSaveSale(saleWithAudit).catch((err) => console.warn('Cloud update sale:', err));
    logAuditEvent({
      action: 'UPDATE',
      entityType: 'INVOICE',
      entityId: saleWithAudit.id,
      entityNumber: saleWithAudit.invoiceNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تحديث بيانات الفاتورة للعميل ${saleWithAudit.customerName} - الحالة: ${saleWithAudit.orderStatus} [القناة: ${saleWithAudit.revenueSource || 'المحل المباشر'}]`,
    });
    setToastMessage({
      type: 'success',
      text: `تم تعديل الفاتورة (${saleWithAudit.invoiceNo}) وتحديثها سحابياً بنجاح`,
    });
  };

  const handleDeleteSale = (id: string) => {
    const target = sales.find((s) => s.id === id);
    setSales((prev) => prev.filter((s) => s.id !== id));
    cloudDeleteSale(id).catch((err) => console.warn('Cloud delete sale:', err));
    logAuditEvent({
      action: 'DELETE',
      entityType: 'INVOICE',
      entityId: id,
      entityNumber: target?.invoiceNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف الفاتورة رقم ${target?.invoiceNo || id}`,
    });
    setToastMessage({
      type: 'info',
      text: 'تم حذف الفاتورة وإعادة احتساب المؤشرات المالية',
    });
  };

  // Purchases Handlers
  const handleAddPurchase = (item: PurchaseItem) => {
    setPurchases((prev) => [item, ...prev]);
    cloudSavePurchase(item).catch((err) => console.warn('Cloud save purchase:', err));
    setToastMessage({
      type: 'success',
      text: 'تم تسجيل فاتورة المشتريات ومزامنتها سحابياً بنجاح',
    });
  };

  const handleUpdatePurchase = (item: PurchaseItem) => {
    setPurchases((prev) => prev.map((p) => (p.id === item.id ? item : p)));
    cloudSavePurchase(item).catch((err) => console.warn('Cloud update purchase:', err));
    setToastMessage({
      type: 'success',
      text: 'تم تعديل فاتورة المشتريات سحابياً بنجاح',
    });
  };

  const handleDeletePurchase = (id: string) => {
    const target = purchases.find((p) => p.id === id);
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    cloudDeletePurchase(id).catch((err) => console.warn('Cloud delete purchase:', err));
    logAuditEvent({
      action: 'DELETE',
      entityType: 'PURCHASE',
      entityId: id,
      entityNumber: target?.supplierInvoiceNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف فاتورة شراء برقم ${target?.supplierInvoiceNo || id} للمورد [${target?.supplier || 'غير محدد'}] بقيمة ${target?.total || 0} ر.س`,
    });
    setToastMessage({
      type: 'info',
      text: 'تم حذف فاتورة الشراء وتحديث الحسابات',
    });
  };

  // Expenses Handlers
  const handleAddExpense = (item: ExpenseItem) => {
    setExpenses((prev) => [item, ...prev]);
    cloudSaveExpense(item).catch((err) => console.warn('Cloud save expense:', err));
    logAuditEvent({
      action: 'CREATE',
      entityType: 'EXPENSE',
      entityId: item.id,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تسجيل مصروف جديد [${item.expenseType}] بقيمة ${item.amount} ر.س [${item.paymentMethod}]`,
    });
    setToastMessage({
      type: 'success',
      text: 'تم تسجيل سند الصرف ومزامنته سحابياً بنجاح',
    });
  };

  const handleUpdateExpense = (item: ExpenseItem) => {
    setExpenses((prev) => prev.map((e) => (e.id === item.id ? item : e)));
    cloudSaveExpense(item).catch((err) => console.warn('Cloud update expense:', err));
    logAuditEvent({
      action: 'UPDATE',
      entityType: 'EXPENSE',
      entityId: item.id,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تحديث مصروف [${item.expenseType}] بقيمة ${item.amount} ر.س`,
    });
    setToastMessage({
      type: 'success',
      text: 'تم تعديل سند الصرف سحابياً بنجاح',
    });
  };

  const handleDeleteExpense = (id: string) => {
    const target = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    cloudDeleteExpense(id).catch((err) => console.warn('Cloud delete expense:', err));
    logAuditEvent({
      action: 'DELETE',
      entityType: 'EXPENSE',
      entityId: id,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف مصروف [${target?.expenseType || 'مصروف'}] بقيمة ${target?.amount || 0} ر.س`,
    });
    setToastMessage({
      type: 'info',
      text: 'تم حذف سند المصروف بنجاح',
    });
  };

  // Inventory Handlers
  const handleAddInventory = (item: InventoryItem) => {
    setInventory((prev) => [item, ...prev]);
    cloudSaveInventory(item).catch((err) => console.warn('Cloud save inventory:', err));
    logAuditEvent({
      action: 'CREATE',
      entityType: 'INVENTORY',
      entityId: item.id,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `إضافة صنف جديد للمخزون [${item.item}] بكمية ${item.currentQty} ${item.unit}`,
    });
    setToastMessage({
      type: 'success',
      text: `تمت إضافة الصنف (${item.item}) إلى المخزون ومزامنته`,
    });
  };

  const handleUpdateInventory = (item: InventoryItem) => {
    setInventory((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    cloudSaveInventory(item).catch((err) => console.warn('Cloud update inventory:', err));
    setToastMessage({
      type: 'success',
      text: `تم تحديث بيانات الصنف (${item.item}) سحابياً`,
    });
  };

  const handleDeleteInventory = (id: string) => {
    const target = inventory.find((i) => i.id === id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
    cloudDeleteInventory(id).catch((err) => console.warn('Cloud delete inventory:', err));
    logAuditEvent({
      action: 'DELETE',
      entityType: 'INVENTORY',
      entityId: id,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف صنف من المخزون [${target?.item || id}]`,
    });
    setToastMessage({
      type: 'info',
      text: 'تم حذف الصنف من المخزون',
    });
  };

  // Vouchers Handlers (سندات القبض والصرف)
  const handleAddVoucher = (voucher: VoucherItem) => {
    const voucherWithAudit: VoucherItem = {
      ...voucher,
      audit: {
        createdByName: voucher.audit?.createdByName || currentActorName,
        createdByEmail: voucher.audit?.createdByEmail || currentActorEmail,
        createdAt: voucher.audit?.createdAt || new Date().toISOString(),
        updatedByName: currentActorName,
        updatedByEmail: currentActorEmail,
        updatedAt: new Date().toISOString(),
      },
    };
    setVouchers((prev) => [voucherWithAudit, ...prev]);
    cloudSaveVoucher(voucherWithAudit).catch((err) => console.warn('Cloud save voucher:', err));
    logAuditEvent({
      action: 'CREATE',
      entityType: 'VOUCHER',
      entityId: voucherWithAudit.id,
      entityNumber: voucherWithAudit.voucherNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `إصدار ${voucherWithAudit.type === 'receipt' ? 'سند قبض' : 'سند صرف'} برقم ${voucherWithAudit.voucherNo} بقيمة ${voucherWithAudit.amount} ر.س للطرف [${voucherWithAudit.partyName}]`,
    });
    setToastMessage({
      type: 'success',
      text: `تم حفظ ${voucherWithAudit.type === 'receipt' ? 'سند القبض' : 'سند الصرف'} (${voucherWithAudit.voucherNo}) ومزامنته سحابياً بنجاح`,
    });
  };

  const handleUpdateVoucher = (voucher: VoucherItem) => {
    const voucherWithAudit: VoucherItem = {
      ...voucher,
      audit: {
        ...voucher.audit,
        updatedByName: currentActorName,
        updatedByEmail: currentActorEmail,
        updatedAt: new Date().toISOString(),
      },
    };
    setVouchers((prev) => prev.map((v) => (v.id === voucherWithAudit.id ? voucherWithAudit : v)));
    cloudSaveVoucher(voucherWithAudit).catch((err) => console.warn('Cloud update voucher:', err));
    logAuditEvent({
      action: 'UPDATE',
      entityType: 'VOUCHER',
      entityId: voucherWithAudit.id,
      entityNumber: voucherWithAudit.voucherNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تعديل ${voucherWithAudit.type === 'receipt' ? 'سند القبض' : 'سند الصرف'} برقم ${voucherWithAudit.voucherNo} للطرف [${voucherWithAudit.partyName}]`,
    });
    setToastMessage({
      type: 'success',
      text: `تم تعديل السند (${voucherWithAudit.voucherNo}) بنجاح`,
    });
  };

  const handleDeleteVoucher = (id: string) => {
    const target = vouchers.find((v) => v.id === id);
    setVouchers((prev) => prev.filter((v) => v.id !== id));
    cloudDeleteVoucher(id).catch((err) => console.warn('Cloud delete voucher:', err));
    logAuditEvent({
      action: 'DELETE',
      entityType: 'VOUCHER',
      entityId: id,
      entityNumber: target?.voucherNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف ${target?.type === 'receipt' ? 'سند القبض' : 'سند الصرف'} برقم ${target?.voucherNo || id} بقيمة ${target?.amount || 0} ر.س للطرف [${target?.partyName || 'غير محدد'}]`,
    });
    setToastMessage({
      type: 'info',
      text: `تم حذف السند (${target?.voucherNo || id}) بنجاح`,
    });
  };

  // Agency Settings Handler
  const handleUpdateAgencySettings = (newSettings: AgencySettings) => {
    const cleanSettings = { ...newSettings };
    delete (cleanSettings as any).previewRole;
    setAgencySettings(cleanSettings);
    updateDynamicBranding(cleanSettings);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_AGENCY, JSON.stringify(cleanSettings));
    } catch (e) {
      console.error(e);
    }
    if (user) {
      cloudSaveAgencySettings(cleanSettings).catch((err) => console.warn('Cloud save settings:', err));
    }
    setToastMessage({
      type: 'success',
      text: 'تم حفظ وتحديث هوية وشعار الوكالة بنجاح',
    });
  };

  return (
    <AuthGate
      user={user}
      isAuthLoading={isAuthLoading}
      agencySettings={agencySettings}
      onLogin={handleLogin}
      onLogout={handleLogout}
    >
      <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col antialiased">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-5 left-5 z-50 animate-bounce">
            <div
              className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                  : toastMessage.type === 'error'
                  ? 'bg-rose-900 text-rose-100 border-rose-700'
                  : 'bg-slate-900 text-slate-100 border-slate-700'
              }`}
            >
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

      {/* Header */}
      <Header
        user={user}
        userRole={userRole}
        needsAuth={!user}
        isLoggingIn={false}
        onLogin={handleLogin}
        onLogout={handleLogout}
        spreadsheetId={spreadsheetId}
        spreadsheetUrl={spreadsheetUrl}
        isSyncing={isProcessingSheets}
        onSync={handleSyncNow}
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
        onOpenFormulasModal={() => setIsFormulasModalOpen(true)}
        onExportExcel={handleExportExcel}
        activeTab={activeTab}
        setActiveTab={(tab: string) => setActiveTab(tab as NavigationTab)}
        agencySettings={agencySettings}
        onOpenAgencySettings={handleOpenAgencySettings}
        onUpdateAgencySettings={handleUpdateAgencySettings}
        cloudSyncStatus={cloudSyncStatus}
        onForceCloudSync={handleForceCloudSync}
        onOpenCloudSyncModal={() => setIsCloudSyncModalOpen(true)}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        previewRole={previewRole}
        onSwitchPreviewRole={handleSwitchPreviewRole}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-16">
        {activeTab === 'dashboard' && allowedTabs.includes('dashboard') && (
          <DashboardView
            metrics={metrics}
            sales={sales}
            purchases={purchases}
            expenses={expenses}
            inventory={inventory}
            vouchers={vouchers}
            userRole={userRole}
            currentLang={currentLang}
            user={user}
            agencySettings={agencySettings}
            onOpenNewSale={() => {
              setActiveTab('sales');
              setIsSalesModalOpen(true);
            }}
            onOpenNewPurchase={() => {
              setActiveTab('purchases');
              setIsPurchasesModalOpen(true);
            }}
            onOpenNewExpense={() => {
              setActiveTab('expenses');
              setIsExpensesModalOpen(true);
            }}
            onOpenNewInventory={() => {
              setActiveTab('inventory');
              setIsInventoryModalOpen(true);
            }}
            onExportExcel={handleExportExcel}
            setActiveTab={(tab) => setActiveTab(tab as NavigationTab)}
            spreadsheetUrl={spreadsheetUrl}
            onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
            onOpenAgencySettings={() => setIsAgencyModalOpen(true)}
          />
        )}

        {activeTab === 'quotations' && allowedTabs.includes('quotations') && (
          <QuotationsView
            quotations={quotations}
            agencySettings={agencySettings}
            userRole={userRole}
            currentLang={currentLang}
            onAddQuotation={handleAddQuotation}
            onUpdateQuotation={handleUpdateQuotation}
            onDeleteQuotation={handleDeleteQuotation}
            onPrintQuotation={(quote) => setPrintQuotation(quote)}
            onConvertQuotationToSale={handleConvertQuotationToSale}
          />
        )}

        {activeTab === 'sales' && allowedTabs.includes('sales') && (
          <SalesView
            sales={sales}
            agencySettings={agencySettings}
            userRole={userRole}
            currentLang={currentLang}
            onAddSale={handleAddSale}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
            onPrintInvoice={(sale) => setPrintSale(sale)}
            onIssueReceiptVoucher={(sale) => {
              setSaleForReceiptVoucher(sale);
              setActiveTab('vouchers');
            }}
            isModalOpen={isSalesModalOpen}
            setIsModalOpen={setIsSalesModalOpen}
          />
        )}

        {activeTab === 'vouchers' && allowedTabs.includes('vouchers') && (
          <VouchersView
            vouchers={vouchers}
            agencySettings={agencySettings}
            userRole={userRole}
            currentLang={currentLang}
            currentUserName={currentActorName}
            currentUserEmail={currentActorEmail}
            sales={sales}
            onUpdateSale={handleUpdateSale}
            onAddVoucher={handleAddVoucher}
            onUpdateVoucher={handleUpdateVoucher}
            onDeleteVoucher={handleDeleteVoucher}
            onUpdateAgencySettings={handleUpdateAgencySettings}
            initialSelectedSale={saleForReceiptVoucher}
            onClearInitialSelectedSale={() => setSaleForReceiptVoucher(null)}
          />
        )}

        {activeTab === 'purchases' && allowedTabs.includes('purchases') && (
          <PurchasesView
            purchases={purchases}
            userRole={userRole}
            currentLang={currentLang}
            onAddPurchase={handleAddPurchase}
            onUpdatePurchase={handleUpdatePurchase}
            onDeletePurchase={handleDeletePurchase}
            isModalOpen={isPurchasesModalOpen}
            setIsModalOpen={setIsPurchasesModalOpen}
          />
        )}

        {activeTab === 'expenses' && allowedTabs.includes('expenses') && (
          <ExpensesView
            expenses={expenses}
            userRole={userRole}
            currentLang={currentLang}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            isModalOpen={isExpensesModalOpen}
            setIsModalOpen={setIsExpensesModalOpen}
          />
        )}

        {activeTab === 'inventory' && allowedTabs.includes('inventory') && (
          <InventoryView
            inventory={inventory}
            userRole={userRole}
            currentLang={currentLang}
            onAddInventory={handleAddInventory}
            onUpdateInventory={handleUpdateInventory}
            onDeleteInventory={handleDeleteInventory}
            isModalOpen={isInventoryModalOpen}
            setIsModalOpen={setIsInventoryModalOpen}
          />
        )}

        {activeTab === 'pricing' && allowedTabs.includes('pricing') && (
          <PricingCalculatorView
            agencySettings={agencySettings}
            userRole={userRole}
            currentLang={currentLang}
            onUpdateAgencySettings={handleUpdateAgencySettings}
            onNavigateToQuotation={() => setActiveTab('quotations')}
            onNavigateToSale={() => {
              setActiveTab('sales');
              setIsSalesModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Google Sheets Integration Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        spreadsheetId={spreadsheetId}
        spreadsheetUrl={spreadsheetUrl}
        isLoggedIn={Boolean(user)}
        userEmail={user?.email}
        hasGoogleToken={Boolean(accessToken)}
        onLogin={handleLogin}
        onCreateNewSheet={handleCreateNewSheet}
        onLinkExistingSheet={handleLinkExistingSheet}
        onSyncNow={handleSyncNow}
        isProcessing={isProcessingSheets}
      />

      {/* Formulas & Reference Modal */}
      <FormulasModal
        isOpen={isFormulasModalOpen}
        onClose={() => setIsFormulasModalOpen(false)}
      />

      {/* Printable Invoice Modal */}
      <InvoicePrintModal
        sale={printSale}
        onClose={() => setPrintSale(null)}
        agencySettings={agencySettings}
        onUpdateAgencySettings={handleUpdateAgencySettings}
      />

      {/* Printable Quotation Modal */}
      <QuotationPrintModal
        quotation={printQuotation}
        onClose={() => setPrintQuotation(null)}
        agencySettings={agencySettings}
        onUpdateAgencySettings={handleUpdateAgencySettings}
        onConvertQuotationToSale={handleConvertQuotationToSale}
      />

      {/* Agency, Profile & Collaborators Modal */}
      <AgencyProfileModal
        isOpen={isAgencyModalOpen}
        onClose={() => setIsAgencyModalOpen(false)}
        agencySettings={agencySettings}
        onUpdateAgencySettings={handleUpdateAgencySettings}
        user={user}
        userRole={userRole}
        onLogin={handleLogin}
        onLogout={handleLogout}
        spreadsheetUrl={spreadsheetUrl}
      />

      {/* Cloud Sync & Multi-Device Manager Modal */}
      <CloudSyncModal
        isOpen={isCloudSyncModalOpen}
        onClose={() => setIsCloudSyncModalOpen(false)}
        user={user}
        cloudSyncStatus={cloudSyncStatus}
        sales={sales}
        purchases={purchases}
        expenses={expenses}
        inventory={inventory}
        quotations={quotations}
        agencySettings={agencySettings}
        onUpdateSales={(newSales) => setSales(newSales)}
        onUpdatePurchases={(newPurchases) => setPurchases(newPurchases)}
        onUpdateExpenses={(newExpenses) => setExpenses(newExpenses)}
        onUpdateInventory={(newInventory) => setInventory(newInventory)}
        onUpdateQuotations={(newQuotations) => setQuotations(newQuotations)}
        onUpdateAgencySettings={handleUpdateAgencySettings}
        onShowToast={setToastMessage}
      />

      {/* Audit Trail & History Modal */}
      <AuditTimelineModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        viewMode="all"
      />
    </div>
  </AuthGate>
);
}
