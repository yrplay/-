import React, { useState } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  FolderPlus,
  Link2,
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  isLoggedIn: boolean;
  userEmail?: string | null;
  hasGoogleToken?: boolean;
  onLogin: () => void;
  onCreateNewSheet: (title: string) => Promise<void>;
  onLinkExistingSheet: (idOrUrl: string) => Promise<void>;
  onSyncNow: () => Promise<void>;
  isProcessing: boolean;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  spreadsheetId,
  spreadsheetUrl,
  isLoggedIn,
  userEmail,
  hasGoogleToken,
  onLogin,
  onCreateNewSheet,
  onLinkExistingSheet,
  onSyncNow,
  isProcessing,
}) => {
  const [sheetTitle, setSheetTitle] = useState('نظام محاسبة الدعاية والإعلان والمطبوعات - 2026');
  const [customIdInput, setCustomIdInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'link'>('create');

  if (!isOpen) return null;

  const handleCreate = async () => {
    setStatusMessage(null);
    try {
      await onCreateNewSheet(sheetTitle);
      setStatusMessage({
        type: 'success',
        text: 'تم إنشاء جدول Google Sheets بجميع الأوراق الخمس بنجاح!',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء إنشاء جدول البيانات',
      });
    }
  };

  const handleLink = async () => {
    if (!customIdInput.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال رابط أو معرّف جدول البيانات' });
      return;
    }
    setStatusMessage(null);
    try {
      await onLinkExistingSheet(customIdInput.trim());
      setStatusMessage({
        type: 'success',
        text: 'تم ربط جدول البيانات بنجاح!',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'تعذر ربط جدول البيانات، تأكد من الصلاحيات والرابط',
      });
    }
  };

  const handleSync = async () => {
    setStatusMessage(null);
    try {
      await onSyncNow();
      setStatusMessage({
        type: 'success',
        text: 'تمت مزامنة جميع الفواتير والمشتريات والمخزون مع Google Sheets بنجاح!',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'فشلت المزامنة، تأكد من اتصال الإنترنت',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">إدارة وتكامل Google Sheets</h3>
              <p className="text-xs text-emerald-100">
                ربط النظام السحابي مع حساب Google Drive و Google Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* User Account Status */}
          {isLoggedIn ? (
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <div>
                  <div className="text-[10px] text-emerald-800 font-semibold">حساب Google المتصل للنظام</div>
                  <div className="text-xs font-bold text-slate-900">{userEmail || 'حساب Google نشط'}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogin}
                className="px-2 py-1 rounded-md bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] transition shadow-2xs cursor-pointer"
                title="تجديد أو منح إذن Google Sheets لهذا الحساب أو تبديله"
              >
                تجديد الإذن / تبديل
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>يلزم تسجيل الدخول بحساب Google للربط السحابي</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                لكي يتمكن النظام من إنشاء ملف Google Sheets في حسابك ومزامنته تلقائياً، يرجى تسجيل الدخول وإعطاء صلاحية الوصول لملفات Sheets و Drive.
              </p>
              <button
                onClick={onLogin}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>تسجيل الدخول عبر Google</span>
              </button>
            </div>
          )}

          {isLoggedIn && (
            <>
              {/* Connected Sheet Card if exists */}
              {spreadsheetId && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="font-bold text-slate-800 text-sm">الملف الحالي المرتبط</span>
                    </div>
                    {spreadsheetUrl && (
                      <a
                        href={spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold text-xs"
                      >
                        <span>فتح في Google Sheets</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-600 select-all break-all">
                    معرف الملف: {spreadsheetId}
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      onClick={handleSync}
                      disabled={isProcessing}
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                      <span>{isProcessing ? 'جارِ المزامنة...' : 'مزامنة كافة البيانات الآن'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tabs: Create New OR Link Existing */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex border-b border-slate-200 bg-slate-50">
                  <button
                    onClick={() => setActiveSubTab('create')}
                    className={`flex-1 py-2.5 px-3 font-bold text-xs transition border-b-2 flex items-center justify-center gap-1.5 ${
                      activeSubTab === 'create'
                        ? 'border-emerald-600 text-emerald-700 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>إنشاء ملف جديد بالكامل</span>
                  </button>
                  <button
                    onClick={() => setActiveSubTab('link')}
                    className={`flex-1 py-2.5 px-3 font-bold text-xs transition border-b-2 flex items-center justify-center gap-1.5 ${
                      activeSubTab === 'link'
                        ? 'border-emerald-600 text-emerald-700 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Link2 className="w-4 h-4" />
                    <span>ربط جدول موجود مسبقاً</span>
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {activeSubTab === 'create' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        سيقوم النظام تلقائياً بإنشاء ملف Google Sheets كامل في حسابك يضم الخمس أوراق الأساسية:
                        <strong> المبيعات، المشتريات، المصروفات، المخزون، والداشبورد</strong> مع جميع القوائم المنسدلة والصيغ التلقائية المعتمدة.
                      </p>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">عنوان الملف في Google Drive:</label>
                        <input
                          type="text"
                          value={sheetTitle}
                          onChange={(e) => setSheetTitle(e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <button
                        onClick={handleCreate}
                        disabled={isProcessing}
                        className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>{isProcessing ? 'جارِ إنشاء وتنسيق الجدول...' : 'إنشاء وتجهيز جدول البيانات فوراً'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        إذا كان لديك جدول Google Sheets موجود وتريد ربطه بالنظام، انسخ رابطه أو معرفه هنا:
                      </p>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">رابط أو ID الجدول:</label>
                        <input
                          type="text"
                          value={customIdInput}
                          onChange={(e) => setCustomIdInput(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/XXXXXX/edit أو معرّف الجدول"
                          className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                      </div>

                      <button
                        onClick={handleLink}
                        disabled={isProcessing}
                        className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
                      >
                        <Link2 className="w-4 h-4" />
                        <span>{isProcessing ? 'جارِ التحقق...' : 'ربط ومزامنة الجدول'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Features Highlights */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800">مزايا التكامل التلقائي:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>أوراق عمل مجهزة باتجاه عربي (RTL) مع تجميد الصف الأول للأعمدة.</li>
              <li>قوائم منسدلة تلقائية لخيارات نوع الخدمة، القياس، الدفع، الحالات، وخامات المخزون.</li>
              <li>صيغ تلقائية لكود الفاتورة وحسابات الصافي والمتبقي وحالة السداد وأيام التأخير.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
