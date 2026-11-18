import React, { useState, useRef, useEffect } from 'react';
import {
  Printer,
  X,
  Download,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { ReturnRecord, AgencySettings } from '../types';
import {
  exportSafePdf,
  generateQrDataUrl,
  smartPrintDocument,
} from '../lib/printUtils';
import { tafqeet } from '../lib/tafqeet';

interface CreditNotePrintModalProps {
  returnRecord: ReturnRecord | null;
  onClose: () => void;
  agencySettings: AgencySettings;
}

export const CreditNotePrintModal: React.FC<CreditNotePrintModalProps> = ({
  returnRecord,
  onClose,
  agencySettings,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!returnRecord) return;
    const isSaleReturn = returnRecord.kind === 'sale_return';
    const qrPayload = [
      `المنشأة: ${agencySettings.agencyName || 'وكالة الدعاية والإعلان'}`,
      agencySettings.showVatNumber && agencySettings.agencyVatNumber
        ? `الرقم الضريبي: ${agencySettings.agencyVatNumber}`
        : '',
      `${isSaleReturn ? 'رقم إشعار الدائن' : 'رقم مرتجع الشراء'}: ${returnRecord.returnNo}`,
      `الفاتورة الأصلية: ${returnRecord.originalDocNo}`,
      `التاريخ: ${returnRecord.date}`,
      `الإجمالي المسترد: ${returnRecord.totalRefundAmount.toFixed(2)} ر.س`,
      returnRecord.isTaxIncluded ? `الضريبة المستردة (${returnRecord.taxRate}%): ${returnRecord.taxAmount.toFixed(2)} ر.س` : '',
    ]
      .filter(Boolean)
      .join('\n');

    generateQrDataUrl(qrPayload).then((url) => setQrCodeDataUrl(url));
  }, [returnRecord, agencySettings]);

  if (!returnRecord) return null;

  const isSaleReturn = returnRecord.kind === 'sale_return';
  const docTitleAr = isSaleReturn ? 'إشعار دائن ضريبي / مرتجع مبيعات' : 'إشعار مدين / مرتجع مشتريات لمورد';
  const docTitleEn = isSaleReturn ? 'TAX CREDIT NOTE / SALES RETURN' : 'DEBIT NOTE / PURCHASE RETURN';

  const handlePrint = async () => {
    if (!containerRef.current) return;
    setNotification('جاري تجهيز أمر الطباعة...');
    try {
      await smartPrintDocument(containerRef.current, `إشعار-${returnRecord.returnNo}`);
      setNotification('تم إرسال أمر الطباعة بنجاح');
    } catch {
      handleExportPdf();
    } finally {
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const handleExportPdf = async () => {
    if (!containerRef.current) return;
    setIsExportingPdf(true);
    setNotification('جاري تصدير ملف PDF...');
    try {
      await exportSafePdf(containerRef.current, `إشعار-${returnRecord.returnNo}`);
      setNotification(`تم تنزيل (${returnRecord.returnNo}.pdf) بنجاح`);
    } finally {
      setIsExportingPdf(false);
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const returnTypeLabel =
    returnRecord.returnType === 'full'
      ? 'مرتجع كامل للفاتورة'
      : returnRecord.returnType === 'partial'
      ? 'مرتجع جزئي'
      : returnRecord.returnType === 'exchange'
      ? 'استبدال وإعادة طباعة'
      : 'تالف / عيب مصنعي أو طباعي';

  const refundMethodLabel =
    returnRecord.refundMethod === 'cash_voucher'
      ? `استرداد مالي بسند (${returnRecord.paymentMethod})`
      : returnRecord.refundMethod === 'account_deduction'
      ? 'خصم من الرصيد المستحق على الفاتورة'
      : 'استبدال بضاعة / إعادة طباعة بدون أثر نقدي';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 print:border-none print:shadow-none">
        {/* Top Action Bar */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between gap-2 flex-wrap print:hidden">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">{docTitleAr}</span>
            <span className="font-mono text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
              {returnRecord.returnNo}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition cursor-pointer"
            >
              {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-amber-400" />}
              <span>تحميل PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الإشعار</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {notification && (
          <div className="bg-emerald-950 text-emerald-200 px-4 py-2 text-xs font-bold text-center print:hidden">
            {notification}
          </div>
        )}

        {/* Printable Area */}
        <div ref={containerRef} className="p-6 sm:p-10 bg-white text-slate-900 space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-5">
            <div className="space-y-1">
              <h1 className="text-xl font-extrabold text-slate-900">
                {agencySettings.agencyName || 'وكالة الإبداع للدعاية والإعلان'}
              </h1>
              <p className="text-xs text-slate-600">{agencySettings.agencySubtitle}</p>
              {agencySettings.showVatNumber && agencySettings.agencyVatNumber && (
                <p className="text-xs font-bold text-slate-800">
                  الرقم الضريبي للمنشأة: <span className="font-mono">{agencySettings.agencyVatNumber}</span>
                </p>
              )}
              {agencySettings.agencyPhone && (
                <p className="text-xs text-slate-600">جوال: {agencySettings.agencyPhone}</p>
              )}
            </div>

            <div className="text-center">
              <div className="inline-block px-4 py-2 rounded-xl bg-amber-50 border-2 border-amber-500 text-amber-900">
                <div className="text-base font-extrabold">{docTitleAr}</div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-amber-700">{docTitleEn}</div>
              </div>
              <div className="mt-2 font-mono text-sm font-extrabold text-slate-900">
                رقم الإشعار: {returnRecord.returnNo}
              </div>
              <div className="text-xs text-slate-600">تاريخ الإصدار: {returnRecord.date}</div>
            </div>

            {agencySettings.agencyLogoUrl && (
              <img
                src={agencySettings.agencyLogoUrl}
                alt="شعار الوكالة"
                className="w-20 h-20 object-contain border border-slate-200 rounded-xl p-1"
              />
            )}
          </div>

          {/* Reference & Party Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500 font-semibold">{isSaleReturn ? 'العميل / السادة:' : 'المورد / السادة:'}</span>{' '}
                <span className="font-extrabold text-slate-900 text-sm">{returnRecord.partyName}</span>
              </div>
              {returnRecord.partyPhone && (
                <div>
                  <span className="text-slate-500 font-semibold">رقم الجوال:</span>{' '}
                  <span className="font-mono">{returnRecord.partyPhone}</span>
                </div>
              )}
              {returnRecord.partyVatNumber && (
                <div>
                  <span className="text-slate-500 font-semibold">الرقم الضريبي للطرف:</span>{' '}
                  <span className="font-mono font-bold">{returnRecord.partyVatNumber}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500 font-semibold">مرتبط بالفاتورة الأصلية رقم:</span>{' '}
                <span className="font-mono font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {returnRecord.originalDocNo}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">تصنيف المرتجع:</span>{' '}
                <span className="font-bold text-slate-900">{returnTypeLabel}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">طريقة المعالجة المالية:</span>{' '}
                <span className="font-bold text-emerald-800">{refundMethodLabel}</span>
              </div>
            </div>
          </div>

          {/* Reason Banner */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs">
            <span className="font-extrabold text-amber-900">سبب إصدار الإشعار / المرتجع: </span>
            <span className="text-slate-800 font-medium">{returnRecord.reason || 'تعديل أو إرجاع أصناف حسب طلب العميل'}</span>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto border border-slate-300 rounded-xl">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-2.5 border-l border-slate-700 w-10 text-center">#</th>
                  <th className="p-2.5 border-l border-slate-700">البند / الخدمة / الخامة المرتجعة</th>
                  <th className="p-2.5 border-l border-slate-700 text-center w-20">الوحدة</th>
                  <th className="p-2.5 border-l border-slate-700 text-center w-24">الكمية الأصلية</th>
                  <th className="p-2.5 border-l border-slate-700 text-center w-24">الكمية المرتجعة</th>
                  <th className="p-2.5 border-l border-slate-700 text-center w-28">سعر الوحدة</th>
                  <th className="p-2.5 text-center w-32">إجمالي المرتجع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {returnRecord.items.map((line, i) => (
                  <tr key={line.id || i} className="hover:bg-slate-50">
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono">{i + 1}</td>
                    <td className="p-2.5 border-l border-slate-200">
                      <div className="font-bold text-slate-900">{line.itemName}</div>
                      {line.specifications && <div className="text-[11px] text-slate-500">{line.specifications}</div>}
                    </td>
                    <td className="p-2.5 border-l border-slate-200 text-center">{line.unitType}</td>
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono">{line.soldOrPurchasedQty}</td>
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono font-extrabold text-rose-700">
                      {line.returnQty}
                    </td>
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono">{line.unitPrice.toFixed(2)} ر.س</td>
                    <td className="p-2.5 text-center font-mono font-bold text-slate-900">{line.lineTotal.toFixed(2)} ر.س</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & QR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center pt-2">
            <div className="flex items-center gap-4">
              {qrCodeDataUrl && (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code"
                  className="w-28 h-28 border border-slate-300 rounded-xl p-1.5"
                />
              )}
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-700">المبلغ المسترد بالحروف:</div>
                <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200 font-bold text-slate-900">
                  {tafqeet(returnRecord.totalRefundAmount)}
                </div>
                {returnRecord.generatedVoucherNo && (
                  <div className="text-[11px] text-emerald-700 font-bold">
                    رقم السند المالي المرتبط: {returnRecord.generatedVoucherNo}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">الإجمالي قبل الضريبة:</span>
                <span className="font-mono font-bold">{returnRecord.subtotalBeforeTax.toFixed(2)} ر.س</span>
              </div>
              {returnRecord.isTaxIncluded && (
                <div className="flex justify-between text-amber-800">
                  <span className="font-semibold">ضريبة القيمة المضافة المستردة ({returnRecord.taxRate}%):</span>
                  <span className="font-mono font-bold">{returnRecord.taxAmount.toFixed(2)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-300 text-sm font-extrabold text-rose-700">
                <span>صافي قيمة الإشعار المسترد:</span>
                <span className="font-mono">{returnRecord.totalRefundAmount.toFixed(2)} ر.س</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-200 text-center text-xs text-slate-600">
            <div>
              <div className="font-bold text-slate-800 mb-8">إعداد المحاسب / المبيعات</div>
              <div className="border-b border-dashed border-slate-400 w-36 mx-auto"></div>
            </div>
            <div>
              <div className="font-bold text-slate-800 mb-8">توقيع العميل / المستلم</div>
              <div className="border-b border-dashed border-slate-400 w-36 mx-auto"></div>
            </div>
            <div>
              <div className="font-bold text-slate-800 mb-4">اعتماد الإدارة والختم</div>
              {agencySettings.agencyStampUrl ? (
                <img src={agencySettings.agencyStampUrl} alt="الختم" className="w-20 h-20 object-contain mx-auto" />
              ) : (
                <div className="border-b border-dashed border-slate-400 w-36 mx-auto mt-8"></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
