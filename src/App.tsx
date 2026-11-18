import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  SaleItem,
  PurchaseItem,
  ExpenseItem,
  InventoryItem,
  QuotationItem,
  VoucherItem,
  ReturnRecord,
  InventoryMovement,
  EmployeeItem,
  AttendanceRecord,
  PayrollRun,
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
  INITIAL_EMPLOYEES,
  INITIAL_ATTENDANCE,
  INITIAL_PAYROLLS,
  INITIAL_RETURNS,
  INITIAL_MOVEMENTS,
  calculateDashboardMetrics,
  DEFAULT_AGENCY_SETTINGS,
  LOCAL_STORAGE_KEY_QUOTATIONS,
  LOCAL_STORAGE_KEY_VOUCHERS,
  LOCAL_STORAGE_KEY_RETURNS,
  LOCAL_STORAGE_KEY_MOVEMENTS,
  LOCAL_STORAGE_KEY_EMPLOYEES,
  LOCAL_STORAGE_KEY_ATTENDANCE,
  LOCAL_STORAGE_KEY_PAYROLLS,
  convertQuotationToSale,
  reconcileDocumentsWithVouchersAndReturns,
  computeInventoryStatus,
  getNextSequenceNumber,
  safeLoadArray,
  roundMoney,
} from './lib/dataStore';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
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
  cloudSaveReturn,
  cloudDeleteReturn,
  cloudSaveMovement,
  cloudSaveEmployee,
  cloudDeleteEmployee,
  cloudSaveAttendance,
  cloudSavePayroll,
  cloudDeletePayroll,
  cloudSaveAgencySettings,
  uploadAllDataToCloud,
  resetCloudNetwork,
  SyncStatus,
} from './lib/cloudSync';

import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { QuotationsView } from './components/QuotationsView';
import { SalesView } from './components/SalesView';
import { ReturnsView } from './components/ReturnsView';
import { PurchasesView } from './components/PurchasesView';
import { ExpensesView } from './components/ExpensesView';
import { InventoryView } from './components/InventoryView';
import { VouchersView } from './components/VouchersView';
import { HrPayrollView } from './components/HrPayrollView';
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
import { tafqeet } from './lib/tafqeet';
import { getUserRole, getAllowedTabs, canAccessSettings, isPrimaryOwner } from './lib/permissions';

const LOCAL_STORAGE_KEY_SALES = 'adv_accounting_sales';
const LOCAL_STORAGE_KEY_PURCHASES = 'adv_accounting_purchases';
const LOCAL_STORAGE_KEY_EXPENSES = 'adv_accounting_expenses';
const LOCAL_STORAGE_KEY_INVENTORY = 'adv_accounting_inventory';
const LOCAL_STORAGE_KEY_SHEET_ID = 'adv_accounting_sheet_id';
const LOCAL_STORAGE_KEY_AGENCY = 'adv_accounting_agency_settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [saleForReceiptVoucher, setSaleForReceiptVoucher] = useState<SaleItem | null>(null);

  // Core Validated Data States
  const [quotations, setQuotations] = useState<QuotationItem[]>(() =>
    safeLoadArray<QuotationItem>(LOCAL_STORAGE_KEY_QUOTATIONS, INITIAL_QUOTATIONS, (x) => Boolean(x.id))
  );

  const [sales, setSales] = useState<SaleItem[]>(() =>
    safeLoadArray<SaleItem>(LOCAL_STORAGE_KEY_SALES, INITIAL_SALES, (x) => Boolean(x.id))
  );

  const [purchases, setPurchases] = useState<PurchaseItem[]>(() =>
    safeLoadArray<PurchaseItem>(LOCAL_STORAGE_KEY_PURCHASES, INITIAL_PURCHASES, (x) => Boolean(x.id))
  );

  const [expenses, setExpenses] = useState<ExpenseItem[]>(() =>
    safeLoadArray<ExpenseItem>(LOCAL_STORAGE_KEY_EXPENSES, INITIAL_EXPENSES, (x) => Boolean(x.id))
  );

  const [inventory, setInventory] = useState<InventoryItem[]>(() =>
    safeLoadArray<InventoryItem>(LOCAL_STORAGE_KEY_INVENTORY, INITIAL_INVENTORY, (x) => Boolean(x.id))
  );

  const [vouchers, setVouchers] = useState<VoucherItem[]>(() =>
    safeLoadArray<VoucherItem>(LOCAL_STORAGE_KEY_VOUCHERS, INITIAL_VOUCHERS, (x) => Boolean(x.id))
  );

  const [returns, setReturns] = useState<ReturnRecord[]>(() =>
    safeLoadArray<ReturnRecord>(LOCAL_STORAGE_KEY_RETURNS, INITIAL_RETURNS, (x) => Boolean(x.id))
  );

  const [movements, setMovements] = useState<InventoryMovement[]>(() =>
    safeLoadArray<InventoryMovement>(LOCAL_STORAGE_KEY_MOVEMENTS, INITIAL_MOVEMENTS, (x) => Boolean(x.id))
  );

  const [employees, setEmployees] = useState<EmployeeItem[]>(() =>
    safeLoadArray<EmployeeItem>(LOCAL_STORAGE_KEY_EMPLOYEES, INITIAL_EMPLOYEES, (x) => Boolean(x.id))
  );

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() =>
    safeLoadArray<AttendanceRecord>(LOCAL_STORAGE_KEY_ATTENDANCE, INITIAL_ATTENDANCE, (x) => Boolean(x.id))
  );

  const [payrolls, setPayrolls] = useState<PayrollRun[]>(() =>
    safeLoadArray<PayrollRun>(LOCAL_STORAGE_KEY_PAYROLLS, INITIAL_PAYROLLS, (x) => Boolean(x.id))
  );

  // Agency Settings
  const [agencySettings, setAgencySettings] = useState<AgencySettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_AGENCY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          delete parsed.previewRole;
          return { ...DEFAULT_AGENCY_SETTINGS, ...parsed };
        }
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

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_QUOTATIONS, JSON.stringify(quotations));
    } catch {}
  }, [quotations]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SALES, JSON.stringify(sales));
    } catch {}
  }, [sales]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PURCHASES, JSON.stringify(purchases));
    } catch {}
  }, [purchases]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
    } catch {}
  }, [expenses]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_INVENTORY, JSON.stringify(inventory));
    } catch {}
  }, [inventory]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_VOUCHERS, JSON.stringify(vouchers));
    } catch {}
  }, [vouchers]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_RETURNS, JSON.stringify(returns));
    } catch {}
  }, [returns]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_MOVEMENTS, JSON.stringify(movements));
    } catch {}
  }, [movements]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EMPLOYEES, JSON.stringify(employees));
    } catch {}
  }, [employees]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCE, JSON.stringify(attendance));
    } catch {}
  }, [attendance]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PAYROLLS, JSON.stringify(payrolls));
    } catch {}
  }, [payrolls]);

  useEffect(() => {
    const unsub = subscribeToPublicAgencySettings((cloudSettings) => {
      if (cloudSettings && (cloudSettings.agencyName || cloudSettings.agencyLogoUrl)) {
        setAgencySettings((prev) => ({
          ...prev,
          ...cloudSettings,
        }));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_AGENCY, JSON.stringify(agencySettings));
      updateDynamicBranding(agencySettings);
    } catch {}
  }, [agencySettings]);

  // تسوية تلقائية مستمرة: عند أي تعديل في السندات أو المرتجعات تُعاد موازنة أرصدة الفواتير والمشتريات فوراً
  useEffect(() => {
    const { updatedSales, updatedPurchases } = reconcileDocumentsWithVouchersAndReturns(
      sales,
      purchases,
      vouchers,
      returns
    );
    const salesChanged = JSON.stringify(updatedSales) !== JSON.stringify(sales);
    const purchChanged = JSON.stringify(updatedPurchases) !== JSON.stringify(purchases);
    if (salesChanged) setSales(updatedSales);
    if (purchChanged) setPurchases(updatedPurchases);
  }, [vouchers, returns]);

  // Role preview state
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

  const realRole = getUserRole(user, agencySettings);
  const isOwner = isPrimaryOwner(user, agencySettings);
  const userRole = isOwner && previewRole ? previewRole : realRole;

  const currentLang = (agencySettings.userProfile?.language || agencySettings.appLanguage || 'ar') as 'ar' | 'en';

  useEffect(() => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'en' ? 'ltr' : 'rtl';
  }, [currentLang]);

  const allowedTabs = getAllowedTabs(userRole, previewRole ? null : user, agencySettings);

  useEffect(() => {
    const allowed = getAllowedTabs(userRole, previewRole ? null : user, agencySettings);
    if (!allowed.includes(activeTab)) {
      setActiveTab(allowed[0] || 'pricing');
    }
  }, [userRole, previewRole, activeTab, user, agencySettings]);

  const currentActorName = user?.displayName || agencySettings.userProfile?.name || 'مستخدم النظام';
  const currentActorEmail = user?.email || agencySettings.userProfile?.email || '';

  useEffect(() => {
    const unsubscribe = initAuth((authUser, token) => {
      setUser(authUser);
      if (token) setAccessToken(token);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setCloudSyncStatus('offline');
      return;
    }

    const unsubscribe = subscribeToAgencyData(
      {
        onSalesUpdate: (cloudSales) => {
          if (cloudSales) setSales(cloudSales);
        },
        onPurchasesUpdate: (cloudPurchases) => {
          if (cloudPurchases) setPurchases(cloudPurchases);
        },
        onExpensesUpdate: (cloudExpenses) => {
          if (cloudExpenses) setExpenses(cloudExpenses);
        },
        onInventoryUpdate: (cloudInventory) => {
          if (cloudInventory) setInventory(cloudInventory);
        },
        onQuotationsUpdate: (cloudQuotations) => {
          if (cloudQuotations) setQuotations(cloudQuotations);
        },
        onVouchersUpdate: (cloudVouchers) => {
          if (cloudVouchers) setVouchers(cloudVouchers);
        },
        onReturnsUpdate: (cloudReturns) => {
          if (cloudReturns) setReturns(cloudReturns);
        },
        onMovementsUpdate: (cloudMovements) => {
          if (cloudMovements) setMovements(cloudMovements);
        },
        onEmployeesUpdate: (cloudEmployees) => {
          if (cloudEmployees) setEmployees(cloudEmployees);
        },
        onAttendanceUpdate: (cloudAttendance) => {
          if (cloudAttendance) setAttendance(cloudAttendance);
        },
        onPayrollsUpdate: (cloudPayrolls) => {
          if (cloudPayrolls) setPayrolls(cloudPayrolls);
        },
        onAgencySettingsUpdate: (cloudSettings) => {
          if (cloudSettings && cloudSettings.agencyName) {
            const sanitized = { ...cloudSettings };
            delete (sanitized as any).previewRole;
            setAgencySettings(sanitized);
          }
        },
        onStatusChange: (status) => {
          setCloudSyncStatus(status);
        },
      },
      {
        sales,
        purchases,
        expenses,
        inventory,
        quotations,
        vouchers,
        returns,
        movements,
        employees,
        attendance,
        payrolls,
        agencySettings,
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Compute live dashboard metrics including returns and wastage
  const metrics = calculateDashboardMetrics(sales, purchases, expenses, inventory, returns, movements);

  // Helper to apply stock movements and update inventory balances automatically
  const applyInventoryAdjustments = (
    adjustments: {
      inventoryId?: string;
      itemName?: string;
      quantityDelta: number;
      type: InventoryMovement['type'];
      unitCost?: number;
      referenceDocNo?: string;
      referenceDocId?: string;
      reason: string;
    }[]
  ) => {
    if (adjustments.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];

    setInventory((prevInv) => {
      const nextInv = [...prevInv];
      const newMovs: InventoryMovement[] = [];
      const existingMovNos = movements.map((m) => m.movementNo);

      for (const adj of adjustments) {
        if (!adj.quantityDelta || adj.quantityDelta === 0) continue;

        const targetIndex = nextInv.findIndex(
          (inv) =>
            (adj.inventoryId && inv.id === adj.inventoryId) ||
            (adj.itemName &&
              (inv.item.trim() === adj.itemName.trim() ||
                adj.itemName.includes(inv.item.trim()) ||
                inv.item.includes(adj.itemName.trim())))
        );

        if (targetIndex === -1) continue;

        const target = nextInv[targetIndex];
        const prevQty = Number(target.currentQty) || 0;
        const newQty = Math.max(0, roundMoney(prevQty + adj.quantityDelta));
        const unitCost = adj.unitCost !== undefined && adj.unitCost > 0 ? adj.unitCost : target.unitCost || 0;
        const updatedItem: InventoryItem = {
          ...target,
          currentQty: newQty,
          unitCost,
          status: computeInventoryStatus(newQty, target.minQty),
        };
        nextInv[targetIndex] = updatedItem;
        cloudSaveInventory(updatedItem).catch(() => {});

        const movNo = getNextSequenceNumber('MOV', [
          ...existingMovNos,
          ...newMovs.map((m) => m.movementNo),
        ]);
        const mov: InventoryMovement = {
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          movementNo: movNo,
          date: todayStr,
          inventoryId: target.id,
          itemName: `${target.item} (${target.type} - ${target.color})`,
          unit: target.unit,
          type: adj.type,
          quantityChange: adj.quantityDelta,
          previousQty: prevQty,
          newQty,
          unitCost,
          totalCost: roundMoney(Math.abs(adj.quantityDelta) * unitCost),
          referenceDocNo: adj.referenceDocNo,
          referenceDocId: adj.referenceDocId,
          reason: adj.reason,
          performedBy: currentActorName,
        };
        newMovs.push(mov);
        cloudSaveMovement(mov).catch(() => {});
      }

      if (newMovs.length > 0) {
        setMovements((prevM) => [...newMovs, ...prevM]);
      }
      return nextInv;
    });
  };

  // Auth Actions
  const handleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        if (res.user.email) {
          const userEmail = res.user.email.toLowerCase().trim();
          setAgencySettings((prev) => ({
            ...prev,
            ownerEmail: prev.ownerEmail || userEmail,
          }));
        }
        setToastMessage({
          type: 'success',
          text: `تم تسجيل الدخول بنجاح كـ ${res.user.displayName || res.user.email}`,
        });
      }
    } catch (err: any) {
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
      setToastMessage({ type: 'info', text: 'تم تسجيل الخروج بنجاح' });
    } catch {}
  };

  const ensureValidGoogleToken = async (): Promise<string> => {
    let token = accessToken || (await getAccessToken());
    if (!token) {
      const authRes = await googleSignIn();
      if (authRes?.accessToken) {
        token = authRes.accessToken;
        setAccessToken(token);
        setUser(authRes.user);
      }
    }
    if (!token) {
      throw new Error('لم يتم الحصول على إذن Google Sheets، يرجى المحاولة مجدداً');
    }
    return token;
  };

  const handleCreateNewSheet = async (title: string) => {
    setIsProcessingSheets(true);
    try {
      const token = await ensureValidGoogleToken();
      const result = await createCompleteSpreadsheet(token, title);
      await syncAllDataToGoogleSheet(token, result.spreadsheetId, sales, purchases, expenses, inventory);
      setSpreadsheetId(result.spreadsheetId);
      setSpreadsheetUrl(result.spreadsheetUrl);
      localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_ID, result.spreadsheetId);
      setToastMessage({
        type: 'success',
        text: 'تم إنشاء جدول Google Sheets بجميع الأوراق بنجاح!',
      });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.message || 'فشل إنشاء جدول البيانات' });
      throw err;
    } finally {
      setIsProcessingSheets(false);
    }
  };

  const handleLinkExistingSheet = async (idOrUrl: string) => {
    let cleanId = idOrUrl.trim();
    const urlMatch = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) cleanId = urlMatch[1];

    setIsProcessingSheets(true);
    try {
      const token = await ensureValidGoogleToken();
      await getSpreadsheetDetails(token, cleanId);
      await syncAllDataToGoogleSheet(token, cleanId, sales, purchases, expenses, inventory);
      setSpreadsheetId(cleanId);
      setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${cleanId}/edit`);
      localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_ID, cleanId);
      setToastMessage({ type: 'success', text: 'تم ربط جدول البيانات ومزامنته بنجاح!' });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.message || 'تعذر ربط جدول البيانات' });
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
      const token = await ensureValidGoogleToken();
      await syncAllDataToGoogleSheet(token, spreadsheetId, sales, purchases, expenses, inventory);
      setToastMessage({
        type: 'success',
        text: 'تمت مزامنة كافة الفواتير والخامات مع Google Sheets!',
      });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.message || 'تعذر إتمام المزامنة مع Google Sheets' });
    } finally {
      setIsProcessingSheets(false);
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcelFile(sales, purchases, expenses, inventory, returns, employees, payrolls);
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
      await uploadAllDataToCloud(
        sales,
        purchases,
        expenses,
        inventory,
        quotations,
        agencySettings,
        vouchers,
        returns,
        movements,
        employees,
        attendance,
        payrolls
      );
      setCloudSyncStatus('synced');
      setToastMessage({
        type: 'success',
        text: 'تمت مزامنة كافة الفواتير والمرتجعات والمخزون والرواتب سحابياً بنجاح!',
      });
    } catch (err: any) {
      setCloudSyncStatus('offline');
      setToastMessage({
        type: 'error',
        text: 'تعذر إتمام المزامنة السحابية: ' + (err?.message || 'يرجى المحاولة لاحقاً'),
      });
    }
  };

  const handleOpenAgencySettings = () => {
    if (!canAccessSettings(userRole)) {
      setToastMessage({
        type: 'error',
        text: 'عذراً، الوصول لإعدادات الوكالة مخصص للمالك والمدير العام.',
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
    cloudSaveQuotation(quoteWithAudit).catch(() => {});
    logAuditEvent({
      action: 'CREATE',
      entityType: 'QUOTATION',
      entityId: quoteWithAudit.id,
      entityNumber: quoteWithAudit.quotationNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `إصدار عرض سعر جديد للعميل ${quoteWithAudit.customerName} بقيمة صافية ${quoteWithAudit.netTotal} ر.س`,
    });
    setToastMessage({
      type: 'success',
      text: `تم حفظ عرض السعر (${quoteWithAudit.quotationNo}) بنجاح`,
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
    cloudSaveQuotation(quoteWithAudit).catch(() => {});
    logAuditEvent({
      action: 'UPDATE',
      entityType: 'QUOTATION',
      entityId: quoteWithAudit.id,
      entityNumber: quoteWithAudit.quotationNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تحديث عرض السعر للعميل ${quoteWithAudit.customerName}`,
    });
    setToastMessage({
      type: 'success',
      text: `تم تعديل عرض السعر (${quoteWithAudit.quotationNo}) بنجاح`,
    });
  };

  const handleDeleteQuotation = (id: string) => {
    const target = quotations.find((q) => q.id === id);
    setQuotations((prev) => prev.filter((q) => q.id !== id));
    cloudDeleteQuotation(id).catch(() => {});
    logAuditEvent({
      action: 'DELETE',
      entityType: 'QUOTATION',
      entityId: id,
      entityNumber: target?.quotationNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف عرض السعر رقم ${target?.quotationNo || id}`,
    });
    setToastMessage({ type: 'info', text: 'تم حذف عرض السعر بنجاح' });
  };

  const handleConvertQuotationToSale = (quote: QuotationItem) => {
    const existingInvoiceNos = sales.map((s) => s.invoiceNo);
    const newSale = convertQuotationToSale(quote, sales.length, existingInvoiceNos);
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

    setQuotations((prev) => prev.map((q) => (q.id === quote.id ? updatedQuote : q)));
    setSales((prev) => [saleWithAudit, ...prev]);
    cloudSaveQuotation(updatedQuote).catch(() => {});
    cloudSaveSale(saleWithAudit).catch(() => {});

    logAuditEvent({
      action: 'CONVERT_TO_SALE',
      entityType: 'QUOTATION',
      entityId: quote.id,
      entityNumber: quote.quotationNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `اعتماد عرض السعر وتحويله إلى فاتورة مبيعات برقم ${saleWithAudit.invoiceNo} مع الحفاظ على الضريبة`,
    });

    setPrintQuotation(null);
    setActiveTab('sales');
    setToastMessage({
      type: 'success',
      text: `تم اعتماد عرض السعر (${quote.quotationNo}) وإصدار الفاتورة (${saleWithAudit.invoiceNo}) بنجاح!`,
    });
  };

  // Sales Handlers (مع خصم الخامات المرتبطة من المخزون تلقائياً)
  const handleAddSale = (item: SaleItem) => {
    const saleWithAudit: SaleItem = {
      ...item,
      initialPaidAmount: item.initialPaidAmount ?? item.paidAmount,
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
    cloudSaveSale(saleWithAudit).catch(() => {});

    // خصم الخامات المطابقة في المخزون تلقائياً عند إصدار فاتورة مبيعات غير ملغاة
    if (saleWithAudit.orderStatus !== 'ملغى') {
      const lines = saleWithAudit.items && saleWithAudit.items.length > 0 ? saleWithAudit.items : [];
      const adjs = lines.map((l) => ({
        inventoryId: l.inventoryItemId,
        itemName: l.serviceType,
        quantityDelta: -Math.abs(Number(l.quantity) || 0),
        type: 'sale_out' as const,
        referenceDocNo: saleWithAudit.invoiceNo,
        referenceDocId: saleWithAudit.id,
        reason: `صرف خامات لفاتورة مبيعات رقم ${saleWithAudit.invoiceNo} (${saleWithAudit.customerName})`,
      }));
      applyInventoryAdjustments(adjs);
    }

    logAuditEvent({
      action: 'CREATE',
      entityType: 'INVOICE',
      entityId: saleWithAudit.id,
      entityNumber: saleWithAudit.invoiceNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `إصدار فاتورة جديدة للعميل ${saleWithAudit.customerName} بقيمة صافية ${saleWithAudit.netTotal} ر.س`,
    });
    setToastMessage({
      type: 'success',
      text: `تم إصدار الفاتورة (${saleWithAudit.invoiceNo}) بنجاح`,
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
    cloudSaveSale(saleWithAudit).catch(() => {});
    logAuditEvent({
      action: 'UPDATE',
      entityType: 'INVOICE',
      entityId: saleWithAudit.id,
      entityNumber: saleWithAudit.invoiceNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تحديث بيانات الفاتورة للعميل ${saleWithAudit.customerName} - الحالة: ${saleWithAudit.orderStatus}`,
    });
    setToastMessage({
      type: 'success',
      text: `تم تعديل الفاتورة (${saleWithAudit.invoiceNo}) بنجاح`,
    });
  };

  const handleDeleteSale = (id: string) => {
    const target = sales.find((s) => s.id === id);
    setSales((prev) => prev.filter((s) => s.id !== id));
    cloudDeleteSale(id).catch(() => {});
    logAuditEvent({
      action: 'DELETE',
      entityType: 'INVOICE',
      entityId: id,
      entityNumber: target?.invoiceNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف الفاتورة رقم ${target?.invoiceNo || id}`,
    });
    setToastMessage({ type: 'info', text: 'تم حذف الفاتورة وإعادة احتساب المؤشرات المالية' });
  };

  // Purchases Handlers (مع توريد الكميات للمخزون تلقائياً)
  const handleAddPurchase = (item: PurchaseItem) => {
    const purchWithInit: PurchaseItem = {
      ...item,
      initialPaidAmount: item.initialPaidAmount ?? item.paidAmount,
    };
    setPurchases((prev) => [purchWithInit, ...prev]);
    cloudSavePurchase(purchWithInit).catch(() => {});

    // إضافة الكميات للمخزون تلقائياً للأصناف المطابقة
    if (purchWithInit.addToInventory !== false) {
      const lines = purchWithInit.items && purchWithInit.items.length > 0 ? purchWithInit.items : [];
      const adjs = lines.map((l) => ({
        inventoryId: l.inventoryItemId,
        itemName: l.item,
        quantityDelta: Math.abs(Number(l.quantity) || 0),
        unitCost: Number(l.purchasePrice) || undefined,
        type: 'purchase_in' as const,
        referenceDocNo: purchWithInit.supplierInvoiceNo || purchWithInit.id,
        referenceDocId: purchWithInit.id,
        reason: `توريد خامات من فاتورة شراء رقم ${purchWithInit.supplierInvoiceNo || purchWithInit.id} (${purchWithInit.supplier})`,
      }));
      applyInventoryAdjustments(adjs);
    }

    logAuditEvent({
      action: 'CREATE',
      entityType: 'PURCHASE',
      entityId: purchWithInit.id,
      entityNumber: purchWithInit.supplierInvoiceNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تسجيل فاتورة شراء من المورد [${purchWithInit.supplier}] بقيمة ${purchWithInit.total} ر.س وتحديث المخزون`,
    });

    setToastMessage({
      type: 'success',
      text: 'تم تسجيل فاتورة المشتريات وتحديث أرصدة المخزون المرتبطة بنجاح',
    });
  };

  const handleUpdatePurchase = (item: PurchaseItem) => {
    setPurchases((prev) => prev.map((p) => (p.id === item.id ? item : p)));
    cloudSavePurchase(item).catch(() => {});
    setToastMessage({ type: 'success', text: 'تم تعديل فاتورة المشتريات بنجاح' });
  };

  const handleDeletePurchase = (id: string) => {
    const target = purchases.find((p) => p.id === id);
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    cloudDeletePurchase(id).catch(() => {});
    logAuditEvent({
      action: 'DELETE',
      entityType: 'PURCHASE',
      entityId: id,
      entityNumber: target?.supplierInvoiceNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف فاتورة شراء برقم ${target?.supplierInvoiceNo || id}`,
    });
    setToastMessage({ type: 'info', text: 'تم حذف فاتورة الشراء وتحديث الحسابات' });
  };

  // Expenses Handlers
  const handleAddExpense = (item: ExpenseItem) => {
    setExpenses((prev) => [item, ...prev]);
    cloudSaveExpense(item).catch(() => {});
    logAuditEvent({
      action: 'CREATE',
      entityType: 'EXPENSE',
      entityId: item.id,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تسجيل مصروف [${item.expenseType}] بقيمة ${item.amount} ر.س`,
    });
    setToastMessage({ type: 'success', text: 'تم تسجيل المصروف بنجاح' });
  };

  const handleUpdateExpense = (item: ExpenseItem) => {
    setExpenses((prev) => prev.map((e) => (e.id === item.id ? item : e)));
    cloudSaveExpense(item).catch(() => {});
    setToastMessage({ type: 'success', text: 'تم تعديل المصروف بنجاح' });
  };

  const handleDeleteExpense = (id: string) => {
    const target = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    cloudDeleteExpense(id).catch(() => {});
    logAuditEvent({
      action: 'DELETE',
      entityType: 'EXPENSE',
      entityId: id,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف مصروف [${target?.expenseType || 'مصروف'}] بقيمة ${target?.amount || 0} ر.س`,
    });
    setToastMessage({ type: 'info', text: 'تم حذف المصروف بنجاح' });
  };

  // Inventory Handlers
  const handleAddInventory = (item: InventoryItem) => {
    setInventory((prev) => [item, ...prev]);
    cloudSaveInventory(item).catch(() => {});
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
      text: `تمت إضافة الصنف (${item.item}) إلى المخزون بنجاح`,
    });
  };

  const handleUpdateInventory = (item: InventoryItem) => {
    setInventory((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    cloudSaveInventory(item).catch(() => {});
    setToastMessage({
      type: 'success',
      text: `تم تحديث بيانات الصنف (${item.item}) بنجاح`,
    });
  };

  const handleDeleteInventory = (id: string) => {
    const target = inventory.find((i) => i.id === id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
    cloudDeleteInventory(id).catch(() => {});
    logAuditEvent({
      action: 'DELETE',
      entityType: 'INVENTORY',
      entityId: id,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف صنف من المخزون [${target?.item || id}]`,
    });
    setToastMessage({ type: 'info', text: 'تم حذف الصنف من المخزون' });
  };

  const handleRecordStockMovement = (
    inventoryId: string,
    quantityChange: number,
    type: 'wastage_out' | 'adjustment',
    reason: string,
    referenceDocNo?: string
  ) => {
    applyInventoryAdjustments([
      {
        inventoryId,
        quantityDelta: quantityChange,
        type,
        reason,
        referenceDocNo,
      },
    ]);
    logAuditEvent({
      action: 'STOCK_MOVEMENT',
      entityType: 'INVENTORY',
      entityId: inventoryId,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `${type === 'wastage_out' ? 'تسجيل هالك خامات' : 'تسوية جردية'} بكمية (${quantityChange}) — السبب: ${reason}`,
    });
    setToastMessage({
      type: 'success',
      text:
        type === 'wastage_out'
          ? 'تم خصم الهالك من المخزون وتسجيل تكلفته في التقارير بنجاح'
          : 'تم تنفيذ التسوية الجردية وتحديث رصيد المخزون بنجاح',
    });
  };

  // Vouchers Handlers (سندات القبض والصرف مع التسوية العكسية الآلية عند التعديل أو الحذف)
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
    const nextVouchers = [voucherWithAudit, ...vouchers];
    setVouchers(nextVouchers);
    cloudSaveVoucher(voucherWithAudit).catch(() => {});

    const { updatedSales, updatedPurchases } = reconcileDocumentsWithVouchersAndReturns(
      sales,
      purchases,
      nextVouchers,
      returns
    );
    setSales(updatedSales);
    setPurchases(updatedPurchases);

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
      text: `تم حفظ السند (${voucherWithAudit.voucherNo}) وتحديث أرصدة الفواتير المرتبطة تلقائياً`,
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
    const nextVouchers = vouchers.map((v) => (v.id === voucherWithAudit.id ? voucherWithAudit : v));
    setVouchers(nextVouchers);
    cloudSaveVoucher(voucherWithAudit).catch(() => {});

    const { updatedSales, updatedPurchases } = reconcileDocumentsWithVouchersAndReturns(
      sales,
      purchases,
      nextVouchers,
      returns
    );
    setSales(updatedSales);
    setPurchases(updatedPurchases);

    logAuditEvent({
      action: 'UPDATE',
      entityType: 'VOUCHER',
      entityId: voucherWithAudit.id,
      entityNumber: voucherWithAudit.voucherNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `تعديل السند رقم ${voucherWithAudit.voucherNo} وإعادة موازنة الفاتورة المرتبطة`,
    });
    setToastMessage({
      type: 'success',
      text: `تم تعديل السند (${voucherWithAudit.voucherNo}) وتحديث الفاتورة المرتبطة تلقائياً`,
    });
  };

  const handleDeleteVoucher = (id: string) => {
    const target = vouchers.find((v) => v.id === id);
    const nextVouchers = vouchers.filter((v) => v.id !== id);
    setVouchers(nextVouchers);
    cloudDeleteVoucher(id).catch(() => {});

    // إعادة احتساب الفاتورة فوراً وإرجاع المبلغ المتبقي كما كان قبل السند
    const { updatedSales, updatedPurchases } = reconcileDocumentsWithVouchersAndReturns(
      sales,
      purchases,
      nextVouchers,
      returns
    );
    setSales(updatedSales);
    setPurchases(updatedPurchases);

    logAuditEvent({
      action: 'DELETE',
      entityType: 'VOUCHER',
      entityId: id,
      entityNumber: target?.voucherNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف السند رقم ${target?.voucherNo || id} بقيمة ${target?.amount || 0} ر.س وعكس أثره على الفاتورة المرتبطة`,
    });
    setToastMessage({
      type: 'info',
      text: `تم حذف السند (${target?.voucherNo || id}) وإعادة الرصيد المتبقي للفاتورة تلقائياً`,
    });
  };

  // Returns & Credit Notes Handlers (المرتجعات وإشعارات الدائن)
  const handleAddReturn = (
    rec: ReturnRecord,
    restockAdjustments: { inventoryId: string; quantityDelta: number; reason: string }[],
    createCashVoucher: boolean
  ) => {
    let finalRecord: ReturnRecord = {
      ...rec,
      audit: {
        createdByName: currentActorName,
        createdByEmail: currentActorEmail,
        createdAt: new Date().toISOString(),
        updatedByName: currentActorName,
        updatedByEmail: currentActorEmail,
        updatedAt: new Date().toISOString(),
      },
    };

    let nextVouchers = [...vouchers];

    if (createCashVoucher && finalRecord.totalRefundAmount > 0) {
      const vType = finalRecord.kind === 'sale_return' ? 'payment' : 'receipt';
      const vPrefix = vType === 'receipt' ? 'RC' : 'PV';
      const vNo = getNextSequenceNumber(
        vPrefix,
        vouchers.filter((v) => v.type === vType).map((v) => v.voucherNo)
      );
      const autoVoucher: VoucherItem = {
        id: `vouch-ret-${Date.now()}`,
        voucherNo: vNo,
        type: vType,
        date: finalRecord.date,
        amount: finalRecord.totalRefundAmount,
        amountInWords: tafqeet(finalRecord.totalRefundAmount),
        partyName: finalRecord.partyName,
        partyPhone: finalRecord.partyPhone || '',
        paymentMethod: finalRecord.paymentMethod,
        relatedInvoiceNo: finalRecord.originalDocNo,
        relatedDocId: finalRecord.id,
        relatedDocType: 'return',
        isInvoiceSettlement: false,
        description:
          finalRecord.kind === 'sale_return'
            ? `استرداد نقدي للعميل مقابل إشعار دائن رقم ${finalRecord.returnNo} للفاتورة ${finalRecord.originalDocNo}`
            : `استرداد مالي من المورد مقابل مرتجع مشتريات رقم ${finalRecord.returnNo} للفاتورة ${finalRecord.originalDocNo}`,
        receivedBy: currentActorName,
        approvedBy: agencySettings.agencyName || 'الإدارة المالية',
      };
      finalRecord = {
        ...finalRecord,
        generatedVoucherId: autoVoucher.id,
        generatedVoucherNo: autoVoucher.voucherNo,
      };
      nextVouchers = [autoVoucher, ...nextVouchers];
      setVouchers(nextVouchers);
      cloudSaveVoucher(autoVoucher).catch(() => {});
    }

    const nextReturns = [finalRecord, ...returns];
    setReturns(nextReturns);
    cloudSaveReturn(finalRecord).catch(() => {});

    // تحديث المخزون تلقائياً
    if (restockAdjustments.length > 0) {
      applyInventoryAdjustments(
        restockAdjustments.map((adj) => ({
          inventoryId: adj.inventoryId,
          quantityDelta: adj.quantityDelta,
          type: finalRecord.kind === 'sale_return' ? 'sale_return_in' : 'purchase_return_out',
          referenceDocNo: finalRecord.returnNo,
          referenceDocId: finalRecord.id,
          reason: adj.reason,
        }))
      );
    }

    // تحديث أرصدة الفواتير والمشتريات
    const { updatedSales, updatedPurchases } = reconcileDocumentsWithVouchersAndReturns(
      sales,
      purchases,
      nextVouchers,
      nextReturns
    );
    setSales(updatedSales);
    setPurchases(updatedPurchases);

    logAuditEvent({
      action: 'RETURN',
      entityType: 'RETURN',
      entityId: finalRecord.id,
      entityNumber: finalRecord.returnNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `إصدار ${finalRecord.kind === 'sale_return' ? 'إشعار دائن مبيعات' : 'مرتجع مشتريات'} رقم ${finalRecord.returnNo} بقيمة ${finalRecord.totalRefundAmount} ر.س مرتبط بالفاتورة ${finalRecord.originalDocNo}`,
    });

    setToastMessage({
      type: 'success',
      text: `تم إصدار الإشعار (${finalRecord.returnNo}) وتحديث الفاتورة والمخزون والخزينة تلقائياً!`,
    });
  };

  const handleDeleteReturn = (id: string) => {
    const target = returns.find((r) => r.id === id);
    if (!target) return;

    const nextReturns = returns.filter((r) => r.id !== id);
    setReturns(nextReturns);
    cloudDeleteReturn(id).catch(() => {});

    let nextVouchers = [...vouchers];
    if (target.generatedVoucherId) {
      nextVouchers = nextVouchers.filter((v) => v.id !== target.generatedVoucherId);
      setVouchers(nextVouchers);
      cloudDeleteVoucher(target.generatedVoucherId).catch(() => {});
    }

    // عكس حركة المخزون إذا كان المرتجع قد عدّل المخزون
    if (target.restockToInventory) {
      const reverseAdjs = target.items
        .filter((it) => it.restockInventoryId && (it.restockQty || 0) > 0)
        .map((it) => ({
          inventoryId: it.restockInventoryId!,
          quantityDelta:
            target.kind === 'sale_return' ? -(it.restockQty || 0) : +(it.restockQty || 0),
          type: 'adjustment' as const,
          referenceDocNo: target.returnNo,
          reason: `عكس حركة مخزون بسبب حذف الإشعار رقم ${target.returnNo}`,
        }));
      applyInventoryAdjustments(reverseAdjs);
    }

    const { updatedSales, updatedPurchases } = reconcileDocumentsWithVouchersAndReturns(
      sales,
      purchases,
      nextVouchers,
      nextReturns
    );
    setSales(updatedSales);
    setPurchases(updatedPurchases);

    logAuditEvent({
      action: 'DELETE',
      entityType: 'RETURN',
      entityId: id,
      entityNumber: target.returnNo,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `حذف الإشعار رقم ${target.returnNo} وعكس أثره المالي والمخزني`,
    });

    setToastMessage({
      type: 'info',
      text: `تم حذف الإشعار (${target.returnNo}) وإعادة أرصدة الفاتورة والمخزون والخزينة`,
    });
  };

  // HR & Payroll Handlers (الموارد البشرية والحضور ومسيرات الرواتب)
  const handleAddEmployee = (emp: EmployeeItem) => {
    setEmployees((prev) => [emp, ...prev]);
    cloudSaveEmployee(emp).catch(() => {});
    logAuditEvent({
      action: 'CREATE',
      entityType: 'HR',
      entityId: emp.id,
      entityNumber: emp.employeeCode,
      userName: currentActorName,
      userEmail: currentActorEmail,
      details: `إضافة موظف جديد [${emp.name}] - ${emp.jobTitle}`,
    });
    setToastMessage({ type: 'success', text: `تمت إضافة الموظف (${emp.name}) بنجاح` });
  };

  const handleUpdateEmployee = (emp: EmployeeItem) => {
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
    cloudSaveEmployee(emp).catch(() => {});
    setToastMessage({ type: 'success', text: `تم تحديث بيانات الموظف (${emp.name}) بنجاح` });
  };

  const handleDeleteEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    cloudDeleteEmployee(id).catch(() => {});
    setToastMessage({ type: 'info', text: 'تم حذف سجل الموظف' });
  };

  const handleSaveAttendanceBatch = (batch: AttendanceRecord[]) => {
    setAttendance((prev) => {
      const map = new Map<string, AttendanceRecord>();
      prev.forEach((a) => map.set(a.id, a));
      batch.forEach((b) => {
        map.set(b.id, b);
        cloudSaveAttendance(b).catch(() => {});
      });
      return Array.from(map.values());
    });
    setToastMessage({
      type: 'success',
      text: `تم حفظ سجل الحضور والانصراف ليوم (${batch[0]?.date || ''}) بنجاح`,
    });
  };

  const handleCreateOrUpdatePayroll = (payroll: PayrollRun, approveAndDisburse: boolean) => {
    let finalPayroll = { ...payroll };

    if (approveAndDisburse) {
      // 1. توليد قيد مصروف تلقائي بالرواتب المعتمدة
      const expId = finalPayroll.generatedExpenseId || `exp-payroll-${finalPayroll.month}`;
      const payrollExpense: ExpenseItem = {
        id: expId,
        date: finalPayroll.issueDate,
        expenseType: `رواتب وأجور شهر ${finalPayroll.month}`,
        category: 'رواتب وأجور',
        amount: finalPayroll.totalNetPayroll,
        paymentMethod: finalPayroll.paymentMethod,
        notes: `قيد آلي لمسير الرواتب المعتمد رقم ${finalPayroll.payrollNo} (${finalPayroll.lines.length} موظف)`,
        relatedPayrollId: finalPayroll.id,
      };
      setExpenses((prev) => {
        const exists = prev.some((e) => e.id === expId);
        return exists ? prev.map((e) => (e.id === expId ? payrollExpense : e)) : [payrollExpense, ...prev];
      });
      cloudSaveExpense(payrollExpense).catch(() => {});

      // 2. توليد سندات صرف رواتب للموظفين
      const generatedIds: string[] = [];
      const newPayrollVouchers: VoucherItem[] = [];
      const existingVoucherNos = vouchers.map((v) => v.voucherNo);

      finalPayroll.lines.forEach((line) => {
        if (line.netSalary <= 0) return;
        const vId = `vouch-pay-${finalPayroll.month}-${line.employeeId}`;
        generatedIds.push(vId);
        const vNo = getNextSequenceNumber('PV', [
          ...existingVoucherNos,
          ...newPayrollVouchers.map((x) => x.voucherNo),
        ]);
        const vItem: VoucherItem = {
          id: vId,
          voucherNo: vNo,
          type: 'payment',
          date: finalPayroll.issueDate,
          amount: line.netSalary,
          amountInWords: tafqeet(line.netSalary),
          partyName: line.employeeName,
          paymentMethod: finalPayroll.paymentMethod,
          relatedInvoiceNo: finalPayroll.payrollNo,
          relatedDocId: finalPayroll.id,
          relatedDocType: 'payroll',
          isInvoiceSettlement: false,
          description: `صرف صافي راتب شهر ${finalPayroll.month} للموظف ${line.employeeName} (${line.jobTitle})`,
          receivedBy: line.employeeName,
          approvedBy: currentActorName,
        };
        newPayrollVouchers.push(vItem);
        cloudSaveVoucher(vItem).catch(() => {});
      });

      setVouchers((prev) => {
        const filtered = prev.filter((v) => !generatedIds.includes(v.id));
        return [...newPayrollVouchers, ...filtered];
      });

      finalPayroll = {
        ...finalPayroll,
        generatedExpenseId: expId,
        generatedVoucherIds: generatedIds,
        approvedBy: currentActorName,
      };

      logAuditEvent({
        action: 'PAYROLL',
        entityType: 'HR',
        entityId: finalPayroll.id,
        entityNumber: finalPayroll.payrollNo,
        userName: currentActorName,
        userEmail: currentActorEmail,
        details: `اعتماد وصرف مسير رواتب شهر ${finalPayroll.month} بقيمة صافية ${finalPayroll.totalNetPayroll} ر.س وتوليد المصروف وسندات الصرف`,
      });
    }

    setPayrolls((prev) => {
      const exists = prev.some((p) => p.id === finalPayroll.id || p.month === finalPayroll.month);
      return exists
        ? prev.map((p) => (p.id === finalPayroll.id || p.month === finalPayroll.month ? finalPayroll : p))
        : [finalPayroll, ...prev];
    });
    cloudSavePayroll(finalPayroll).catch(() => {});

    setToastMessage({
      type: 'success',
      text: approveAndDisburse
        ? `تم اعتماد وصرف مسير رواتب (${finalPayroll.month}) وتوليد المصروف وسندات الصرف تلقائياً!`
        : `تم حفظ مسودة مسير رواتب (${finalPayroll.month}) بنجاح`,
    });
  };

  const handleDeletePayroll = (id: string) => {
    const target = payrolls.find((p) => p.id === id);
    setPayrolls((prev) => prev.filter((p) => p.id !== id));
    cloudDeletePayroll(id).catch(() => {});

    if (target?.generatedExpenseId) {
      setExpenses((prev) => prev.filter((e) => e.id !== target.generatedExpenseId));
      cloudDeleteExpense(target.generatedExpenseId).catch(() => {});
    }
    if (target?.generatedVoucherIds && target.generatedVoucherIds.length > 0) {
      setVouchers((prev) => prev.filter((v) => !target.generatedVoucherIds!.includes(v.id)));
      target.generatedVoucherIds.forEach((vid) => cloudDeleteVoucher(vid).catch(() => {}));
    }

    setToastMessage({
      type: 'info',
      text: 'تم حذف مسير الرواتب وإلغاء القيود المرتبطة به',
    });
  };

  // Agency Settings & Backup / Reset Handlers
  const handleUpdateAgencySettings = (newSettings: AgencySettings) => {
    const cleanSettings = { ...newSettings };
    delete (cleanSettings as any).previewRole;
    setAgencySettings(cleanSettings);
    updateDynamicBranding(cleanSettings);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_AGENCY, JSON.stringify(cleanSettings));
    } catch {}
    if (user) {
      cloudSaveAgencySettings(cleanSettings).catch(() => {});
    }
    setToastMessage({
      type: 'success',
      text: 'تم حفظ وتحديث هوية وإعدادات الوكالة بنجاح',
    });
  };

  const handleClearAllRecords = () => {
    setSales([]);
    setQuotations([]);
    setPurchases([]);
    setExpenses([]);
    setInventory([]);
    setVouchers([]);
    setReturns([]);
    setMovements([]);
    setEmployees([]);
    setAttendance([]);
    setPayrolls([]);
    setToastMessage({
      type: 'info',
      text: 'تم تصفير ومسح جميع البيانات التجريبية بنجاح. يمكنك الآن البدء بإدخال بياناتك الحقيقية.',
    });
  };

  const handleExportJsonBackup = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      agencySettings,
      sales,
      quotations,
      purchases,
      expenses,
      inventory,
      vouchers,
      returns,
      movements,
      employees,
      attendance,
      payrolls,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_وكالة_الدعاية_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMessage({ type: 'success', text: 'تم تصدير النسخة الاحتياطية الكاملة (JSON) بنجاح' });
  };

  const handleImportJsonBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || typeof data !== 'object') throw new Error('ملف غير صالح');
        if (Array.isArray(data.sales)) setSales(data.sales);
        if (Array.isArray(data.quotations)) setQuotations(data.quotations);
        if (Array.isArray(data.purchases)) setPurchases(data.purchases);
        if (Array.isArray(data.expenses)) setExpenses(data.expenses);
        if (Array.isArray(data.inventory)) setInventory(data.inventory);
        if (Array.isArray(data.vouchers)) setVouchers(data.vouchers);
        if (Array.isArray(data.returns)) setReturns(data.returns);
        if (Array.isArray(data.movements)) setMovements(data.movements);
        if (Array.isArray(data.employees)) setEmployees(data.employees);
        if (Array.isArray(data.attendance)) setAttendance(data.attendance);
        if (Array.isArray(data.payrolls)) setPayrolls(data.payrolls);
        if (data.agencySettings) setAgencySettings(data.agencySettings);
        setToastMessage({ type: 'success', text: 'تم استعادة النسخة الاحتياطية بنجاح!' });
      } catch {
        setToastMessage({ type: 'error', text: 'فشل قراءة ملف النسخة الاحتياطية، تأكد من صحة ملف JSON' });
      }
    };
    reader.readAsText(file);
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

          {activeTab === 'returns' && allowedTabs.includes('returns') && (
            <ReturnsView
              returns={returns}
              sales={sales}
              purchases={purchases}
              inventory={inventory}
              movements={movements}
              agencySettings={agencySettings}
              userRole={userRole}
              currentLang={currentLang}
              onAddReturn={handleAddReturn}
              onDeleteReturn={handleDeleteReturn}
              onRecordWastage={(invId, qty, rsn, refNo) =>
                handleRecordStockMovement(invId, -Math.abs(qty), 'wastage_out', rsn, refNo)
              }
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
              purchases={purchases}
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
              movements={movements}
              userRole={userRole}
              currentLang={currentLang}
              onAddInventory={handleAddInventory}
              onUpdateInventory={handleUpdateInventory}
              onDeleteInventory={handleDeleteInventory}
              onRecordStockMovement={(invId, delta, type, rsn) =>
                handleRecordStockMovement(invId, delta, type, rsn)
              }
              isModalOpen={isInventoryModalOpen}
              setIsModalOpen={setIsInventoryModalOpen}
            />
          )}

          {activeTab === 'hr' && allowedTabs.includes('hr') && (
            <HrPayrollView
              employees={employees}
              attendance={attendance}
              payrolls={payrolls}
              agencySettings={agencySettings}
              userRole={userRole}
              currentLang={currentLang}
              onAddEmployee={handleAddEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onSaveAttendanceBatch={handleSaveAttendanceBatch}
              onCreateOrUpdatePayroll={handleCreateOrUpdatePayroll}
              onDeletePayroll={handleDeletePayroll}
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

        <FormulasModal
          isOpen={isFormulasModalOpen}
          onClose={() => setIsFormulasModalOpen(false)}
        />

        <InvoicePrintModal
          sale={printSale}
          onClose={() => setPrintSale(null)}
          agencySettings={agencySettings}
          onUpdateAgencySettings={handleUpdateAgencySettings}
        />

        <QuotationPrintModal
          quotation={printQuotation}
          onClose={() => setPrintQuotation(null)}
          agencySettings={agencySettings}
          onUpdateAgencySettings={handleUpdateAgencySettings}
          onConvertQuotationToSale={handleConvertQuotationToSale}
        />

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
          onClearAllRecords={handleClearAllRecords}
          onExportJsonBackup={handleExportJsonBackup}
          onImportJsonBackup={handleImportJsonBackup}
        />

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

        <AuditTimelineModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          viewMode="all"
        />
      </div>
    </AuthGate>
  );
}
