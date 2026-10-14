import React, { useRef, useState, useEffect } from 'react';
import { Printer, Download, X, Check, Building2, Stamp, Upload, Loader2, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { VoucherItem, AgencySettings } from '../types';
import { tafqeet } from '../lib/tafqeet';
import { smartPrintDocument, exportSafePdf } from '../lib/printUtils';

interface VoucherPrintModalProps {
  voucher: VoucherItem | null;
  isOpen: boolean;
  onClose: () => void;
  agencySettings: AgencySettings;
  onUpdateAgencySettings?: (settings: AgencySettings) => void;
}

export const VoucherPrintModal: React.FC<VoucherPrintModalProps> = ({
  voucher,
  isOpen,
  onClose,
  agencySettings,
  onUpdateAgencySettings,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showTax, setShowTax] = useState<boolean>(agencySettings.showVatNumber ?? true);
  const [showQr, setShowQr] = useState<boolean>(agencySettings.showQrCode ?? true);
  const [showStamp, setShowStamp] = useState<boolean>(Boolean(agencySettings.agencyStampUrl));
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const stampInputRef = useRef<HTMLInputElement | null>(null);
  const voucherContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!voucher || !isOpen) return;

    if (agencySettings.customQrUrl) {
      setQrDataUrl(agencySettings.customQrUrl);
      return;
    }

    // Generate QR code for voucher authenticity
    const qrPayload = [
      `المنشأة: ${agencySettings.agencyName || 'وكالة الدعاية والإعلان'}`,
      showTax && agencySettings.agencyVatNumber ? `الرقم الضريبي: ${agencySettings.agencyVatNumber}` : '',
      `رقم السند: ${voucher.voucherNo}`,
      `النوع: ${voucher.type === 'receipt' ? 'سند قبض' : 'سند صرف'}`,
      `التاريخ: ${voucher.date}`,
      `المبلغ: ${voucher.amount.toFixed(2)} ر.س`,
      `الطرف: ${voucher.partyName}`,
    ].filter(Boolean).join('\n');

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch((e) => console.error(e));
  }, [voucher, isOpen, agencySettings, showTax]);

  if (!isOpen || !voucher) return null;

  const handlePrint = async () => {
    if (!voucherContainerRef.current) return;
    setIsPrinting(true);
    setNotification({ type: 'info', text: 'جاري تجهيز أمر الطباعة للسند...' });

    try {
      const res = await smartPrintDocument(voucherContainerRef.current, `سند-${voucher.voucherNo}`);
      if (res.method === 'pdf') {
        setNotification({ type: 'success', text: `تم تحميل ملف السند (${voucher.voucherNo}.pdf) للطباعة!` });
      } else {
        setNotification({ type: 'success', text: 'تم إرسال أمر الطباعة بنجاح.' });
      }
    } catch (err) {
      console.warn('Print error fallback:', err);
      handleExportPdf();
    } finally {
      setIsPrinting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleExportPdf = async () => {
    if (!voucherContainerRef.current) return;
    setIsExportingPdf(true);
    setNotification({ type: 'info', text: 'جاري إنشاء ملف PDF وتجهيزه للتحميل...' });

    try {
      const res = await exportSafePdf(voucherContainerRef.current, `سند-${voucher.voucherNo}`);
      if (res.success) {
        setNotification({ type: 'success', text: `تم تحميل السند (${voucher.voucherNo}.pdf) بنجاح!` });
      } else {
        setNotification({ type: 'error', text: 'تعذر إنشاء PDF، يرجى استخدام زر الطباعة المباشرة' });
      }
    } catch (err) {
      console.error('PDF export error:', err);
      setNotification({ type: 'error', text: 'حدث خطأ أثناء تحميل ملف PDF' });
    } finally {
      setIsExportingPdf(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateAgencySettings) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateAgencySettings({
        ...agencySettings,
        agencyStampUrl: reader.result as string,
      });
      setShowStamp(true);
    };
    reader.readAsDataURL(file);
  };

  const isReceipt = voucher.type === 'receipt';
  const voucherTitle = isReceipt ? 'سند قبض مالي' : 'سند صرف مالي';
  const voucherTitleEn = isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER';
  const amountWords = voucher.amountInWords || tafqeet(voucher.amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-w-none print:w-full">
        {/* Modal Controls - Hidden during print */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between gap-2 flex-wrap print:hidden">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isReceipt ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
              {voucherTitle}
            </span>
            <span className="font-mono text-sm font-bold text-slate-300">#{voucher.voucherNo}</span>
          </div>

          {/* Toggle Controls: ضريبة | QR | ختم | PDF | طباعة */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 1. Tax Toggle */}
            <label
              className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                showTax
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="إظهار أو إخفاء الرقم الضريبي في السند"
            >
              <input
                type="checkbox"
                checked={showTax}
                onChange={(e) => setShowTax(e.target.checked)}
                className="w-3 h-3 rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer"
              />
              <span>ضريبة</span>
            </label>

            {/* 2. QR Toggle */}
            <label
              className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                showQr
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="إظهار أو إخفاء رمز QR في السند"
            >
              <input
                type="checkbox"
                checked={showQr}
                onChange={(e) => setShowQr(e.target.checked)}
                className="w-3 h-3 rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer"
              />
              <span>QR</span>
            </label>

            {/* 3. Stamp Toggle */}
            <div className="flex items-center gap-0.5">
              <label
                className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                  showStamp && agencySettings.agencyStampUrl
                    ? 'bg-emerald-600/90 text-white border-emerald-500 shadow-xs'
                    : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="إظهار أو إخفاء ختم المنشأة في السند"
              >
                <input
                  type="checkbox"
                  checked={showStamp && Boolean(agencySettings.agencyStampUrl)}
                  disabled={!agencySettings.agencyStampUrl}
                  onChange={(e) => setShowStamp(e.target.checked)}
                  className="w-3 h-3 rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer disabled:opacity-50"
                />
                <Stamp className="w-3 h-3" />
                <span>ختم</span>
              </label>

              {onUpdateAgencySettings && (
                <label
                  className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700 flex items-center"
                  title="رفع أو تغيير صورة ختم المنشأة"
                >
                  <Upload className="w-3 h-3" />
                  <input
                    ref={stampInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleStampUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* 4. PDF Download Button */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf || isPrinting}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition border border-slate-700 cursor-pointer disabled:opacity-50"
              title="تحميل السند بصيغة PDF"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>PDF</span>
            </button>

            {/* 5. Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              title="طباعة السند (A4)"
            >
              {isPrinting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>طباعة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action feedback banner */}
        {notification && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center gap-2 print:hidden ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-b border-rose-200'
                : 'bg-sky-50 text-sky-800 border-b border-sky-200'
            }`}
          >
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-sky-600" />
            )}
            <span>{notification.text}</span>
          </div>
        )}

        {/* Printable Voucher Body */}
        <div
          ref={voucherContainerRef}
          id="printable-voucher"
          className="p-6 sm:p-10 text-slate-900 space-y-6 bg-white selection:bg-emerald-500 selection:text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
            {/* Agency Info */}
            <div className="space-y-1 text-right">
              <h2 className="text-xl sm:text-2xl font-black text-slate-950">
                {agencySettings.agencyName || 'وكالة الدعاية والإعلان والمطبوعات'}
              </h2>
              {agencySettings.agencySubtitle && (
                <p className="text-xs text-slate-600 font-medium">
                  {agencySettings.agencySubtitle}
                </p>
              )}
              {showTax && agencySettings.agencyVatNumber && (
                <p className="text-xs text-slate-500 font-mono">
                  الرقم الضريبي: <span className="font-bold text-slate-800">{agencySettings.agencyVatNumber}</span>
                </p>
              )}
              {agencySettings.agencyPhone && (
                <p className="text-xs text-slate-500 font-mono">
                  الهاتف: {agencySettings.agencyPhone}
                </p>
              )}
              {agencySettings.agencyAddress && (
                <p className="text-xs text-slate-500">
                  العنوان: {agencySettings.agencyAddress}
                </p>
              )}
            </div>

            {/* Logo - If not present, omit completely */}
            {agencySettings.agencyLogoUrl && (
              <div className="flex flex-col items-center shrink-0">
                <img
                  src={agencySettings.agencyLogoUrl}
                  alt="شعار الوكالة"
                  className="w-24 h-24 object-contain max-h-24"
                />
              </div>
            )}
          </div>

          {/* Title Banner & Voucher Number */}
          <div className="flex items-center justify-between bg-slate-100 p-3.5 rounded-xl border border-slate-200">
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-950 flex items-center gap-2">
                <span>{voucherTitle}</span>
                <span className="text-xs font-mono font-normal text-slate-500 tracking-wider">
                  [{voucherTitleEn}]
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">رقم السند:</span>
                <span className="font-black text-base text-slate-950">{voucher.voucherNo}</span>
              </div>
              <div className="border-r border-slate-300 pr-4">
                <span className="text-slate-500 block text-[10px]">التاريخ:</span>
                <span className="font-bold text-slate-900">{voucher.date}</span>
              </div>
            </div>
          </div>

          {/* Amount Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-emerald-50 border-2 border-emerald-500/60 rounded-xl text-center sm:text-right">
              <span className="text-xs font-bold text-emerald-900 block mb-0.5">المبلغ رقماً:</span>
              <div className="text-2xl font-black text-emerald-700 font-mono">
                {voucher.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-sans">ر.س</span>
              </div>
            </div>

            <div className="sm:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-500 block mb-1">المبلغ كتابة وتفقيطاً:</span>
              <p className="text-sm font-black text-slate-900 leading-relaxed">
                {amountWords}
              </p>
            </div>
          </div>

          {/* Details Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs sm:text-sm">
            <div className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-slate-500 shrink-0 w-36">
                {isReceipt ? 'استلمنا من المكرم / السيد:' : 'صرفنا إلى المكرم / السيد:'}
              </span>
              <span className="font-extrabold text-slate-950 flex-1 text-sm sm:text-base">
                {voucher.partyName}
              </span>
              {voucher.partyPhone && (
                <span className="text-xs text-slate-500 font-mono">
                  الجوال: {voucher.partyPhone}
                </span>
              )}
            </div>

            <div className="p-3.5 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-slate-500 shrink-0 w-36">طريقة الدفع:</span>
              <div className="flex-1 flex items-center gap-3 font-semibold text-slate-800">
                <span className="px-2.5 py-1 rounded bg-white border border-slate-200 font-bold">
                  {voucher.paymentMethod}
                </span>
                {voucher.referenceNo && (
                  <span className="text-xs text-slate-600 font-mono">
                    مرجع/حوالة/شيك: <strong>{voucher.referenceNo}</strong>
                  </span>
                )}
                {voucher.relatedInvoiceNo && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                    فاتورة: {voucher.relatedInvoiceNo}
                  </span>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-white flex flex-col sm:flex-row items-start justify-between gap-2">
              <span className="font-bold text-slate-500 shrink-0 w-36 pt-0.5">وذلك مقابل / البيان:</span>
              <p className="flex-1 font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
                {voucher.description || 'سداد مستحقات خدمات الدعاية والطباعة'}
              </p>
            </div>

            {voucher.notes && (
              <div className="p-3 bg-amber-50/50 flex flex-col sm:flex-row items-start justify-between gap-2 text-xs">
                <span className="font-bold text-amber-800 shrink-0 w-36">ملاحظات:</span>
                <span className="flex-1 text-amber-900">{voucher.notes}</span>
              </div>
            )}
          </div>

          {/* Signatures & Stamp Box */}
          <div
            className={`grid gap-4 pt-6 border-t border-slate-200 text-center text-xs ${
              showStamp && agencySettings.agencyStampUrl
                ? 'grid-cols-1 sm:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            {/* Box 1: Receiver (المستلم فقط بدون أمين الصندوق ولا المستفيد) */}
            <div className="flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 min-h-[125px]">
              <div>
                <span className="text-xs font-black text-slate-800 tracking-wide block mb-1">
                  المستلم
                </span>
                {voucher.receivedBy ? (
                  <div className="mt-1.5">
                    <span className="text-xs font-black text-slate-950 bg-white px-3 py-1 rounded-lg border border-slate-300 shadow-2xs inline-block">
                      {voucher.receivedBy}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-auto pt-4">
                <div className="border-b border-dashed border-slate-400 w-36 mx-auto mb-1"></div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {voucher.receivedBy ? 'التوقيع والمصادقة' : 'الاسم والتوقيع'}
                </span>
              </div>
            </div>

            {/* Box 2: Stamp (Omit completely if not enabled or not present) */}
            {showStamp && agencySettings.agencyStampUrl ? (
              <div className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 min-h-[125px]">
                <span className="text-xs font-black text-slate-800 tracking-wide block mb-1.5">
                  ختم المنشأة الرسمي
                </span>
                <div className="w-28 h-20 flex items-center justify-center p-1">
                  <img
                    src={agencySettings.agencyStampUrl}
                    alt="ختم المنشأة"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            ) : null}

            {/* Box 3: Manager Approval & QR */}
            <div className="flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 min-h-[125px]">
              <div>
                <span className="text-xs font-black text-slate-800 tracking-wide block mb-1">
                  الاعتماد / المدير المالي
                </span>
                {voucher.approvedBy ? (
                  <div className="mt-1.5">
                    <span className="text-xs font-black text-slate-950 bg-white px-3 py-1 rounded-lg border border-slate-300 shadow-2xs inline-block">
                      {voucher.approvedBy}
                    </span>
                  </div>
                ) : null}
              </div>

              {showQr && qrDataUrl ? (
                <div className="flex justify-center my-1.5">
                  <img
                    src={qrDataUrl}
                    alt="كود التحقق"
                    className="w-14 h-14 rounded-md border border-slate-200 bg-white p-0.5"
                  />
                </div>
              ) : null}

              <div className="mt-auto pt-2">
                <div className="border-b border-dashed border-slate-400 w-36 mx-auto mb-1"></div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  التوقيع والاعتماد
                </span>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          {agencySettings.invoiceFooterText ? (
            <div className="text-center pt-4 border-t border-slate-100 text-[11px] text-slate-400">
              {agencySettings.invoiceFooterText}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
