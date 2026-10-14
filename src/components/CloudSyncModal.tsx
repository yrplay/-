import React, { useState } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Smartphone,
  Laptop,
  ArrowRightLeft,
  Activity,
  FileText,
  Package,
  Receipt,
  ShoppingCart,
  DollarSign,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  SaleItem,
  PurchaseItem,
  ExpenseItem,
  InventoryItem,
  QuotationItem,
  AgencySettings,
} from '../types';
import {
  SyncStatus,
  testCloudConnection,
  fetchAllCloudData,
  uploadAllDataToCloud,
  syncMergeLocalAndCloud,
} from '../lib/cloudSync';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  cloudSyncStatus: SyncStatus;
  sales: SaleItem[];
  purchases: PurchaseItem[];
  expenses: ExpenseItem[];
  inventory: InventoryItem[];
  quotations: QuotationItem[];
  agencySettings: AgencySettings;
  onUpdateSales: (sales: SaleItem[]) => void;
  onUpdatePurchases: (purchases: PurchaseItem[]) => void;
  onUpdateExpenses: (expenses: ExpenseItem[]) => void;
  onUpdateInventory: (inventory: InventoryItem[]) => void;
  onUpdateQuotations: (quotations: QuotationItem[]) => void;
  onUpdateAgencySettings: (settings: AgencySettings) => void;
  onShowToast: (toast: { type: 'success' | 'info' | 'error'; text: string }) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  user,
  cloudSyncStatus,
  sales,
  purchases,
  expenses,
  inventory,
  quotations,
  agencySettings,
  onUpdateSales,
  onUpdatePurchases,
  onUpdateExpenses,
  onUpdateInventory,
  onUpdateQuotations,
  onUpdateAgencySettings,
  onShowToast,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    ok: boolean;
    latencyMs: number;
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  // Run live diagnostic connection test
  const handleTestConnection = async () => {
    setIsProcessing(true);
    setOperationMessage('جاري فحص الاتصال بقاعدة بيانات Firebase Firestore...');
    try {
      const res = await testCloudConnection();
      setDiagnosticResult(res);
      if (res.ok) {
        onShowToast({
          type: 'success',
          text: `الاتصال السحابي سليم وسريع (${res.latencyMs}ms)! تم التحقق بنجاح.`,
        });
      } else {
        onShowToast({
          type: 'error',
          text: `فشل فحص الاتصال السحابي: ${res.error || 'يرجى مراجعة الصلاحيات'}`,
        });
      }
    } catch (err: any) {
      setDiagnosticResult({ ok: false, latencyMs: 0, error: err?.message });
      onShowToast({
        type: 'error',
        text: 'تعذر الاتصال بالسحابة: ' + (err?.message || 'خطأ غير متوقع'),
      });
    } finally {
      setIsProcessing(false);
      setOperationMessage(null);
    }
  };

  // Pull latest data directly from Firestore
  const handlePullFromCloud = async () => {
    setIsProcessing(true);
    setOperationMessage('جاري سحب أحدث نسخة من السحابة وتحديث بيانات هذا الجهاز...');
    try {
      const cloudData = await fetchAllCloudData();
      onUpdateSales(cloudData.sales);
      onUpdateQuotations(cloudData.quotations);
      onUpdatePurchases(cloudData.purchases);
      onUpdateExpenses(cloudData.expenses);
      onUpdateInventory(cloudData.inventory);
      if (cloudData.agencySettings) {
        onUpdateAgencySettings(cloudData.agencySettings);
      }
      onShowToast({
        type: 'success',
        text: `تم تحديث هذا الجهاز بنجاح! تم استيراد (${cloudData.sales.length}) فاتورة و (${cloudData.quotations.length}) عرض سعر من السحابة.`,
      });
      onClose();
    } catch (err: any) {
      console.error('Pull cloud data error:', err);
      onShowToast({
        type: 'error',
        text: 'تعذر سحب البيانات السحابية: ' + (err?.message || 'يرجى المحاولة ثانية'),
      });
    } finally {
      setIsProcessing(false);
      setOperationMessage(null);
    }
  };

  // Push all local data to Firestore
  const handlePushToCloud = async () => {
    setIsProcessing(true);
    setOperationMessage('جاري رفع وتحديث جميع فواتير وعروض هذا الجهاز إلى السحابة...');
    try {
      await uploadAllDataToCloud(
        sales,
        purchases,
        expenses,
        inventory,
        quotations,
        agencySettings
      );
      onShowToast({
        type: 'success',
        text: 'تم رفع كافة البيانات الحالية لهذا الجهاز إلى السحابة بنجاح! ستظهر فوراً في جهازك الآخر.',
      });
      onClose();
    } catch (err: any) {
      console.error('Push cloud data error:', err);
      onShowToast({
        type: 'error',
        text: 'تعذر رفع البيانات للسحابة: ' + (err?.message || 'تأكد من اتصالك بالإنترنت'),
      });
    } finally {
      setIsProcessing(false);
      setOperationMessage(null);
    }
  };

  // Smart Merge local and cloud data
  const handleSmartMerge = async () => {
    setIsProcessing(true);
    setOperationMessage('جاري دمج ومزامنة البيانات بين السحابة وهذا الجهاز لضمان حفظ كل شيء...');
    try {
      const merged = await syncMergeLocalAndCloud({
        sales,
        purchases,
        expenses,
        inventory,
        quotations,
        agencySettings,
      });

      onUpdateSales(merged.sales);
      onUpdateQuotations(merged.quotations);
      onUpdatePurchases(merged.purchases);
      onUpdateExpenses(merged.expenses);
      onUpdateInventory(merged.inventory);
      onUpdateAgencySettings(merged.agencySettings);

      onShowToast({
        type: 'success',
        text: `تمت المزامنة الذكية بنجاح! تم دمج ومطابقة (${merged.sales.length}) فاتورة و (${merged.quotations.length}) عرض سعر.`,
      });
      onClose();
    } catch (err: any) {
      console.error('Smart merge error:', err);
      onShowToast({
        type: 'error',
        text: 'فشلت المزامنة الذكية: ' + (err?.message || 'يرجى المحاولة لاحقاً'),
      });
    } finally {
      setIsProcessing(false);
      setOperationMessage(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      dir="rtl"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>مركز المزامنة والتخزين السحابي الفوري</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  Firebase Firestore
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                مزامنة تلقائية لحظية متعددة الأجهزة لجميع الفواتير والعروض والمصروفات
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Status Bar */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  cloudSyncStatus === 'synced'
                    ? 'bg-emerald-400 animate-pulse shadow-lg shadow-emerald-500/50'
                    : cloudSyncStatus === 'syncing'
                    ? 'bg-amber-400 animate-spin'
                    : 'bg-rose-400'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <span>حالة المزامنة:</span>
                  <span
                    className={`font-bold ${
                      cloudSyncStatus === 'synced'
                        ? 'text-emerald-400'
                        : cloudSyncStatus === 'syncing'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {cloudSyncStatus === 'synced'
                      ? 'متصل ومتزامن لحظياً (Real-time Live)'
                      : cloudSyncStatus === 'syncing'
                      ? 'جاري نقل وتحديث البيانات...'
                      : 'غير متصل بالسحابة (محلي فقط)'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  الحساب النشط: <span className="font-mono text-slate-300">{user?.email || 'غير مسجل'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>فحص سرعة الاتصال السحابي</span>
            </button>
          </div>

          {/* Diagnostic Result */}
          {diagnosticResult && (
            <div
              className={`rounded-2xl p-3.5 border text-xs flex items-center gap-3 ${
                diagnosticResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {diagnosticResult.ok ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <div className="flex-1">
                {diagnosticResult.ok ? (
                  <span>
                    الاتصال بقاعدة بيانات Firebase سليم بنجاح! زمن الاستجابة:{' '}
                    <strong className="font-mono">{diagnosticResult.latencyMs} ms</strong>
                  </span>
                ) : (
                  <span>خطأ في الاتصال: {diagnosticResult.error}</span>
                )}
              </div>
            </div>
          )}

          {/* Current Device Records Summary */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-emerald-400" />
              <span>سجلات هذا الجهاز المحفوظة حالياً:</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
                <FileText className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <span className="text-lg font-black text-white">{sales.length}</span>
                <span className="block text-[11px] text-slate-400">فواتير مبيعات</span>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
                <Receipt className="w-4 h-4 text-teal-400 mx-auto mb-1" />
                <span className="text-lg font-black text-white">{quotations.length}</span>
                <span className="block text-[11px] text-slate-400">عروض أسعار</span>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
                <ShoppingCart className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <span className="text-lg font-black text-white">{purchases.length}</span>
                <span className="block text-[11px] text-slate-400">مشتريات</span>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
                <DollarSign className="w-4 h-4 text-rose-400 mx-auto mb-1" />
                <span className="text-lg font-black text-white">{expenses.length}</span>
                <span className="block text-[11px] text-slate-400">مصروفات</span>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                <Package className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <span className="text-lg font-black text-white">{inventory.length}</span>
                <span className="block text-[11px] text-slate-400">أصناف مخزون</span>
              </div>
            </div>
          </div>

          {/* Multi-Device Problem Resolution Notice */}
          <div className="bg-gradient-to-br from-blue-950/40 via-slate-800/60 to-slate-800/40 border border-blue-500/30 rounded-2xl p-4 text-xs text-slate-300 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-blue-300">
              <Smartphone className="w-4 h-4 text-blue-400" />
              <span>حل مشكلة المزامنة بين جهازك الأول وجهازك الثاني:</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              إذا قمت بإضافة فواتير أو عروض أسعار على <strong>جهازك الثاني</strong> وتريد أن تظهر هنا على هذا الجهاز فوراً:
            </p>
            <ol className="pr-5 list-decimal space-y-1 text-slate-400">
              <li>
                <strong>الخطوة 1:</strong> تأكد أنك مسجل الدخول بنفس حساب Google (<span className="text-white font-mono">{user?.email}</span>) على الجهازين.
              </li>
              <li>
                <strong>الخطوة 2:</strong> تم نشر قواعد الأمان وتفعيل المزامنة اللحظية؛ اضغط على زر <strong>"سحب أحدث نسخة من السحابة"</strong> أدناه لجلب كل ما تم تعديله في جهازك الثاني.
              </li>
              <li>
                <strong>الخطوة 3:</strong> من الآن فصاعداً، أي إضافة أو تعديل أو حذف لأي فاتورة أو عرض سعر ينعكس فورياً في نفس اللحظة على جميع أجهزتك المفتوحة دون الحاجة لتحديث الصفحة!
              </li>
            </ol>
          </div>

          {/* Action Operations Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
              <span>إجراءات المزامنة اليدوية:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Pull from Cloud Button */}
              <button
                type="button"
                onClick={handlePullFromCloud}
                disabled={isProcessing}
                className="bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-2xl p-4 text-right transition border border-emerald-500/50 shadow-lg shadow-emerald-950/30 group cursor-pointer disabled:opacity-50 flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/30 flex items-center justify-center text-emerald-200 mb-2 group-hover:scale-110 transition">
                    <DownloadCloud className="w-4 h-4" />
                  </div>
                  <h5 className="font-bold text-xs text-white mb-1">
                    سحب أحدث نسخة من السحابة
                  </h5>
                  <p className="text-[11px] text-emerald-200/80 leading-snug">
                    يستورد فوراً التعديلات والفواتير والعروض التي أنشأتها على جهازك الآخر
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-bold text-emerald-300 block">
                  جلب من السحابة ←
                </span>
              </button>

              {/* Smart Merge Button */}
              <button
                type="button"
                onClick={handleSmartMerge}
                disabled={isProcessing}
                className="bg-slate-800 hover:bg-slate-750 text-white rounded-2xl p-4 text-right transition border border-slate-700 shadow-md group cursor-pointer disabled:opacity-50 flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300 mb-2 group-hover:scale-110 transition">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <h5 className="font-bold text-xs text-white mb-1">
                    دمج ومزامنة ذكية
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    يدمج البيانات الجديدة بين الجهازين في السحابة بدون حذف أو تكرار
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-bold text-blue-300 block">
                  دمج آمن ومطابقة ←
                </span>
              </button>

              {/* Push to Cloud Button */}
              <button
                type="button"
                onClick={handlePushToCloud}
                disabled={isProcessing}
                className="bg-slate-800 hover:bg-slate-750 text-white rounded-2xl p-4 text-right transition border border-slate-700 shadow-md group cursor-pointer disabled:opacity-50 flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 mb-2 group-hover:scale-110 transition">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <h5 className="font-bold text-xs text-white mb-1">
                    رفع بيانات هذا الجهاز
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    يرفع كافة فواتير وعروض هذا الجهاز إلى السحابة لتظهر في أجهزتك الأخرى
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-bold text-purple-300 block">
                  رفع إلى السحابة ←
                </span>
              </button>
            </div>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-3.5 flex items-center gap-3 text-emerald-300 text-xs animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>{operationMessage || 'جاري معالجة العملية السحابية...'}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>مشفر ومحمي بقواعد أمان Firebase Firestore</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
