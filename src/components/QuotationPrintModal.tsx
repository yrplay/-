import React, { useState, useRef, useEffect } from 'react';
import {
  Printer,
  X,
  Building2,
  FileText,
  Download,
  FileDown,
  Clock,
  CheckCircle2,
  Loader2,
  QrCode,
  Stamp,
  Upload,
  ChevronDown,
  History,
} from 'lucide-react';
import { QuotationItem, AgencySettings } from '../types';
import {
  exportSafePdf,
  exportSafePng,
  generateQrDataUrl,
  openCleanPrintWindow,
  smartPrintDocument,
} from '../lib/printUtils';
import { AuditTimelineModal } from './AuditTimelineModal';

interface QuotationPrintModalProps {
  quotation: QuotationItem | null;
  onClose: () => void;
  agencySettings: AgencySettings;
  onUpdateAgencySettings?: (settings: AgencySettings) => void;
  onConvertQuotationToSale?: (quotation: QuotationItem) => void;
}

export const QuotationPrintModal: React.FC<QuotationPrintModalProps> = ({
  quotation,
  onClose,
  agencySettings,
  onUpdateAgencySettings,
  onConvertQuotationToSale,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showQrCode, setShowQrCode] = useState<boolean>(agencySettings.showQrCode ?? true);
  const [showStamp, setShowStamp] = useState<boolean>(Boolean(agencySettings.agencyStampUrl));
  const [showTimelineModal, setShowTimelineModal] = useState<boolean>(false);
  const [showVatNumber, setShowVatNumber] = useState<boolean>(
    agencySettings.showVatNumber ?? true
  );
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [actionNotification, setActionNotification] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stampInputRef = useRef<HTMLInputElement | null>(null);
  const stampFileInputRef = useRef<HTMLInputElement | null>(null);
  const customQrFileInputRef = useRef<HTMLInputElement | null>(null);

  // Generate QR Code data safely
  useEffect(() => {
    if (!quotation) return;
    const qrPayload = [
      `المنشأة: ${agencySettings.agencyName || 'وكالة الدعاية والإعلان'}`,
      showVatNumber && agencySettings.agencyVatNumber
        ? `الرقم الضريبي: ${agencySettings.agencyVatNumber}`
        : '',
      `عرض سعر رقم: ${quotation.quotationNo}`,
      `التاريخ: ${quotation.issueDate}`,
      `المبلغ الصافي: ${quotation.netTotal.toFixed(2)} ر.س`,
      quotation.isTaxIncluded ? `الضريبة: ${(quotation.taxAmount || 0).toFixed(2)} ر.س` : '',
    ]
      .filter(Boolean)
      .join('\n');

    generateQrDataUrl(qrPayload).then((url) => {
      setQrCodeDataUrl(url);
    });
  }, [quotation, agencySettings, showVatNumber]);

  if (!quotation) return null;

  // Smart Print handler
  const handlePrint = async () => {
    if (!containerRef.current) return;
    setActionNotification({
      type: 'info',
      message: 'جاري تجهيز أمر الطباعة لعرض السعر...',
    });

    try {
      const res = await smartPrintDocument(containerRef.current, `عرض-سعر-${quotation.quotationNo}`);
      if (res.method === 'pdf') {
        setActionNotification({
          type: 'success',
          message: `تم إنشاء وتحميل ملف عرض السعر (${quotation.quotationNo}.pdf) بجودة A4 للطباعة الفورية!`,
        });
      } else {
        setActionNotification({
          type: 'success',
          message: 'تم إرسال أمر الطباعة بنجاح.',
        });
      }
    } catch (err) {
      console.warn('Print trigger fallback to PDF:', err);
      handleExportPdf();
    }
  };

  // Safe Export to PDF
  const handleExportPdf = async () => {
    if (!containerRef.current) return;
    setIsExportingPdf(true);
    setActionNotification({
      type: 'info',
      message: 'جاري إنشاء ملف PDF لعرض السعر وتنزيله...',
    });

    const result = await exportSafePdf(containerRef.current, `عرض-سعر-${quotation.quotationNo}`);
    setIsExportingPdf(false);

    if (result.success) {
      setActionNotification({
        type: 'success',
        message: `تم تحميل ملف عرض السعر (${quotation.quotationNo}.pdf) بنجاح!`,
      });
    } else {
      console.warn('PDF export error:', result.error);
      setActionNotification({
        type: 'error',
        message: 'تعذر التنزيل التلقائي لـ PDF. يمكنك استخدام زر "طباعة" لحفظه كـ PDF فوراً.',
      });
    }
  };

  // Safe Export to PNG
  const handleExportPng = async () => {
    if (!containerRef.current) return;
    setIsExportingPng(true);
    setActionNotification({
      type: 'info',
      message: 'جاري تجهيز صورة عرض السعر وتنزيلها...',
    });

    const result = await exportSafePng(containerRef.current, `عرض-سعر-${quotation.quotationNo}`);
    setIsExportingPng(false);

    if (result.success) {
      setActionNotification({
        type: 'success',
        message: `تم تحميل صورة عرض السعر (${quotation.quotationNo}.png) بنجاح!`,
      });
    } else {
      setActionNotification({
        type: 'error',
        message: 'تعذر تنزيل الصورة، يرجى تجربة أمر الطباعة.',
      });
    }
  };

  // Upload Custom QR directly ("ارفعه زيما ارفع الختم")
  const handleCustomQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح لرمز QR (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const updated = {
        ...agencySettings,
        customQrUrl: result,
        showQrCode: true,
      };
      setShowQrCode(true);
      onUpdateAgencySettings?.(updated);
      setActionNotification({
        type: 'success',
        message: 'تم رفع وحفظ رمز QR المخصص للوكالة بنجاح!',
      });
    };
    reader.readAsDataURL(file);
  };

  // Upload Agency Stamp directly
  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح لختم المنشأة');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const updated = {
        ...agencySettings,
        agencyStampUrl: result,
      };
      onUpdateAgencySettings?.(updated);
      setShowStamp(true);
      setActionNotification({
        type: 'success',
        message: 'تم رفع وحفظ ختم الوكالة بنجاح!',
      });
    };
    reader.readAsDataURL(file);
  };

  const formatSAR = (n: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
    }).format(n);
  };

  // Check which optional fields actually exist (Strict: NO empty placeholders!)
  const customerPhone = (quotation.customerPhone || '').trim();
  const customerEmail = (quotation.customerEmail || '').trim();
  const customerCompany = (quotation.customerCompany || '').trim();
  const customerVatNumber = (quotation.customerVatNumber || '').trim();
  const hasContactInfo = Boolean(customerPhone || customerEmail);

  const validityDays =
    quotation.validityDays !== undefined &&
    quotation.validityDays !== '' &&
    Number(quotation.validityDays) > 0
      ? Number(quotation.validityDays)
      : null;

  const executionDays = (quotation.executionDays || '').trim();
  const paymentTerms = (quotation.paymentTerms || '').trim();
  const notes = (quotation.notes || '').trim();
  const hasTermsOrNotes = Boolean(executionDays || paymentTerms || validityDays || notes);

  const includeApproval = Boolean(quotation.includeCustomerApproval);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-w-none flex flex-col max-h-[96vh] my-auto print:max-h-none">
        {/* Top Control Bar */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between print:hidden gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span>عرض سعر رسمي (Price Quotation)</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    quotation.status === 'معتمد ومحول لطلب'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : quotation.status === 'مرفوض'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {quotation.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                الرقم: <span className="font-mono text-slate-200">{quotation.quotationNo}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Toggle Agency VAT Visibility */}
            <label
              className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                showVatNumber
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="إظهار أو إخفاء الرقم الضريبي للوكالة في عرض السعر"
            >
              <input
                type="checkbox"
                checked={showVatNumber}
                onChange={(e) => setShowVatNumber(e.target.checked)}
                className="w-3 h-3 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
              />
              <span>الضريبة</span>
            </label>

            {/* Toggle QR Code Visibility */}
            <label
              className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                showQrCode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="إظهار أو إخفاء رمز QR في عرض السعر"
            >
              <input
                type="checkbox"
                checked={showQrCode}
                onChange={() => {
                  const nextVal = !showQrCode;
                  setShowQrCode(nextVal);
                  onUpdateAgencySettings?.({
                    ...agencySettings,
                    showQrCode: nextVal,
                  });
                }}
                className="w-3 h-3 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
              />
              <span>QR</span>
            </label>

            {/* Toggle Official Stamp & Quick Upload beside QR button */}
            <div className="flex items-center gap-0.5">
              <label
                className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                  showStamp && agencySettings.agencyStampUrl
                    ? 'bg-emerald-600/90 text-white border-emerald-500 shadow-xs'
                    : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="إظهار أو إخفاء ختم المنشأة في عرض السعر"
              >
                <input
                  type="checkbox"
                  checked={showStamp && Boolean(agencySettings.agencyStampUrl)}
                  disabled={!agencySettings.agencyStampUrl}
                  onChange={(e) => setShowStamp(e.target.checked)}
                  className="w-3 h-3 rounded text-amber-500 focus:ring-amber-400 cursor-pointer disabled:opacity-50"
                />
                <Stamp className="w-3 h-3" />
                <span>ختم</span>
              </label>

              <label
                className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700 flex items-center"
                title={agencySettings.agencyStampUrl ? 'تغيير صورة الختم' : 'رفع صورة الختم الرسمي للمحل'}
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
            </div>

            {/* Convert to Sale Button */}
            {onConvertQuotationToSale && quotation.status !== 'معتمد ومحول لطلب' && (
              <button
                type="button"
                id="btn-convert-quotation"
                onClick={() => onConvertQuotationToSale(quotation)}
                className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer"
                title="اعتماد العرض وتحويله مباشرة إلى طلب مبيعات للتنفيذ"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>اعتماد</span>
              </button>
            )}

            {/* Merged Print & PDF/Image Save Button */}
            <div className="relative inline-flex items-stretch rounded-md shadow-sm">
              <button
                type="button"
                id="btn-quotation-print-pdf"
                onClick={handlePrint}
                className="px-3 py-1 rounded-r-md bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                title="طباعة عرض السعر أو حفظه كملف PDF"
              >
                <Printer className="w-3 h-3" />
                <span>طباعة</span>
              </button>
              <button
                type="button"
                id="btn-quotation-export-options"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-1.5 py-1 rounded-l-md bg-teal-700 hover:bg-teal-800 text-white text-xs border-r border-teal-800/80 transition cursor-pointer"
                title="خيارات تحميل إضافية"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showExportMenu && (
                <div className="absolute left-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1.5 z-50 min-w-[170px] text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportPdf();
                    }}
                    disabled={isExportingPdf}
                    className="w-full text-right px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-rose-400" />}
                    <span>تحميل ملف PDF مباشر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportPng();
                    }}
                    disabled={isExportingPng}
                    className="w-full text-right px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    {isExportingPng ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-indigo-400" />}
                    <span>تحميل صورة PNG</span>
                  </button>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              id="btn-close-quotation-modal"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Notification Banner */}
        {actionNotification && (
          <div
            className={`px-4 py-2 text-xs flex items-center justify-between print:hidden border-b transition-all ${
              actionNotification.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border-emerald-700'
                : actionNotification.type === 'error'
                ? 'bg-rose-900/90 text-rose-100 border-rose-700'
                : 'bg-indigo-900/90 text-indigo-100 border-indigo-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">
                {actionNotification.type === 'success'
                  ? '✅'
                  : actionNotification.type === 'error'
                  ? '⚠️'
                  : 'ℹ️'}
              </span>
              <span>{actionNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotification(null)}
              className="text-white/70 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Printable Quotation Sheet */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-6 print:p-0 print:bg-white flex justify-center overscroll-contain">
          <div
            ref={containerRef}
            id="printable-quotation"
            className="w-full max-w-[210mm] bg-white p-6 sm:p-8 text-slate-800 space-y-5 rounded-xl shadow-xs print:shadow-none print:rounded-none print:p-8"
          >
            {/* Header: Agency Branding */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 gap-4">
              <div className="flex items-center gap-4 flex-1">
                {agencySettings.agencyLogoUrl && (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-slate-200 p-1.5 flex items-center justify-center bg-white shadow-xs shrink-0">
                    <img
                      src={agencySettings.agencyLogoUrl}
                      alt="شعار الوكالة"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black text-slate-900 leading-tight">
                    {agencySettings.agencyName || 'وكالة الدعاية والإعلان والمطبوعات'}
                  </h1>
                  {agencySettings.agencySubtitle && (
                    <p className="text-xs text-slate-500 mt-1">
                      {agencySettings.agencySubtitle}
                    </p>
                  )}
                  {agencySettings.agencyPhone && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      هاتف: <span className="font-mono font-semibold">{agencySettings.agencyPhone}</span>
                    </p>
                  )}
                  {(agencySettings.agencyAddress || agencySettings.agencyCountry) && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      العنوان:{' '}
                      <span>
                        {[agencySettings.agencyCountry, agencySettings.agencyAddress]
                          .filter(Boolean)
                          .join(' - ')}
                      </span>
                    </p>
                  )}
                  {showVatNumber && agencySettings.agencyVatNumber && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-[11px] font-mono font-bold border border-slate-200">
                      <span className="font-sans text-slate-500">الرقم الضريبي:</span>
                      <span>{agencySettings.agencyVatNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Banner */}
              <div className="text-left shrink-0">
                <div
                  className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-lg font-black text-sm"
                  style={{ letterSpacing: 'normal' }}
                >
                  عرض سعر رسمي
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  PRICE QUOTATION
                </div>
                <div className="mt-2 text-xs space-y-0.5">
                  <p className="font-mono font-bold text-slate-900">
                    رقم العرض: <span className="text-amber-700">{quotation.quotationNo}</span>
                  </p>
                  <p className="text-slate-600">
                    التاريخ: <span className="font-mono">{quotation.issueDate}</span>
                  </p>
                  {validityDays && quotation.expiryDate ? (
                    <p className="text-slate-600">
                      ساري حتى: <span className="font-mono text-rose-700 font-bold">{quotation.expiryDate}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Introductory Bold Statement requested by user */}
            <div
              className="text-xs sm:text-sm font-black text-slate-900 bg-amber-50/70 border-r-4 border-amber-500 pr-3 py-2 rounded-l-lg"
              style={{ letterSpacing: 'normal' }}
            >
              يسرنا تقديم عرض أسعار لتنفيذ الخدمات الموضحة أدناه
            </div>

            {/* Customer Box (الى السيد / السادة) - ONLY render provided fields */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-slate-500 font-bold">إلى السيد / السادة:</div>
                <div className="text-sm font-extrabold text-slate-900">
                  {quotation.customerName}
                </div>
                {customerCompany ? (
                  <div className="text-slate-700 font-semibold">
                    الشركة / الجهة: {customerCompany}
                  </div>
                ) : null}
                {customerVatNumber ? (
                  <div className="text-slate-600 font-mono">
                    الرقم الضريبي للعميل: {customerVatNumber}
                  </div>
                ) : null}
              </div>

              {/* بيانات التواصل - ONLY if phone or email exists! */}
              {hasContactInfo ? (
                <div className="space-y-1 sm:text-left">
                  <div className="text-slate-500 font-bold sm:text-left">بيانات التواصل:</div>
                  {customerPhone ? (
                    <div className="font-mono text-slate-800 font-bold">
                      الجوال: {customerPhone}
                    </div>
                  ) : null}
                  {customerEmail ? (
                    <div className="text-slate-600 font-mono">
                      البريد: {customerEmail}
                    </div>
                  ) : null}
                  {validityDays ? (
                    <div className="text-slate-600">
                      مدة سريان العرض:{' '}
                      <span className="font-bold text-amber-800">{validityDays} يوماً</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Quotation Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs text-right">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="border border-slate-900 p-2.5 text-center w-10">#</th>
                    <th className="border border-slate-900 p-2.5">الخدمة / المنتج المطلوب</th>
                    <th className="border border-slate-900 p-2.5">المواصفات الفنية ومقاسات التنفيذ</th>
                    <th className="border border-slate-900 p-2.5 text-center w-16">الكمية</th>
                    <th className="border border-slate-900 p-2.5 w-16 text-center">الوحدة</th>
                    <th className="border border-slate-900 p-2.5 w-24 text-center">سعر الوحدة</th>
                    <th className="border border-slate-900 p-2.5 w-28 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items && quotation.items.length > 0 ? (
                    quotation.items.map((line, idx) => (
                      <tr key={line.id || idx} className="hover:bg-slate-50">
                        <td className="border border-slate-300 p-2.5 text-center font-mono text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-300 p-2.5 font-bold text-slate-900">
                          {line.serviceType}
                        </td>
                        <td className="border border-slate-300 p-2.5 text-slate-700 leading-relaxed">
                          {line.specifications ? line.specifications : null}
                        </td>
                        <td className="border border-slate-300 p-2.5 text-center font-mono font-bold">
                          {line.quantity}
                        </td>
                        <td className="border border-slate-300 p-2.5 text-center text-slate-600">
                          {line.unitType ? line.unitType : null}
                        </td>
                        <td className="border border-slate-300 p-2.5 text-center font-mono">
                          {line.unitPrice.toFixed(2)} ر.س
                        </td>
                        <td className="border border-slate-300 p-2.5 text-left font-mono font-bold text-slate-900">
                          {line.itemTotal.toFixed(2)} ر.س
                        </td>
                      </tr>
                    ))
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Calculations & Notes & Terms */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch gap-4 pt-1">
              {/* Quotation Terms & Notes - ONLY if any condition exists */}
              {hasTermsOrNotes ? (
                <div className="flex-1 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <div>
                    <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                      <span>شروط وأحكام عرض السعر والتنفيذ:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                      {executionDays ? (
                        <li>
                          <strong>مدة التنفيذ:</strong> {executionDays}
                        </li>
                      ) : null}
                      {paymentTerms ? (
                        <li>
                          <strong>طريقة الدفع:</strong> {paymentTerms}
                        </li>
                      ) : null}
                      {validityDays && quotation.expiryDate ? (
                        <li>
                          سريان الأسعار خاضع لتاريخ الصلاحية المحدد بعاليه ({quotation.expiryDate}).
                        </li>
                      ) : null}
                      {notes ? (
                        <li className="text-slate-800 font-semibold">
                          <strong>ملاحظات إضافية:</strong> {notes}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex-1"></div>
              )}

              {/* Calculations Box */}
              <div className="w-full sm:w-80 space-y-1.5 text-xs bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 shrink-0">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">إجمالي البنود:</span>
                  <span className="font-mono font-bold">{quotation.subtotal.toFixed(2)} ر.س</span>
                </div>

                {quotation.discount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-rose-600 font-semibold">
                    <span>
                      الخصم الممنوح
                      {quotation.discountType === 'percentage' ||
                      (quotation.discountPercent && quotation.discountPercent > 0)
                        ? ` (نسبة ${quotation.discountPercent}%):`
                        : ' (مبلغ محدد):'}
                    </span>
                    <span className="font-mono font-bold">-{quotation.discount.toFixed(2)} ر.س</span>
                  </div>
                )}

                {quotation.isTaxIncluded && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-800 font-bold bg-emerald-50/60 px-1.5 rounded">
                    <span>ضريبة القيمة المضافة ({quotation.taxRate || 15}%):</span>
                    <span className="font-mono font-bold">
                      +{(quotation.taxAmount || 0).toFixed(2)} ر.س
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-black text-slate-900">
                  <span>الصافي الإجمالي المطلوب:</span>
                  <span className="font-mono text-emerald-800">{formatSAR(quotation.netTotal)}</span>
                </div>
              </div>
            </div>

            {/* Official Customer Authorization / Acceptance Section (ONLY IF USER OPTED IN) */}
            {includeApproval && (
              <div className="border border-slate-300 rounded-xl p-3.5 bg-white text-xs space-y-3">
                <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>اعتماد وتعميد العميل (Customer Approval & Acceptance):</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    يرجى التوقيع والختم لإصدار أمر التشغيل والتنفيذ
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[11px]">اسم المعتمد / المفوض:</span>
                    <div className="border-b border-dotted border-slate-400 h-7 mt-1"></div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">التوقيع والتاريخ:</span>
                    <div className="border-b border-dotted border-slate-400 h-7 mt-1"></div>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-500 block text-[11px]">ختم المنشأة / العميل:</span>
                    <div className="border border-dashed border-slate-300 rounded-lg h-14 mt-1 flex items-center justify-center text-slate-300 text-[10px]">
                      مكان الختم
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Footer Row: Right = QR Code slot | Center = Centered text | Left = Stamp (ONLY if present) */}
            <div className="border-t-2 border-slate-900/20 pt-4 flex items-center justify-between gap-4">
              {/* Right Side in RTL: QR Code */}
              <div className="flex flex-col items-center shrink-0 w-28">
                {showQrCode && (
                  <div className="flex flex-col items-center">
                    {agencySettings.customQrUrl ? (
                      <div className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center shadow-xs">
                        <img
                          src={agencySettings.customQrUrl}
                          alt="كود QR الوكالة"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : qrCodeDataUrl ? (
                      <div className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center shadow-xs">
                        <img
                          src={qrCodeDataUrl}
                          alt="QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-300 flex items-center justify-center text-slate-400">
                        <QrCode className="w-8 h-8 animate-pulse" />
                      </div>
                    )}
                    <span className="text-[9px] text-slate-500 font-bold mt-1 text-center">
                      {agencySettings.customQrUrl ? 'رمز QR الوكالة' : 'رمز QR للتحقق'}
                    </span>
                  </div>
                )}
              </div>

              {/* Center: Footer text strictly centered */}
              <div className="text-center flex-1 px-4">
                <p className="font-semibold text-slate-800 text-xs sm:text-sm leading-relaxed">
                  {agencySettings.invoiceFooterText || 'شكراً لتعاملكم معنا • نسعد دائماً بخدمتكم وتلبية تطلعاتكم'}
                </p>
                {(agencySettings.agencyAddress || agencySettings.agencyCountry) && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {[agencySettings.agencyCountry, agencySettings.agencyAddress]
                      .filter(Boolean)
                      .join(' - ')}
                  </p>
                )}
              </div>

              {/* Left Side in RTL: Official Agency Stamp (ONLY if uploaded and enabled - NO placeholder buttons) */}
              <div className="flex flex-col items-center shrink-0 w-28">
                {showStamp && agencySettings.agencyStampUrl ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-bold mb-1">ختم الوكالة</span>
                    <div className="w-20 h-20 flex items-center justify-center p-0.5">
                      <img
                        src={agencySettings.agencyStampUrl}
                        alt="ختم الوكالة"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Audit Timeline Modal */}
        <AuditTimelineModal
          isOpen={showTimelineModal}
          onClose={() => setShowTimelineModal(false)}
          targetQuotation={quotation}
        />
      </div>
    </div>
  );
};
