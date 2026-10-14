import React, { useState, useMemo } from 'react';
import {
  History,
  X,
  User,
  Clock,
  CheckCircle2,
  Calendar,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  FileText,
  FileCheck2,
  Receipt,
  ShoppingCart,
  DollarSign,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { SaleItem, QuotationItem, AuditLogEntry } from '../types';
import { getAuditLogs } from '../lib/auditLogger';

interface AuditTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSale?: SaleItem | null;
  targetQuotation?: QuotationItem | null;
  viewMode?: 'item' | 'all';
}

export const AuditTimelineModal: React.FC<AuditTimelineModalProps> = ({
  isOpen,
  onClose,
  targetSale,
  targetQuotation,
  viewMode = targetSale || targetQuotation ? 'item' : 'all',
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const allLogs = useMemo(() => {
    return getAuditLogs();
  }, [isOpen]);

  // Determine current target if in item mode
  const currentItem = targetSale || targetQuotation;
  const isInvoice = Boolean(targetSale);
  const itemNo = targetSale?.invoiceNo || targetQuotation?.quotationNo || '';
  const customerName = currentItem?.customerName || '';
  const totalAmount = currentItem?.netTotal || 0;

  // Filter logs for this specific item or overall
  const itemLogs = useMemo(() => {
    if (!currentItem) return [];
    return allLogs.filter((log) => {
      const matchId = log.entityId && log.entityId === currentItem.id;
      const matchNo =
        log.entityNumber &&
        (log.entityNumber === itemNo ||
          log.details?.includes(itemNo));
      return matchId || matchNo;
    });
  }, [allLogs, currentItem, itemNo]);

  // Filtered logs for global mode
  const filteredGlobalLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (activeFilter !== 'ALL' && log.action !== activeFilter && log.entityType !== activeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = log.userName?.toLowerCase().includes(q) || log.userEmail?.toLowerCase().includes(q);
        const matchNo = log.entityNumber?.toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q);
        const matchCustomer = log.customerOrSupplier?.toLowerCase().includes(q);
        return matchUser || matchNo || matchDetails || matchCustomer;
      }
      return true;
    });
  }, [allLogs, activeFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <span>الخط الزمني وسجل المتابعة والتدقيق</span>
                {currentItem && (
                  <span className="bg-amber-400/20 text-amber-300 font-mono text-xs px-2 py-0.5 rounded-full border border-amber-400/30">
                    {itemNo}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {currentItem
                  ? `متابعة من أنشأ وآخر من عدل على ${isInvoice ? 'الفاتورة' : 'عرض السعر'} (${customerName})`
                  : 'تتبع كافة العمليات والأنشطة المنفذة في النظام مع أسماء المحررين'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
          {/* Section 1: Creator & Last Modifier Summary Cards (when targeting a specific invoice/quotation) */}
          {currentItem && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Creator Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>منشئ ومسجل السجل</span>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    المنشئ الأول
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-extrabold text-slate-900">
                    {currentItem.audit?.createdByName || 'حساب النظام الرئيسي'}
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    {currentItem.audit?.createdByEmail || 'بدون بريد إلكتروني مسجل'}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      تاريخ الإنشاء:{' '}
                      {currentItem.audit?.createdAt
                        ? new Date(currentItem.audit.createdAt).toLocaleString('ar-SA', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'غير مسجل'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Last Modified Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500" />
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>آخر من عدل</span>
                  </div>
                  <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                    آخر تحديث
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-extrabold text-slate-900">
                    {currentItem.audit?.updatedByName || currentItem.audit?.createdByName || 'لا توجد تعديلات لاحقة'}
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    {currentItem.audit?.updatedByEmail || currentItem.audit?.createdByEmail || '-'}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      وقت آخر تعديل:{' '}
                      {currentItem.audit?.updatedAt
                        ? new Date(currentItem.audit.updatedAt).toLocaleString('ar-SA', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : currentItem.audit?.createdAt
                        ? new Date(currentItem.audit.createdAt).toLocaleString('ar-SA')
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Timeline Steps */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h4 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>
                  {currentItem
                    ? `تسلسل الأحداث والخط الزمني (${itemLogs.length || 1} حدث)`
                    : `سجل العمليات والأنشطة العامة (${filteredGlobalLogs.length})`}
                </span>
              </h4>

              {!currentItem && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="بحث برقم المستند أو الموظف..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-xs pr-8 pl-3 py-1.5 rounded-lg border border-slate-300 w-48 sm:w-60 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* If viewed for a specific item */}
            {currentItem ? (
              <div className="space-y-4 relative before:absolute before:inset-0 before:right-3.5 before:w-0.5 before:bg-slate-200">
                {/* 1. Synthetic Initial Creation Step */}
                <div className="relative flex items-start gap-4 pr-1">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs z-10">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                        <span>
                          {isInvoice ? 'تم تسجيل وإصدار الفاتورة' : 'تم إنشاء عرض السعر'}
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          البداية
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {currentItem.audit?.createdAt
                          ? new Date(currentItem.audit.createdAt).toLocaleString('ar-SA')
                          : 'تاريخ الإنشاء'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">
                      قام الموظف/المسؤول{' '}
                      <strong className="text-slate-900 font-bold">
                        {currentItem.audit?.createdByName || 'حساب النظام'}
                      </strong>{' '}
                      بإدخال بيانات {isInvoice ? 'الفاتورة' : 'عرض السعر'} للعميل ({customerName}) بمبلغ إجمالي{' '}
                      <strong className="font-mono text-emerald-700">{totalAmount.toFixed(2)} ر.س</strong>.
                    </p>
                    {currentItem.revenueSource && (
                      <div className="text-[11px] text-slate-500 mt-1 font-semibold">
                        قناة البيع: {currentItem.revenueSource}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Logged events for this item */}
                {itemLogs.map((log) => (
                  <div key={log.id} className="relative flex items-start gap-4 pr-1">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-xs z-10 text-white ${
                        log.action === 'CONVERT_TO_SALE' || log.action === 'اعتماد وتعميد'
                          ? 'bg-purple-600'
                          : log.action === 'UPDATE' || log.action === 'تعديل'
                          ? 'bg-amber-500'
                          : log.action === 'DELETE' || log.action === 'حذف'
                          ? 'bg-rose-600'
                          : 'bg-indigo-600'
                      }`}
                    >
                      {log.action === 'CONVERT_TO_SALE' ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="flex-1 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                          <span>
                            {log.action === 'CONVERT_TO_SALE'
                              ? 'اعتماد وتحويل لأمر مبيعات'
                              : log.action === 'UPDATE'
                              ? 'تعديل وتحديث بيانات'
                              : log.action}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            بواسطة: {log.userName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {log.timestamp}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {log.details || 'تم إجراء العملية وتحديث البيانات بنجاح.'}
                      </p>
                    </div>
                  </div>
                ))}

                {/* If there was a last edit and no separate log */}
                {currentItem.audit?.updatedAt &&
                  currentItem.audit?.updatedAt !== currentItem.audit?.createdAt &&
                  itemLogs.length === 0 && (
                    <div className="relative flex items-start gap-4 pr-1">
                      <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs z-10">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                            <span>آخر تحديث وحفظ</span>
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              آخر تعديل
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(currentItem.audit.updatedAt).toLocaleString('ar-SA')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600">
                          قام المستخدم{' '}
                          <strong className="text-slate-900 font-bold">
                            {currentItem.audit.updatedByName || 'حساب النظام'}
                          </strong>{' '}
                          بحفظ آخر تعديلات وتحديث البيانات.
                        </p>
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              /* Global Log Table */
              <div className="divide-y divide-slate-200 max-h-[50vh] overflow-y-auto">
                {filteredGlobalLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    لا توجد أي أنشطة أو سجلات تطابق البحث.
                  </div>
                ) : (
                  filteredGlobalLogs.map((log) => (
                    <div
                      key={log.id}
                      className="py-3 px-2 flex items-start justify-between gap-3 hover:bg-slate-50 transition rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs mt-0.5 ${
                            log.action === 'CONVERT_TO_SALE'
                              ? 'bg-purple-600'
                              : log.action === 'CREATE'
                              ? 'bg-emerald-600'
                              : log.action === 'UPDATE'
                              ? 'bg-amber-500'
                              : log.action === 'DELETE'
                              ? 'bg-rose-600'
                              : 'bg-slate-600'
                          }`}
                        >
                          {log.action === 'CREATE' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : log.action === 'CONVERT_TO_SALE' ? (
                            <Sparkles className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div>
                          <div className="font-bold text-xs text-slate-800 flex items-center gap-2 flex-wrap">
                            <span>{log.details || log.action}</span>
                            {log.entityNumber && (
                              <span className="font-mono text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                                {log.entityNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>المستخدم: <strong className="text-slate-700">{log.userName}</strong></span>
                            {log.userEmail && <span className="font-mono">({log.userEmail})</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono shrink-0">
                        {log.timestamp}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>سجل التدقيق والخط الزمني نظام داخلي محمي ولا يظهر في المطبوعات أو ملفات PDF</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
